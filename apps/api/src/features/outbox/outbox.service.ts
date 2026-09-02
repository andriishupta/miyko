import { and, desc, eq, inArray } from 'drizzle-orm'
import { outboxEvents } from '@miyko/database/schema'
import type { JsonObject } from '@miyko/database/schema'
import type { OutboxEvent } from '@miyko/contracts'
import { db } from '../../lib/database.js'

const toEvent = (row: typeof outboxEvents.$inferSelect): OutboxEvent => ({
  id: row.id,
  householdId: row.householdId,
  aggregateType: row.aggregateType,
  aggregateId: row.aggregateId,
  eventType: row.eventType,
  version: row.version,
  status: row.status === 'published' ? 'published' : row.status === 'dead_letter' ? 'dead_letter' : row.status === 'retrying' ? 'retrying' : row.status === 'processing' ? 'processing' : 'pending',
  attempts: row.attempts,
  processedAt: row.processedAt?.toISOString() ?? null,
  lastError: row.lastError,
  createdAt: row.createdAt.toISOString(),
})

export type OutboxEnqueueInput = {
  householdId: string
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: JsonObject
  version?: number
}

export type OutboxEventRow = typeof outboxEvents.$inferSelect

export class OutboxService {
  async enqueue(input: OutboxEnqueueInput) {
    const active = await db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.householdId, input.householdId),
        eq(outboxEvents.aggregateType, input.aggregateType),
        eq(outboxEvents.aggregateId, input.aggregateId),
        eq(outboxEvents.eventType, input.eventType),
        inArray(outboxEvents.status, ['pending', 'processing', 'retrying']),
      ),
      orderBy: [desc(outboxEvents.version)],
    })
    if (active) return active

    const latest = await db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.householdId, input.householdId),
        eq(outboxEvents.aggregateType, input.aggregateType),
        eq(outboxEvents.aggregateId, input.aggregateId),
        eq(outboxEvents.eventType, input.eventType),
      ),
      orderBy: [desc(outboxEvents.version)],
    })
    const version = input.version ?? (latest ? latest.version + 1 : 1)
    const rows = await db.insert(outboxEvents).values({
      householdId: input.householdId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      version,
      payload: input.payload,
      status: 'pending',
      availableAt: new Date(),
    }).onConflictDoNothing().returning()
    return rows[0] ?? db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.householdId, input.householdId),
        eq(outboxEvents.aggregateType, input.aggregateType),
        eq(outboxEvents.aggregateId, input.aggregateId),
        eq(outboxEvents.eventType, input.eventType),
        eq(outboxEvents.version, version),
      ),
    })
  }

  async markPublished(eventId: string, householdId: string) {
    const now = new Date()
    await db.update(outboxEvents).set({ status: 'published', processedAt: now, claimedAt: null, claimedBy: null, claimExpiresAt: null, updatedAt: now }).where(and(eq(outboxEvents.id, eventId), eq(outboxEvents.householdId, householdId), eq(outboxEvents.status, 'processing')))
  }

  async markFailed(eventId: string, householdId: string, attempts: number, error: string, maxAttempts: number, backoffMs: number) {
    const now = new Date()
    const terminal = attempts >= maxAttempts
    await db.update(outboxEvents).set({
      status: terminal ? 'dead_letter' : 'retrying',
      availableAt: terminal ? now : new Date(now.getTime() + backoffMs),
      processedAt: terminal ? now : null,
      lastError: error,
      claimedAt: null,
      claimedBy: null,
      claimExpiresAt: null,
      updatedAt: now,
    }).where(and(eq(outboxEvents.id, eventId), eq(outboxEvents.householdId, householdId), eq(outboxEvents.status, 'processing')))
  }
}

export const outboxService = new OutboxService()
