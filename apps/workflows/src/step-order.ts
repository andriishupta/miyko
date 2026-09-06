import { ChatOpenAI } from "@langchain/openai";
import { Command, START, StateGraph, StateSchema, interrupt, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { workflowConfig } from "./config.js";
import { findMemories, findMemoriesBySource, householdNamespace, memberNamespace, remember } from "./memory.js";
import { workflowError, workflowLog } from "./observability.js";
import { runSilpo, type ProviderResult, type SilpoOperation } from "./silpo.js";

const roleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
const actorSchema = z.object({ memberId: z.string().uuid(), role: roleSchema });
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("provider_action"), requestId: z.string().optional(), intent: z.string() }),
  z.object({ type: z.literal("fulfillment_selected"), mode: z.enum(["pickup", "delivery"]) }),
  z.object({ type: z.literal("delivery_slot_selected"), scheduledFrom: z.string(), scheduledTo: z.string() }),
  z.object({ type: z.literal("approve"), approvalId: z.string().uuid() }),
  z.object({ type: z.literal("decline"), approvalId: z.string().uuid() }),
]);
const resumedActionSchema = z.object({ eventId: z.string(), action: actionSchema, actor: actorSchema });
const plannedRequestSchema = z.object({ memberId: z.string().uuid(), text: z.string() });
const classifiedSchema = z.object({
  kind: z.enum(["add_request", "prepare_basket", "replace_product", "checkout"]),
  instruction: z.string(),
});
const stepOrderContextSchema = z.object({ providerAccessToken: z.string().min(1) });
type StepOrderContext = z.infer<typeof stepOrderContextSchema>;

const StepOrderState = new StateSchema({
  operation: z.literal("workflow.start"),
  workflowId: z.string().uuid(),
  workflowKind: z.literal("step-order"),
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
  memberRole: roleSchema,
  text: z.string(),
  providerSlug: z.string(),
  source: z.enum(["text", "audio"]),
  eventId: z.string(),
  memory: z.object({ householdNamespace: z.string(), memberNamespace: z.string() }),
  phase: z.enum(["collecting", "approval_required", "basket_ready", "ready_for_checkout", "completed"]).default("collecting"),
  plannedRequests: z.array(plannedRequestSchema).default([]),
  memoryContext: z.array(z.string()).default([]),
  actor: actorSchema.optional(),
  latestAction: actionSchema.optional(),
  classified: classifiedSchema.optional(),
  pendingRequest: z.object({ requestId: z.string(), actor: actorSchema, classified: classifiedSchema }).nullable().default(null),
  providerBasketId: z.string().nullable().default(null),
  providerOrderId: z.string().nullable().default(null),
  fulfillmentMode: z.enum(["pickup", "delivery"]).nullable().default(null),
  scheduledFrom: z.string().nullable().default(null),
  scheduledTo: z.string().nullable().default(null),
  items: z.array(z.object({ name: z.string(), quantity: z.string().nullable(), price: z.number().nullable(), imageUrl: z.string().nullable() })).default([]),
  total: z.number().nullable().default(null),
  currency: z.string().nullable().default(null),
  checkoutUrl: z.string().nullable().default(null),
  summary: z.string().default(""),
});

type WorkflowNode<Next extends string = string> = GraphNode<typeof StepOrderState, StepOrderContext, Next>;

const providerAccessToken = (runtime: { context?: StepOrderContext }) => {
  const token = runtime.context?.providerAccessToken;
  if (!token) throw new Error("Provider access token is required for this run");
  return token;
};

