import { z } from "zod";
import { createWorkflowSchema, workflowActionSchema } from "@miyko/contracts/schemas";
export { createWorkflowSchema, workflowActionSchema };

export const workflowIdSchema = z.object({ workflowId: z.string().uuid() }).strict();
