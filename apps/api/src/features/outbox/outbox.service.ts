import { and, asc, eq, lte, inArray } from 'drizzle-orm'
import { outboxEvents } from '@miyko/database/schema'
import type { OutboxEvent, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'

const toEvent = (row: typeof outboxEvents.$inferSelect): OutboxEvent => ({ id: row.id, householdId: row.householdId, aggregateType: row.aggregateType, aggregateId: row.aggregateId, eventType: row.eventType, version: row.version, status: row.status === 'published' ? 'published' : row.status === 'dead_letter' ? 'dead_letter' : row.status === 'retrying' ? 'retrying' : row.status === 'processing' ? 'processing' : 'pending', attempts: row.attempts, processedAt: row.processedAt?.toISOString() ?? null, lastError: row.lastError, createdAt: row.createdAt.toISOString() })

export class OutboxService {
  async listPending(context: RequestContext) {
    const rows = await db.query.outboxEvents.findMany({ where: and(eq(outboxEvents.householdId, context.household.id), inArray(outboxEvents.status, ['pending', 'retrying']), lte(outboxEvents.availableAt, new Date())), orderBy: [asc(outboxEvents.availableAt)], limit: 100 })
    return rows.map(toEvent)
  }

  async processPending(context: RequestContext) {
    const events = await this.listPending(context)
    for (const event of events) {
      await db.update(outboxEvents).set({ status: 'published', attempts: event.attempts + 1, processedAt: new Date(), updatedAt: new Date() }).where(and(eq(outboxEvents.id, event.id), eq(outboxEvents.householdId, context.household.id)))
    }
    return { processed: events.length, events }
  }
}
export const outboxService = new OutboxService()
