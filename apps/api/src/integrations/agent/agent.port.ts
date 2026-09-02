import type { WorkflowAction as ContractWorkflowAction, WorkflowReference as ContractWorkflowReference } from "@miyko/contracts";

export type WorkflowAction = ContractWorkflowAction;
export type WorkflowReference = ContractWorkflowReference;

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
