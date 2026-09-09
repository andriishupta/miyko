import { and, eq } from "drizzle-orm";
import { auditLogs, workflowApprovals, workflows } from "@miyko/database/schema";
import type { RequestContext } from "@miyko/contracts";
import { db } from "../../lib/database.js";
import { AppError, notFound } from "../../lib/errors.js";
import { agentLayer } from "../../integrations/agent/graphs.js";
import { storeProviderService } from "../../integrations/store-providers/store-provider.service.js";
import type { WorkflowReference } from "../../integrations/agent/agent.port.js";
import type { OutboxEventRow } from "./outbox.service.js";
import { z } from "zod";
import { workflowActionSchema } from "@miyko/contracts/schemas";

const inputSchema = z.object({ text: z.string().min(1).max(2_000), source: z.enum(["text", "audio"]), providerSlug: z.string().min(1).optional() }).strict();
const startedPayload = z.object({ workflowId: z.string().uuid(), requestedByMemberId: z.string().uuid(), input: inputSchema }).strict();
const actionPayload = z.object({ workflowId: z.string().uuid(), requestedByMemberId: z.string().uuid(), idempotencyKey: z.string().min(1).max(255), action: z.record(z.unknown()) }).strict();

const payloadOf = <T>(event: OutboxEventRow, schema: z.ZodType<T>) => {
  const parsed = schema.safeParse(event.payload);
  if (!parsed.success) throw new AppError("OUTBOX_INVALID_PAYLOAD", "Outbox event payload is invalid", 422);
  return parsed.data;
};

const requireEventActor = (context: RequestContext, requestedByMemberId: string) => {
  if (context.membership.id !== requestedByMemberId) throw new AppError("OUTBOX_ACTOR_UNAVAILABLE", "Workflow actor is no longer an active household member", 403);
};

const audit = async (context: RequestContext, event: OutboxEventRow, action: string) => {
  const existing = await db.query.auditLogs.findFirst({ where: and(eq(auditLogs.householdId, context.household.id), eq(auditLogs.aggregateId, event.aggregateId), eq(auditLogs.action, action)) });
  if (!existing) await db.insert(auditLogs).values({ householdId: context.household.id, actorMemberId: context.membership.id, action, aggregateType: event.aggregateType, aggregateId: event.aggregateId, metadata: { sourceEventId: event.id } });
};

const updateReference = async (context: RequestContext, workflowId: string, reference: WorkflowReference) => {
  await db.update(workflows).set({
    runId: reference.runId,
    status: reference.status,
    ...(reference.providerBasketId !== undefined ? { providerBasketId: reference.providerBasketId } : {}),
    ...(reference.providerOrderId !== undefined ? { providerOrderId: reference.providerOrderId } : {}),
    ...(reference.fulfillmentMode !== undefined ? { fulfillmentMode: reference.fulfillmentMode } : {}),
    ...(reference.scheduledFrom !== undefined ? { scheduledFrom: reference.scheduledFrom ? new Date(reference.scheduledFrom) : null } : {}),
    ...(reference.scheduledTo !== undefined ? { scheduledTo: reference.scheduledTo ? new Date(reference.scheduledTo) : null } : {}),
    updatedAt: new Date(),
  }).where(and(eq(workflows.id, workflowId), eq(workflows.householdId, context.household.id)));
};

const recordInterrupt = async (context: RequestContext, workflowId: string, requestedByMemberId: string, reference: WorkflowReference) => {
  if (!reference.interrupt) return;
  const existing = reference.interrupt.externalRequestId
    ? await db.query.workflowApprovals.findFirst({
        where: and(eq(workflowApprovals.workflowId, workflowId), eq(workflowApprovals.externalRequestId, reference.interrupt.externalRequestId)),
      })
    : await db.query.workflowApprovals.findFirst({
        where: and(eq(workflowApprovals.workflowId, workflowId), eq(workflowApprovals.action, reference.interrupt.action), eq(workflowApprovals.status, "pending")),
      });
  if (existing) return;
  await db.insert(workflowApprovals).values({
    householdId: context.household.id,
    workflowId,
    requestedByMemberId,
    externalRequestId: reference.interrupt.externalRequestId,
    action: reference.interrupt.action,
    status: "pending",
  });
};

export type OutboxHandler = (context: RequestContext, event: OutboxEventRow) => Promise<void>;

export const outboxHandlers: Record<string, OutboxHandler> = {
  async "workflow.started"(context, event) {
    const payload = payloadOf(event, startedPayload);
    requireEventActor(context, payload.requestedByMemberId);
    const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, payload.workflowId), eq(workflows.householdId, context.household.id)), with: { provider: true } });
    if (!workflow) throw notFound("Workflow");
    const providerSlug = payload.input.providerSlug ?? workflow.provider?.slug;
    if (!providerSlug) throw new AppError("WORKFLOW_PROVIDER_MISSING", "Workflow provider is missing", 409);
    const providerAccessToken = await storeProviderService.getAccessToken(context, providerSlug);
    const reference = await agentLayer.startWorkflow({ workflowId: workflow.id, workflowKind: workflow.workflowKind, householdId: workflow.householdId, memberId: payload.requestedByMemberId, memberRole: context.membership.role, text: payload.input.text, providerSlug, providerAccessToken, source: payload.input.source, eventId: event.id });
    await updateReference(context, workflow.id, reference);
    await recordInterrupt(context, workflow.id, payload.requestedByMemberId, reference);
    await audit(context, event, "workflow.started");
  },

  async "workflow.action_requested"(context, event) {
    const payload = payloadOf(event, actionPayload);
    requireEventActor(context, payload.requestedByMemberId);
    const action = workflowActionSchema.parse(payload.action);
    const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, payload.workflowId), eq(workflows.householdId, context.household.id)), with: { provider: true } });
    if (!workflow) throw notFound("Workflow");
    if (!workflow.threadId) throw new AppError("WORKFLOW_REFERENCE_MISSING", "Workflow thread reference is missing", 409);
    if (!workflow.provider?.slug) throw new AppError("WORKFLOW_PROVIDER_MISSING", "Workflow provider is missing", 409);
    const providerAccessToken = await storeProviderService.getAccessToken(context, workflow.provider.slug);
    const reference = await agentLayer.resumeWorkflow({ workflowId: workflow.id, workflowKind: workflow.workflowKind, householdId: workflow.householdId, memberId: payload.requestedByMemberId, memberRole: context.membership.role, text: "resume", providerSlug: workflow.provider.slug, providerAccessToken, source: "text", eventId: event.id, threadId: workflow.threadId, action });
    await updateReference(context, workflow.id, reference);
    await recordInterrupt(context, workflow.id, payload.requestedByMemberId, reference);
    await audit(context, event, `workflow.action.${action.type}`);
  },
};
