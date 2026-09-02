import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { feedback, householdMembers, mealPlanItems, memoryInitializations, memorySyncRecords, orders, outboxEvents, planningRuns } from '@miyko/database/schema'
import type { FeedbackRequest, MemoryInitializationStatusResponse, MemoryReference, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { toContractFeedback } from '../../lib/serializers.js'
import { mem0Client } from '../../integrations/memory/mem0.client.js'

const toMemoryReference = (row: typeof memorySyncRecords.$inferSelect): MemoryReference => ({ id: row.id, householdId: row.householdId, memberId: row.memberId, planningRunId: row.planningRunId, scope: row.scope, namespace: row.namespace, externalMemoryId: row.externalMemoryId, lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null })

const toInitializationStatus = (row: typeof memoryInitializations.$inferSelect): MemoryInitializationStatusResponse => ({
  id: row.id,
  userId: row.userId,
  householdId: row.householdId,
  memberId: row.memberId,
  providerAccountId: row.providerAccountId,
  status: row.status,
  requestedAt: row.requestedAt.toISOString(),
  startedAt: row.startedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  lastError: row.lastError,
})

export class MemoryService {
  async status(context: RequestContext): Promise<MemoryInitializationStatusResponse | null> {
    const row = await db.query.memoryInitializations.findFirst({
      where: and(eq(memoryInitializations.userId, context.user.id), eq(memoryInitializations.householdId, context.household.id)),
      orderBy: [desc(memoryInitializations.requestedAt), desc(memoryInitializations.createdAt)],
    })
    return row ? toInitializationStatus(row) : null
  }

  async read(context: RequestContext, memberId?: string, runId?: string) {
    if (memberId && memberId !== context.membership.id && context.membership.role !== 'owner' && context.membership.role !== 'admin') throw forbidden()
    const visibility = context.membership.role === 'owner' || context.membership.role === 'admin' ? undefined : or(isNull(memorySyncRecords.memberId), eq(memorySyncRecords.memberId, context.membership.id))
    const rows = await db.query.memorySyncRecords.findMany({ where: and(eq(memorySyncRecords.householdId, context.household.id), visibility, memberId ? eq(memorySyncRecords.memberId, memberId) : undefined, runId ? eq(memorySyncRecords.planningRunId, runId) : undefined) })
    return rows.map(toMemoryReference)
  }

  async write(context: RequestContext, input: { text: string; memberId?: string | null; runId?: string | null; source: 'feedback' | 'audio' | 'order'; confirmed?: boolean }) {
    if (input.memberId && input.memberId !== context.membership.id && context.membership.role !== 'owner' && context.membership.role !== 'admin') throw forbidden()
    if (input.memberId) {
      const member = await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, input.memberId), eq(householdMembers.householdId, context.household.id), eq(householdMembers.status, 'active')) })
      if (!member) throw notFound('Household member')
    }
    if (input.runId) {
      const run = await db.query.planningRuns.findFirst({ where: and(eq(planningRuns.id, input.runId), eq(planningRuns.householdId, context.household.id)) })
      if (!run) throw notFound('Planning run')
    }
    const scope = input.runId ? 'planning_run' : input.memberId ? 'member' : 'household'
    const namespace = input.runId ? `run:${input.runId}` : input.memberId ? `member:${input.memberId}` : `household:${context.household.id}`
    const existing = await db.query.memorySyncRecords.findFirst({ where: and(eq(memorySyncRecords.householdId, context.household.id), eq(memorySyncRecords.namespace, namespace)) })
    const metadata = { source: input.source, confirmed: String(input.confirmed ?? false) }
    const externalMemoryId = existing?.externalMemoryId
      ? (await mem0Client.update(existing.externalMemoryId, input.text), existing.externalMemoryId)
      : await mem0Client.add(namespace, input.text, metadata)
    const row = await db.insert(memorySyncRecords).values({ householdId: context.household.id, memberId: scope === 'member' ? input.memberId : null, planningRunId: scope === 'planning_run' ? input.runId : null, scope, namespace, externalMemoryId, metadata }).onConflictDoUpdate({ target: memorySyncRecords.namespace, set: { externalMemoryId, metadata, lastSyncedAt: new Date(), updatedAt: new Date() } }).returning()
    return toMemoryReference(row[0])
  }

  async search(context: RequestContext, query: string, memberId?: string) {
    if (memberId && memberId !== context.membership.id && context.membership.role !== 'owner' && context.membership.role !== 'admin') throw forbidden()
    const namespace = memberId ? `member:${memberId}` : `household:${context.household.id}`
    return mem0Client.search(namespace, query)
  }

  async feedback(context: RequestContext, input: FeedbackRequest) {
    if (input.orderId) {
      const order = await db.query.orders.findFirst({ where: and(eq(orders.id, input.orderId), eq(orders.householdId, context.household.id)) })
      if (!order) throw notFound('Order')
    }
    if (input.mealPlanItemId) {
      const item = await db.query.mealPlanItems.findFirst({ where: and(eq(mealPlanItems.id, input.mealPlanItemId), eq(mealPlanItems.householdId, context.household.id)) })
      if (!item) throw notFound('Meal plan item')
    }
    const result = await db.transaction(async (tx) => {
      const rows = await tx.insert(feedback).values({ householdId: context.household.id, memberId: context.membership.id, mealPlanItemId: input.mealPlanItemId ?? null, orderId: input.orderId ?? null, kind: input.kind, subject: input.subject ?? null, value: input.value }).returning()
      await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'feedback', aggregateId: rows[0].id, eventType: 'feedback.created', version: 1, payload: { feedbackId: rows[0].id } })
      return rows[0]
    })
    return toContractFeedback(result)
  }
}
export const memoryService = new MemoryService()
