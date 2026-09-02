import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { outboxEvents, workflowApprovals, workflows } from "@miyko/database/schema";
import type { RequestContext, Workflow, WorkflowAction, WorkflowApproval } from "@miyko/contracts";
import { db } from "../../lib/database.js";
import { conflict, forbidden, notFound } from "../../lib/errors.js";
import { storeProviderService } from "../../integrations/store-providers/store-provider.service.js";
import { outboxService } from "../outbox/outbox.service.js";

type WorkflowRow = typeof workflows.$inferSelect;
type ApprovalRow = typeof workflowApprovals.$inferSelect;

const toApproval = (row: ApprovalRow): WorkflowApproval => ({
  id: row.id,
  workflowId: row.workflowId,
  requestedByMemberId: row.requestedByMemberId,
  externalRequestId: row.externalRequestId,
  action: row.action,
  status: row.status,
  decidedByMemberId: row.decidedByMemberId,
  decidedAt: row.decidedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const toWorkflow = (row: WorkflowRow & { approvals?: ApprovalRow[] }): Workflow => ({
  id: row.id,
  householdId: row.householdId,
  startedByMemberId: row.startedByMemberId,
  providerId: row.providerId,
  status: row.status,
  workflowProvider: "langgraph",
  threadId: row.threadId,
  runId: row.runId,
  providerBasketId: row.providerBasketId,
  providerOrderId: row.providerOrderId,
  fulfillmentMode: row.fulfillmentMode,
  scheduledFrom: row.scheduledFrom?.toISOString() ?? null,
  scheduledTo: row.scheduledTo?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  approvals: (row.approvals ?? []).map(toApproval),
});

type ApprovalRequest = Exclude<WorkflowAction, { type: "approve" } | { type: "decline" }>;

const approvalAction = (action: ApprovalRequest): WorkflowApproval["action"] => {
  if (action.type === "provider_action") return "provider_action";
  if (action.type === "fulfillment_selected") return "fulfillment";
  return "delivery_slot";
};

export class WorkflowsService {
  async create(context: RequestContext, input: { text: string; providerSlug?: string; source?: "text" | "audio" }) {
    const provider = await storeProviderService.findActiveProvider(context, input.providerSlug);
    const workflowId = randomUUID();
    const rows = await db.insert(workflows).values({
      id: workflowId,
      householdId: context.household.id,
      startedByMemberId: context.membership.id,
      providerId: provider.id,
      status: "pending",
      threadId: workflowId,
    }).returning();
    const workflow = rows[0];
    if (!workflow) throw new Error("Workflow could not be created");
    await outboxService.enqueue({ householdId: context.household.id, aggregateType: "workflow", aggregateId: workflow.id, eventType: "workflow.started", payload: { workflowId: workflow.id, requestedByMemberId: context.membership.id, input: { text: input.text, source: input.source ?? "text", providerSlug: input.providerSlug } } });
    return toWorkflow({ ...workflow, approvals: [] });
  }

  async list(context: RequestContext) {
    const rows = await db.query.workflows.findMany({ where: eq(workflows.householdId, context.household.id), with: { approvals: true }, orderBy: [desc(workflows.updatedAt)], limit: 50 });
    return rows.map(toWorkflow);
  }

  async get(context: RequestContext, workflowId: string) {
    const row = await db.query.workflows.findFirst({ where: and(eq(workflows.id, workflowId), eq(workflows.householdId, context.household.id)), with: { approvals: true } });
    if (!row) throw notFound("Workflow");
    return toWorkflow(row);
  }

  async requestAction(context: RequestContext, workflowId: string, action: WorkflowAction) {
    const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, workflowId), eq(workflows.householdId, context.household.id)) });
    if (!workflow) throw notFound("Workflow");
    if (["succeeded", "failed", "cancelled"].includes(workflow.status)) throw conflict("Workflow is already closed");
    if (["approve", "decline"].includes(action.type) && context.membership.role !== "owner") throw forbidden();

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const pending = await tx.query.workflowApprovals.findFirst({ where: and(eq(workflowApprovals.workflowId, workflow.id), eq(workflowApprovals.status, "pending")), orderBy: [desc(workflowApprovals.createdAt)] });

      if (action.type === "approve" || action.type === "decline") {
        if (!pending) throw notFound("Pending workflow approval");
        await tx.update(workflowApprovals).set({ status: action.type === "approve" ? "approved" : "declined", decidedByMemberId: context.membership.id, decidedAt: now, updatedAt: now }).where(eq(workflowApprovals.id, pending.id));
      } else {
        await tx.insert(workflowApprovals).values({ householdId: workflow.householdId, workflowId: workflow.id, requestedByMemberId: context.membership.id, externalRequestId: action.type === "provider_action" ? action.requestId ?? null : null, action: approvalAction(action), status: "pending" });
      }

      const updates: Partial<WorkflowRow> = { updatedAt: now };
      if (action.type === "fulfillment_selected") updates.fulfillmentMode = action.mode;
      if (action.type === "delivery_slot_selected") { updates.scheduledFrom = new Date(action.scheduledFrom); updates.scheduledTo = new Date(action.scheduledTo); }
      const updated = await tx.update(workflows).set(updates).where(eq(workflows.id, workflow.id)).returning();
      const latestEvent = await tx.query.outboxEvents.findFirst({ where: and(eq(outboxEvents.aggregateType, "workflow"), eq(outboxEvents.aggregateId, workflow.id), eq(outboxEvents.eventType, "workflow.action_requested")), orderBy: [desc(outboxEvents.version)] });
      await tx.insert(outboxEvents).values({ householdId: workflow.householdId, aggregateType: "workflow", aggregateId: workflow.id, eventType: "workflow.action_requested", version: (latestEvent?.version ?? 0) + 1, payload: { workflowId: workflow.id, requestedByMemberId: context.membership.id, action } });
      return updated[0];
    });
    if (!result) throw notFound("Workflow");
    return this.get(context, workflow.id);
  }
}

export const workflowsService = new WorkflowsService();
