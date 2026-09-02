import type { RequestContext, WorkflowAction } from "@miyko/contracts";
import { forbidden } from "../../lib/errors.js";

export const requireWorkflowActionAccess = (context: RequestContext, action: WorkflowAction): void => {
  if ((action.type === "approve" || action.type === "decline") && context.membership.role !== "owner") throw forbidden();
};
