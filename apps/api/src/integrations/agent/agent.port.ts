import type { WorkflowAction as ContractWorkflowAction, WorkflowReference as ContractWorkflowReference } from "@miyko/contracts";

export type WorkflowAction = ContractWorkflowAction;
export type WorkflowInterrupt = {
  externalRequestId: string | null;
  action: "provider_action" | "fulfillment" | "delivery_slot";
};

export type WorkflowReference = ContractWorkflowReference & {
  interrupt?: WorkflowInterrupt;
};

export type WorkflowInput = {
  workflowId: string;
  householdId: string;
  memberId: string;
  text: string;
  providerSlug?: string;
  source: "text" | "audio";
  eventId: string;
};

export interface AgentLayer {
  startWorkflow(input: WorkflowInput): Promise<WorkflowReference>;
  resumeWorkflow(input: WorkflowInput & { threadId: string; action: WorkflowAction }): Promise<WorkflowReference>;
}
