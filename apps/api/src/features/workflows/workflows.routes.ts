import { Hono } from "hono";
import { parseJson, parseParams } from "../../middleware/validation.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { AppError } from "../../lib/errors.js";
import { createWorkflowSchema, workflowActionSchema, workflowIdSchema } from "./workflows.schemas.js";
import { workflowsService } from "./workflows.service.js";

export const workflowsRoutes = new Hono();

workflowsRoutes.get("/", async (c) => c.json({ data: await workflowsService.list(c.get("requestContext")) }));
workflowsRoutes.post("/", rateLimit("workflow-create", 20, 60_000), async (c) => c.json({ data: { workflow: await workflowsService.create(c.get("requestContext"), await parseJson(c, createWorkflowSchema)) } }, 201));
workflowsRoutes.get("/:workflowId", async (c) => {
  const { workflowId } = parseParams(c, workflowIdSchema);
  return c.json({ data: { workflow: await workflowsService.get(c.get("requestContext"), workflowId) } });
});
workflowsRoutes.post("/:workflowId/actions", rateLimit("workflow-action", 60, 60_000), async (c) => {
  const { workflowId } = parseParams(c, workflowIdSchema);
  const idempotencyKey = c.req.header("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) throw new AppError("IDEMPOTENCY_KEY_INVALID", "A valid Idempotency-Key is required for workflow actions", 400);
  return c.json({ data: { workflow: await workflowsService.requestAction(c.get("requestContext"), workflowId, await parseJson(c, workflowActionSchema), idempotencyKey) } });
});