const initialize: WorkflowNode = async (state, runtime) => {
  if (state.providerSlug !== "silpo") throw new Error(`Unsupported provider for step-order: ${state.providerSlug}`);
  const config = workflowConfig();
  const household = householdNamespace(state.householdId);
  const member = memberNamespace(state.memberId);
  const [householdMemories, memberMemories] = await Promise.all([
    findMemories(config.mem0ApiKey, household, state.text),
    findMemories(config.mem0ApiKey, member, state.text),
  ]);
  const bootstrap = await findMemoriesBySource(config.mem0ApiKey, household, "silpo_order_history");
  let historyContext = bootstrap.flatMap((item) => item.memory ? [item.memory] : []);
  if (!bootstrap.length) {
    const history = await runSilpo("history", "Read exactly the latest 10 online orders. Summarize recurring products, quantities and useful preferences. Do not mutate anything.", providerAccessToken(runtime), { workflowId: state.workflowId, eventId: state.eventId });
    await remember(config.mem0ApiKey, household, `Silpo latest ten online orders imported. ${history.summary}`, { source: "silpo_order_history", workflowId: state.workflowId, eventId: state.eventId });
    historyContext = [history.summary];
  }
  return {
    phase: "collecting",
    plannedRequests: [{ memberId: state.memberId, text: state.text }],
    memoryContext: [...householdMemories, ...memberMemories].flatMap((item) => item.memory ? [item.memory] : []).concat(historyContext),
    summary: "Initial request saved in LangGraph state; the Silpo basket has not been changed.",
  };
};

const awaitAction: WorkflowNode<"classify_action"> = () => {
  const resumed = resumedActionSchema.parse(interrupt({ type: "workflow_action", message: "Waiting for the next household action" }));
  return new Command({ update: { actor: resumed.actor, latestAction: resumed.action, eventId: resumed.eventId }, goto: "classify_action" });
};

const classifyAction: WorkflowNode<"authorize_action"> = async (state) => {
  const action = state.latestAction;
  if (!action || !state.actor) throw new Error("Resumed workflow action and actor are required");
  if (action.type === "approve" || action.type === "decline") throw new Error("There is no approval waiting for this decision");
  if (action.type === "fulfillment_selected") return new Command({ update: { classified: { kind: "prepare_basket", instruction: `Set fulfillment mode to ${action.mode}.` } }, goto: "authorize_action" });
  if (action.type === "delivery_slot_selected") return new Command({ update: { classified: { kind: "prepare_basket", instruction: `Set delivery slot from ${action.scheduledFrom} to ${action.scheduledTo}.` } }, goto: "authorize_action" });

  const config = workflowConfig();
  const model = new ChatOpenAI({ apiKey: config.openAiApiKey, model: config.openAiModel });
  const startedAt = Date.now();
  workflowLog("openai.classification.started", { workflowId: state.workflowId, eventId: state.eventId, model: config.openAiModel });
  let classified: z.infer<typeof classifiedSchema>;
  try {
    classified = await model.withStructuredOutput(classifiedSchema).invoke([
      ["system", "Classify a household order instruction. add_request only records an item/meal request in graph state. prepare_basket creates or fills the Silpo basket. replace_product changes an existing basket item. checkout reads and returns the current checkout link; it never claims to place the order."],
      ["user", action.intent],
    ]);
    workflowLog("openai.classification.completed", { workflowId: state.workflowId, eventId: state.eventId, model: config.openAiModel, kind: classified.kind, durationMs: Date.now() - startedAt });
  } catch (error) {
    workflowError("openai.classification.failed", error, { workflowId: state.workflowId, eventId: state.eventId, model: config.openAiModel, durationMs: Date.now() - startedAt });
    throw error;
  }
  return new Command({ update: { classified }, goto: "authorize_action" });
};

const authorizeAction: WorkflowNode<"request_approval" | "apply_action"> = (state) => {
  if (!state.actor || !state.classified) throw new Error("Classified action is required");
  const canApply = state.actor.role === "owner" || state.actor.role === "admin" || (state.actor.role === "editor" && state.classified.kind === "add_request");
  if (canApply) return new Command({ goto: "apply_action" });
  return new Command({ update: { pendingRequest: { requestId: state.eventId, actor: state.actor, classified: state.classified }, phase: "approval_required" }, goto: "request_approval" });
};

