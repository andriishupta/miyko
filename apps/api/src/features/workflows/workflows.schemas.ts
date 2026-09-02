import { z } from "zod";
export { createWorkflowSchema, workflowActionSchema } from "@miyko/contracts/schemas";

export const workflowIdSchema = z.object({ workflowId: z.string().uuid() }).strict();
