import MemoryClient from 'mem0ai'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import type { MemoryProvider } from './memory.port.js'

type MemoryMessage = { role: 'user' | 'assistant' | 'system'; content: string }
type MemoryOptions = { userId: string; metadata?: Record<string, string> }

type Mem0Api = {
  add(messages: string | MemoryMessage[], options: MemoryOptions): Promise<unknown>
  search(query: string, options: { filters: { user_id: string }; topK?: number }): Promise<unknown>
  update(memoryId: string, content: string): Promise<unknown>
}

const memoryIdSchema = z.object({ id: z.string().min(1) }).passthrough()
const memoryResultSchema = z.union([memoryIdSchema, z.array(memoryIdSchema).min(1), z.object({ results: z.array(memoryIdSchema).min(1) }).passthrough()])

const client = (): Mem0Api => {
  const apiKey = process.env.MEM0_API_KEY
  if (!apiKey) throw new AppError('MEM0_API_KEY_REQUIRED', 'Mem0 is not configured', 503)
  return new MemoryClient({ apiKey }) as unknown as Mem0Api
}

export const mem0Client: MemoryProvider = {
  async add(namespace: string, content: string, metadata: Record<string, string>) {
    const result = await client().add([{ role: 'user', content }], { userId: namespace, metadata: { ...metadata, namespace } })
    const parsed = memoryResultSchema.safeParse(result)
    if (!parsed.success) throw new AppError('MEM0_INVALID_RESPONSE', 'Mem0 returned an invalid response', 502)
    if (Array.isArray(parsed.data)) return parsed.data[0].id
    if ('results' in parsed.data) return parsed.data.results[0].id
    return parsed.data.id
  },

  async search(namespace: string, query: string, limit = 20) {
    const result = await client().search(query, { filters: { user_id: namespace }, topK: limit })
    if (Array.isArray(result)) return result
    if (result && typeof result === 'object' && 'results' in result && Array.isArray(result.results)) return result.results
    throw new AppError('MEM0_INVALID_RESPONSE', 'Mem0 returned an invalid response', 502)
  },

  async update(memoryId: string, content: string) {
    const result = await client().update(memoryId, content)
    if (!result || typeof result !== 'object') throw new AppError('MEM0_INVALID_RESPONSE', 'Mem0 returned an invalid response', 502)
  },
}
