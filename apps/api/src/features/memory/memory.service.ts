import { forbidden } from '../../lib/errors.js'
import { memories, outbox } from '../../lib/mock-store.js'
import type { Memory, RequestContext } from '../../lib/types.js'

export class MemoryService {
  read(context: RequestContext, memberId?: string, runId?: string) {
    if (memberId && memberId !== context.user.id && context.membership.role !== 'owner') throw forbidden()
    return memories.filter((memory) => memory.householdId === context.household.id && (!memory.memberId || memory.memberId === context.user.id || context.membership.role === 'owner') && (!memberId || memory.memberId === memberId) && (!runId || memory.runId === runId))
  }

  write(context: RequestContext, input: { text: string; memberId?: string | null; runId?: string | null; source: Memory['source']; confirmed?: boolean }) {
    if (input.memberId && input.memberId !== context.user.id && context.membership.role !== 'owner') throw forbidden()
    const memory: Memory = { id: `memory-${Date.now()}`, householdId: context.household.id, memberId: input.memberId ?? null, runId: input.runId ?? null, text: input.text, source: input.source, confirmed: input.confirmed ?? false, createdAt: new Date().toISOString() }
    memories.push(memory)
    return memory
  }

  feedback(context: RequestContext, input: { proposalId?: string | null; text: string; sufficient?: boolean; unusedProducts?: string[] }) {
    const memory = this.write(context, { text: input.text, source: 'feedback', confirmed: false })
    outbox.push({ id: `outbox-${Date.now()}`, householdId: context.household.id, type: 'feedback.created', aggregateId: input.proposalId ?? memory.id, status: 'pending', attempts: 0, lastError: null, processedAt: null, createdAt: new Date().toISOString() })
    return { memory, followUpScheduled: true }
  }
}
export const memoryService = new MemoryService()
