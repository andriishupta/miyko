import { Client } from '@langchain/langgraph-sdk'
import { z } from 'zod'
import { mem0Client } from '../memory/mem0.client.js'
import type { MemoryProvider } from '../memory/memory.port.js'
import { AppError } from '../../lib/errors.js'
import { requireAgentConfig } from './agent.config.js'
import type { AgentLayer } from './agent.port.js'

const preferenceSchema = z.object({ summary: z.string().min(1).max(2000), preferences: z.array(z.string().min(1).max(240)).max(50) }).strict()
const classificationSchema = z.object({ type: z.enum(['meal_planning', 'shopping', 'feedback', 'other']), summary: z.string().min(1).max(500), confidence: z.number().min(0).max(1) }).strict()
const planSchema = z.object({ title: z.string().min(1).max(120), meals: z.array(z.object({ name: z.string().min(1).max(160), ingredients: z.array(z.string().min(1).max(160)).max(30) }).strict()).min(1).max(14) }).strict()
const foodIntentSchema = z.object({ classification: classificationSchema, plan: planSchema, productQueries: z.array(z.string().min(1).max(160)).max(50).default([]) }).passthrough()
const memoryResultSchema = z.object({ analysis: preferenceSchema }).passthrough()

const managedClient = () => {
  const config = requireAgentConfig()
  return { client: new Client({ apiUrl: config.apiUrl, apiKey: config.apiKey, timeoutMs: 30_000 }), assistantId: config.assistantId }
}

const waitForResult = async (operation: string, input: Record<string, unknown>) => {
  const { client, assistantId } = managedClient()
  const thread = await client.threads.create({ metadata: { operation } })
  let runId = ''
  const values = await client.runs.wait(thread.thread_id, assistantId, { input: { operation, ...input }, durability: 'sync', onRunCreated: ({ run_id }) => { runId = run_id } })
  if (!runId) throw new AppError('AGENT_INVALID_RESPONSE', 'LangGraph Cloud did not return a run identifier', 502)
  return { threadId: thread.thread_id, runId, values }
}

export const createAgentLayer = ({ memoryProvider = mem0Client }: { memoryProvider?: MemoryProvider } = {}): AgentLayer => {
  return {
    async initializeMemory(input) {
      const graph = await waitForResult('memory.initialize', { receipts: input.receipts.slice(0, 100) })
      const parsed = memoryResultSchema.safeParse(graph.values)
      if (!parsed.success) throw new AppError('AGENT_INVALID_RESPONSE', 'LangGraph Cloud returned invalid memory analysis', 502)
      const analysis = parsed.data.analysis
      const memoryId = input.memoryId
        ? (await memoryProvider.update(input.memoryId, analysis.summary), input.memoryId)
        : await memoryProvider.add(input.namespace, analysis.summary, { source: 'receipt_initialization', scope: 'member' })
      return { threadId: graph.threadId, runId: graph.runId, memoryId, analysis }
    },

    async foodIntent(input) {
      const memory = await memoryProvider.search(input.namespace, input.text, 20)
      const graph = await waitForResult('food.plan', { text: input.text, memory, providerHistory: input.providerHistory.slice(0, 100) })
      const parsed = foodIntentSchema.safeParse(graph.values)
      if (!parsed.success) throw new AppError('AGENT_INVALID_RESPONSE', 'LangGraph Cloud returned an invalid food plan', 502)
      return { threadId: graph.threadId, runId: graph.runId, ...parsed.data }
    },

    async startOrderWorkflow(input) {
      const { client, assistantId } = managedClient()
      const thread = await client.threads.create({ metadata: { householdId: input.householdId, proposalId: input.proposalId } })
      const run = await client.runs.create(thread.thread_id, assistantId, { input: { operation: 'order.start', ...input }, durability: 'sync', multitaskStrategy: 'enqueue' })
      return { provider: 'langgraph', threadId: thread.thread_id, runId: run.run_id, status: run.status }
    },

    async resumeOrderWorkflow(input) {
      const { client, assistantId } = managedClient()
      const run = await client.runs.create(input.threadId, assistantId, { command: { resume: { eventId: input.eventId, decision: input.decision } }, durability: 'sync', multitaskStrategy: 'enqueue' })
      return { provider: 'langgraph', threadId: input.threadId, runId: run.run_id, status: run.status }
    },
  }
}

export const agentLayer = createAgentLayer()
