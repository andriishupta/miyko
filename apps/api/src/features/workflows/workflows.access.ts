import type { RequestContext, WorkflowAction } from "@miyko/contracts";
import { forbidden } from "../../lib/errors.js";

export const requireWorkflowActionAccess = (context: RequestContext, action: WorkflowAction): void => {
  if ((action.type === "approve" || action.type === "decline" || action.type === "confirm_basket") && !["owner", "admin"].includes(context.membership.role)) throw forbidden();
};