const approvalAction = (action: z.infer<typeof actionSchema> | undefined) => {
  if (action?.type === "fulfillment_selected") return "fulfillment" as const;
  if (action?.type === "delivery_slot_selected") return "delivery_slot" as const;
  return "provider_action" as const;
};

const requestApproval: WorkflowNode<"await_action" | "apply_action"> = (state) => {
  if (!state.pendingRequest) throw new Error("Pending approval request is required");
  const resumed = resumedActionSchema.parse(interrupt({ action: approvalAction(state.latestAction), requestId: state.pendingRequest.requestId, summary: state.pendingRequest.classified.instruction }));
  if (resumed.actor.role !== "owner" && resumed.actor.role !== "admin") throw new Error("Only an owner or admin can decide an approval");
  if (resumed.action.type === "decline") return new Command({ update: { pendingRequest: null, phase: "collecting", summary: "The household request was declined." }, goto: "await_action" });
  if (resumed.action.type !== "approve") throw new Error("Approval interrupt requires approve or decline");
  return new Command({ update: { actor: state.pendingRequest.actor, classified: state.pendingRequest.classified, pendingRequest: null }, goto: "apply_action" });
};

const providerOperation = (state: typeof StepOrderState.State): SilpoOperation => {
  if (state.latestAction?.type === "fulfillment_selected" || state.latestAction?.type === "delivery_slot_selected") return "fulfillment";
  if (state.classified?.kind === "replace_product") return "replacement";
  if (state.classified?.kind === "checkout") return "checkout";
  return "basket";
};

const providerUpdate = (result: ProviderResult) => ({
  providerBasketId: result.providerBasketId,
  providerOrderId: result.providerOrderId,
  items: result.items,
  total: result.total,
  currency: result.currency,
  checkoutUrl: result.checkoutUrl,
  summary: result.summary,
});

const fulfillmentUpdate = (action: z.infer<typeof actionSchema> | undefined) => {
  if (action?.type === "fulfillment_selected") return { fulfillmentMode: action.mode };
  if (action?.type === "delivery_slot_selected") return { scheduledFrom: action.scheduledFrom, scheduledTo: action.scheduledTo };
  return {};
};

const applyAction: WorkflowNode<"await_action"> = async (state, runtime) => {
  if (!state.actor || !state.classified) throw new Error("Authorized action is required");
  if (state.classified.kind === "add_request") {
    return new Command({ update: { plannedRequests: [...state.plannedRequests, { memberId: state.actor.memberId, text: state.classified.instruction }], phase: "collecting", summary: "Household request added to the shared order plan." }, goto: "await_action" });
  }
  const plan = state.plannedRequests.map((request) => `- ${request.text}`).join("\n");
  const memory = state.memoryContext.map((item) => `- ${item}`).join("\n");
  const result = await runSilpo(providerOperation(state), `${state.classified.instruction}\nConfirmed household plan:\n${plan}\nRelevant household memory:\n${memory || "- None"}`, providerAccessToken(runtime), { workflowId: state.workflowId, eventId: state.eventId });
  const phase = state.classified.kind === "checkout" ? "ready_for_checkout" : "basket_ready";
  return new Command({ update: { ...providerUpdate(result), ...fulfillmentUpdate(state.latestAction), phase }, goto: "await_action" });
};

export const stepOrderGraph = new StateGraph(StepOrderState, stepOrderContextSchema)
  .addNode("initialize", initialize)
  .addNode("await_action", awaitAction, { ends: ["classify_action"] })
  .addNode("classify_action", classifyAction, { ends: ["authorize_action"] })
  .addNode("authorize_action", authorizeAction, { ends: ["request_approval", "apply_action"] })
  .addNode("request_approval", requestApproval, { ends: ["await_action", "apply_action"] })
  .addNode("apply_action", applyAction, { ends: ["await_action"] })
  .addEdge(START, "initialize")
  .addEdge("initialize", "await_action")
  .compile();
