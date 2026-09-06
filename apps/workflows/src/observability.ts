import { createMiddleware } from "langchain";

type LogFields = Record<string, string | number | boolean | null | undefined>;

export const workflowLog = (event: string, fields: LogFields = {}) => {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), service: "miyko-workflows", event, ...fields }));
};

export const workflowError = (event: string, error: unknown, fields: LogFields = {}) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "miyko-workflows",
    event,
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...fields,
  }));
};

export const localAgentLogging = (fields: { workflowId: string; eventId: string; operation: string; model: string }) =>
  createMiddleware({
    name: "local-agent-logging",
    async wrapModelCall(request, handler) {
      const startedAt = Date.now();
      workflowLog("openai.request.started", fields);
      try {
        const response = await handler(request);
        workflowLog("openai.request.completed", { ...fields, durationMs: Date.now() - startedAt });
        return response;
      } catch (error) {
        workflowError("openai.request.failed", error, { ...fields, durationMs: Date.now() - startedAt });
        throw error;
      }
    },
    async wrapToolCall(request, handler) {
      const startedAt = Date.now();
      const tool = request.toolCall.name;
      workflowLog("silpo.mcp.tool.started", { ...fields, tool });
      try {
        const response = await handler(request);
        workflowLog("silpo.mcp.tool.completed", { ...fields, tool, durationMs: Date.now() - startedAt });
        return response;
      } catch (error) {
        workflowError("silpo.mcp.tool.failed", error, { ...fields, tool, durationMs: Date.now() - startedAt });
        throw error;
      }
    },
  });
