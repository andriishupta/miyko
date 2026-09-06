import { Client } from "@langchain/langgraph-sdk";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { householdMemoryNamespace, memberMemoryNamespace } from "../memory/memory.namespaces.js";
import { requireAgentConfig } from "./agent.config.js";
import type { AgentLayer, WorkflowAction, WorkflowInput, WorkflowInterrupt, WorkflowReference } from "./agent.port.js";

const clientFor = () => {
  const config = requireAgentConfig();
  return { client: new Client({ apiUrl: config.apiUrl, apiKey: config.apiKey, timeoutMs: 30_000 }), workflow: config.workflow };
};

const statusOf = (status: string): WorkflowReference["status"] => {
  if (["pending", "running", "interrupted", "succeeded", "failed", "cancelled"].includes(status)) return status as WorkflowReference["status"];
  if (status === "success") return "succeeded";
  if (status === "error" || status === "timeout") return "failed";
  throw new AppError("AGENT_INVALID_RESPONSE", "LangGraph Cloud returned an unsupported workflow status", 502);
};

const existingRun = async (client: Client, threadId: string, eventId: string) => {
  const runs = await client.runs.list(threadId, { limit: 100 });
  return runs.find((run) => run.metadata?.sourceEventId === eventId);
};

const interruptValueSchema = z.object({
  requestId: z.string().min(1).max(255).optional(),
  externalRequestId: z.string().min(1).max(255).optional(),
  action: z.enum(["provider_action", "fulfillment", "delivery_slot"]).optional(),
  type: z.enum(["provider_action", "fulfillment", "delivery_slot"]).optional(),
  category: z.enum(["provider_action", "fulfillment", "delivery_slot"]).optional(),
}).passthrough();

const interruptSchema = z.object({
  id: z.string().min(1).max(255).optional(),
  value: z.unknown().optional(),
}).passthrough();

const projectionSchema = z.object({
  providerBasketId: z.string().min(1).nullable().optional(),
  providerOrderId: z.string().min(1).nullable().optional(),
  fulfillmentMode: z.enum(["pickup", "delivery"]).nullable().optional(),
  scheduledFrom: z.string().datetime({ offset: true }).nullable().optional(),
  scheduledTo: z.string().datetime({ offset: true }).nullable().optional(),
}).passthrough();

const parseInterrupt = (candidate: unknown): WorkflowInterrupt => {
  const parsed = interruptSchema.safeParse(candidate);
  if (!parsed.success) throw new AppError("AGENT_INVALID_INTERRUPT", "LangGraph returned an invalid interrupt", 502);

  const value = interruptValueSchema.safeParse(parsed.data.value);
  if (!value.success) throw new AppError("AGENT_INVALID_INTERRUPT", "LangGraph returned an invalid interrupt value", 502);

  const action = value.data.action ?? value.data.type ?? value.data.category;
  if (!action) throw new AppError("AGENT_INVALID_INTERRUPT", "LangGraph interrupt has no supported action", 502);

  return {
    action,
    externalRequestId: value.data.externalRequestId ?? value.data.requestId ?? parsed.data.id ?? null,
  };
};

const observeRun = async (client: Client, threadId: string, runId: string) => {
  // `join` makes the API boundary observe the managed run result instead of
  // treating the asynchronous create response as workflow state.
  await client.runs.join(threadId, runId);
  const run = await client.runs.get(threadId, runId);
  const thread = await client.threads.get(threadId);
  const pendingInterrupts = Object.values(thread.interrupts ?? {}).flat();
  const interrupt = pendingInterrupts.at(-1);
  const status = thread.status === "interrupted"
    ? "interrupted"
    : thread.status === "error"
      ? "failed"
      : statusOf(run.status);
  const projection = [
    (run as unknown as { output?: unknown }).output,
    (thread as unknown as { values?: unknown }).values,
  ].map((candidate) => projectionSchema.safeParse(candidate)).find((result) => result.success)?.data;

  return {
    status,
    interrupt: status === "interrupted" ? parseInterrupt(interrupt) : undefined,
    ...projection,
  } satisfies Pick<WorkflowReference, "status" | "interrupt">;
};

const start = async (input: WorkflowInput): Promise<WorkflowReference> => {
  const { client, workflow } = clientFor();
  const memory = {
    householdNamespace: householdMemoryNamespace(input.householdId),
    memberNamespace: memberMemoryNamespace(input.memberId),
  };
  const thread = await client.threads.create({
    threadId: input.workflowId,
    ifExists: "do_nothing",
    metadata: {
      householdId: input.householdId,
      memberId: input.memberId,
      workflowId: input.workflowId,
      source: input.source,
      ...(input.providerSlug ? { providerSlug: input.providerSlug } : {}),
    },
  });
  const run = await existingRun(client, thread.thread_id, input.eventId) ?? await client.runs.create(thread.thread_id, workflow, {
    input: { operation: "workflow.start", ...input, memory },
    metadata: { sourceEventId: input.eventId },
    durability: "sync",
    multitaskStrategy: "enqueue",
  });
  const observed = await observeRun(client, thread.thread_id, run.run_id);
  return { provider: "langgraph", threadId: thread.thread_id, runId: run.run_id, ...observed };
};

const resume = async (input: WorkflowInput & { threadId: string; action: WorkflowAction }): Promise<WorkflowReference> => {
  const { client, workflow } = clientFor();
  const run = await existingRun(client, input.threadId, input.eventId) ?? await client.runs.create(input.threadId, workflow, {
    command: { resume: { eventId: input.eventId, action: input.action } },
    metadata: { sourceEventId: input.eventId },
    durability: "sync",
    multitaskStrategy: "enqueue",
  });
  const observed = await observeRun(client, input.threadId, run.run_id);
  return { provider: "langgraph", threadId: input.threadId, runId: run.run_id, ...observed };
};

export const createAgentLayer = (): AgentLayer => ({ startWorkflow: start, resumeWorkflow: resume });
export const agentLayer = createAgentLayer();
