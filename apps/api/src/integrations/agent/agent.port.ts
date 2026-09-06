import type { HouseholdRole, WorkflowAction as ContractWorkflowAction, WorkflowKind, WorkflowReference as ContractWorkflowReference, WorkflowView } from "@miyko/contracts";

export type WorkflowAction = ContractWorkflowAction;
export type WorkflowInterrupt = {
  externalRequestId: string | null;
  action: "provider_action" | "fulfillment" | "delivery_slot";
};

export type WorkflowReference = ContractWorkflowReference & {
  interrupt?: WorkflowInterrupt;
  providerBasketId?: string | null;
  providerOrderId?: string | null;
  fulfillmentMode?: "pickup" | "delivery" | null;
  scheduledFrom?: string | null;
  scheduledTo?: string | null;
};

export type WorkflowInput = {
  workflowId: string;
  workflowKind: WorkflowKind;
  householdId: string;
  memberId: string;
  memberRole: HouseholdRole;
  text: string;
  providerSlug?: string;
  providerAccessToken: string;
  source: "text" | "audio";
  eventId: string;
};

export interface AgentLayer {
  startWorkflow(input: WorkflowInput): Promise<WorkflowReference>;
  resumeWorkflow(input: WorkflowInput & { threadId: string; action: WorkflowAction }): Promise<WorkflowReference>;
  getWorkflowView(input: { workflowKind: WorkflowKind; threadId: string }): Promise<WorkflowView>;
}
