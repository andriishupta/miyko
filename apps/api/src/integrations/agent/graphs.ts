import { Client } from "@langchain/langgraph-sdk";
import { AppError } from "../../lib/errors.js";
import { requireAgentConfig } from "./agent.config.js";
import type { AgentLayer, WorkflowAction, WorkflowInput, WorkflowReference } from "./agent.port.js";

const clientFor = () => {
  const config = requireAgentConfig();
  return { client: new Client({ apiUrl: config.apiUrl, apiKey: config.apiKey, timeoutMs: 30_000 }), assistantId: config.assistantId };
};

const statusOf = (status: string): WorkflowReference["status"] => {
  if (["pending", "running", "interrupted", "succeeded", "failed", "cancelled"].includes(status)) return status as WorkflowReference["status"];
  if (status === "success") return "succeeded";
  if (status === "error") return "failed";
  throw new AppError("AGENT_INVALID_RESPONSE", "LangGraph Cloud returned an unsupported workflow status", 502);
};

const existingRun = async (client: Client, threadId: string, eventId: string) => {
  const runs = await client.runs.list(threadId, { limit: 100 });
  return runs.find((run) => run.metadata?.sourceEventId === eventId);
};

const start = async (input: WorkflowInput): Promise<WorkflowReference> => {
  const { client, assistantId } = clientFor();
  const thread = await client.threads.create({
    threadId: input.workflowId,
    ifExists: "do_nothing",
    metadata: { householdId: input.householdId, workflowId: input.workflowId },
  });
  const run = await existingRun(client, thread.thread_id, input.eventId) ?? await client.runs.create(thread.thread_id, assistantId, {
    input: { operation: "workflow.start", ...input },
    metadata: { sourceEventId: input.eventId },
    durability: "sync",
    multitaskStrategy: "enqueue",
  });
  return { provider: "langgraph", threadId: thread.thread_id, runId: run.run_id, status: statusOf(run.status) };
};

const resume = async (input: WorkflowInput & { threadId: string; action: WorkflowAction }): Promise<WorkflowReference> => {
  const { client, assistantId } = clientFor();
  const run = await existingRun(client, input.threadId, input.eventId) ?? await client.runs.create(input.threadId, assistantId, {
    command: { resume: { eventId: input.eventId, action: input.action } },
    metadata: { sourceEventId: input.eventId },
    durability: "sync",
    multitaskStrategy: "enqueue",
  });
  return { provider: "langgraph", threadId: input.threadId, runId: run.run_id, status: statusOf(run.status) };
};

export const createAgentLayer = (): AgentLayer => ({ startWorkflow: start, resumeWorkflow: resume });
export const agentLayer = createAgentLayer();
