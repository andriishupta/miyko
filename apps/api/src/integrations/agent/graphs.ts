import { randomUUID } from 'node:crypto'
import { Annotation, END, MemorySaver, StateGraph, START } from '@langchain/langgraph'
import { z } from 'zod'
import { mem0Client } from '../memory/mem0.client.js'
import type { MemoryProvider } from '../memory/memory.port.js'
import { openAiClient } from './openai.client.js'
import type { AgentLayer, AgentModel } from './agent.port.js'

const preferenceSchema = z.object({ summary: z.string().min(1).max(2000), preferences: z.array(z.string().min(1).max(240)).max(50) }).strict()
const classificationSchema = z.object({ type: z.enum(['meal_planning', 'shopping', 'feedback', 'other']), summary: z.string().min(1).max(500), confidence: z.number().min(0).max(1) }).strict()
const planSchema = z.object({ title: z.string().min(1).max(120), meals: z.array(z.object({ name: z.string().min(1).max(160), ingredients: z.array(z.string().min(1).max(160)).max(30) }).strict()).min(1).max(14) }).strict()

const MemoryState = Annotation.Root({
  namespace: Annotation<string>(),
  receipts: Annotation<unknown[]>({ default: () => [] }),
  normalizedReceipts: Annotation<string>({ default: () => '' }),
  analysis: Annotation<z.infer<typeof preferenceSchema> | null>({ default: () => null }),
  memoryId: Annotation<string | null>({ default: () => null }),
})

const FoodState = Annotation.Root({
  text: Annotation<string>(),
  namespace: Annotation<string>(),
  classification: Annotation<z.infer<typeof classificationSchema> | null>({ default: () => null }),
  memory: Annotation<unknown[]>({ default: () => [] }),
  providerHistory: Annotation<unknown[]>({ default: () => [] }),
  plan: Annotation<z.infer<typeof planSchema> | null>({ default: () => null }),
  products: Annotation<unknown[]>({ default: () => [] }),
})

const createMemoryGraph = (memoryProvider: MemoryProvider, model: AgentModel) => new StateGraph(MemoryState)
  .addNode('load_receipts', async (state) => ({ normalizedReceipts: JSON.stringify(state.receipts.slice(0, 100)) }))
  .addNode('analyze_preferences', async (state) => ({ analysis: await model.json([
    { role: 'system', content: 'Analyze grocery receipts. Return only JSON with summary and concise preference strings. Do not include secrets or raw receipt payloads.' },
    { role: 'user', content: state.normalizedReceipts },
  ], preferenceSchema) }))
  .addNode('write_memory', async (state) => ({ memoryId: state.analysis ? (state.memoryId ? (await memoryProvider.update(state.namespace, state.memoryId, state.analysis.summary), state.memoryId) : await memoryProvider.add(state.namespace, state.analysis.summary, { source: 'receipt_initialization', scope: 'member' })) : null }))
  .addEdge(START, 'load_receipts')
  .addEdge('load_receipts', 'analyze_preferences')
  .addEdge('analyze_preferences', 'write_memory')
  .addEdge('write_memory', END)
  .compile({ checkpointer: new MemorySaver() })

const createFoodGraph = (memoryProvider: MemoryProvider, model: AgentModel, searchProducts: ((query: string) => Promise<unknown[]>) | null) => new StateGraph(FoodState)
  .addNode('classify_request', async (state) => ({ classification: await model.json([
    { role: 'system', content: 'Classify a household food request. Return only JSON with type, summary and confidence.' },
    { role: 'user', content: state.text },
  ], classificationSchema) }))
  .addNode('load_memory', async (state) => ({ memory: await memoryProvider.search(state.namespace, state.text, 20) }))
  .addNode('load_provider_history', async (state) => ({ providerHistory: state.providerHistory.slice(0, 100) }))
  .addNode('plan_meals', async (state) => ({ plan: await model.json([
    { role: 'system', content: 'Plan meals using the supplied household context. Return only JSON with title and meals. Do not mutate a basket.' },
    { role: 'user', content: JSON.stringify({ request: state.text, classification: state.classification, memory: state.memory, providerHistory: state.providerHistory }) },
  ], planSchema) }))
  .addNode('search_products', async (state) => ({ products: state.plan && searchProducts ? (await Promise.all(state.plan.meals.flatMap((meal) => meal.ingredients).map((ingredient) => searchProducts(ingredient)))).flat() : [] }))
  .addNode('create_proposal', async (state) => ({ plan: state.plan }))
  .addEdge(START, 'classify_request')
  .addEdge('classify_request', 'load_memory')
  .addEdge('load_memory', 'load_provider_history')
  .addEdge('load_provider_history', 'plan_meals')
  .addEdge('plan_meals', 'search_products')
  .addEdge('search_products', 'create_proposal')
  .addEdge('create_proposal', END)
  .compile({ checkpointer: new MemorySaver() })

export const createAgentLayer = ({ memoryProvider = mem0Client, model = openAiClient }: { memoryProvider?: MemoryProvider; model?: AgentModel } = {}): AgentLayer => {
  const memoryGraph = createMemoryGraph(memoryProvider, model)
  return {
    async initializeMemory(input) {
      const threadId = `memory:${randomUUID()}`
      const result = await memoryGraph.invoke(input, { configurable: { thread_id: threadId } })
      return { threadId, runId: randomUUID(), memoryId: result.memoryId, analysis: result.analysis }
    },

    async foodIntent(input) {
      const threadId = `food:${randomUUID()}`
      const { searchProducts, ...state } = input
      const result = await createFoodGraph(memoryProvider, model, searchProducts).invoke(state, { configurable: { thread_id: threadId } })
      return { threadId, runId: randomUUID(), classification: result.classification, plan: result.plan, products: result.products }
    },
  }
}

export const agentLayer = createAgentLayer()
