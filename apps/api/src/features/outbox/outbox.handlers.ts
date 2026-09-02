import { and, eq } from 'drizzle-orm'
import { auditLogs, feedback, memorySyncRecords, shoppingProposals, shoppingProviders } from '@miyko/database/schema'
import type { RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError, notFound } from '../../lib/errors.js'
import { mem0Client } from '../../integrations/memory/mem0.client.js'
import { memoryInitializationService } from '../../integrations/memory/memory-initialization.service.js'
import { providerSyncService } from '../../integrations/store-providers/provider-sync.service.js'
import type { OutboxEventRow } from './outbox.service.js'
import { z } from 'zod'

const providerSyncPayload = z.object({ providerId: z.string().uuid(), connectedAccountId: z.string().uuid().optional(), providerSlug: z.string().min(1).optional() }).strict()
const memoryPayload = z.object({ memberId: z.string().uuid() }).strict()
const feedbackPayload = z.object({ feedbackId: z.string().uuid() }).strict()
const proposalPayload = z.object({ proposalId: z.string().uuid() }).strict()
const deliveryPayload = z.object({ orderId: z.string().uuid(), providerSlug: z.string().min(1).optional() }).strict()

const payloadOf = <T>(event: OutboxEventRow, schema: z.ZodType<T>) => {
  const parsed = schema.safeParse(event.payload)
  if (!parsed.success) throw new AppError('OUTBOX_INVALID_PAYLOAD', 'Outbox event payload is invalid', 422)
  return parsed.data
}

const audit = async (context: RequestContext, event: OutboxEventRow, action: string, aggregateId: string) => {
  const existing = await db.query.auditLogs.findFirst({ where: and(eq(auditLogs.householdId, context.household.id), eq(auditLogs.aggregateId, aggregateId), eq(auditLogs.action, action)) })
  if (existing) return
  await db.insert(auditLogs).values({ householdId: context.household.id, actorMemberId: context.membership.id, action, aggregateType: event.aggregateType, aggregateId, metadata: { sourceEventId: event.id } })
}

export type OutboxHandler = (context: RequestContext, event: OutboxEventRow) => Promise<void>

export const outboxHandlers: Record<string, OutboxHandler> = {
  async 'provider.sync_requested'(context, event) {
    const payload = payloadOf(event, providerSyncPayload)
    const provider = payload.providerSlug ?? (await db.query.shoppingProviders.findFirst({ where: eq(shoppingProviders.id, payload.providerId) }))?.slug
    if (!provider) throw notFound('Store provider')
    await providerSyncService.sync(context, provider, event.id)
  },

  async 'user.memory_initialization_requested'(context, event) {
    const { memberId } = payloadOf(event, memoryPayload)
    await memoryInitializationService.run(context, memberId, event.id)
  },

  async 'feedback.created'(context, event) {
    const { feedbackId } = payloadOf(event, feedbackPayload)
    const row = await db.query.feedback.findFirst({ where: and(eq(feedback.id, feedbackId), eq(feedback.householdId, context.household.id)) })
    if (!row) throw notFound('Feedback')
    const processed = await db.query.auditLogs.findFirst({ where: and(eq(auditLogs.householdId, context.household.id), eq(auditLogs.aggregateId, feedbackId), eq(auditLogs.action, 'feedback.memory_synced')) })
    if (processed) return
    const namespace = `member:${row.memberId}`
    const content = `Feedback kind: ${row.kind}${row.subject ? `; subject: ${row.subject}` : ''}`
    const memoryId = await mem0Client.add(namespace, content, { source: 'feedback', scope: 'member' })
    await db.insert(memorySyncRecords).values({ householdId: context.household.id, memberId: row.memberId, scope: 'member', namespace, externalMemoryId: memoryId, lastSyncedAt: new Date(), metadata: { source: 'feedback' } }).onConflictDoUpdate({ target: memorySyncRecords.namespace, set: { externalMemoryId: memoryId, lastSyncedAt: new Date(), metadata: { source: 'feedback' }, updatedAt: new Date() } })
    await audit(context, event, 'feedback.memory_synced', feedbackId)
  },

  async 'proposal.created'(context, event) {
    const { proposalId } = payloadOf(event, proposalPayload)
    const row = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)) })
    if (!row) throw notFound('Shopping proposal')
    await audit(context, event, 'proposal.created', proposalId)
  },

  async 'proposal.approved'(context, event) {
    const { proposalId } = payloadOf(event, proposalPayload)
    const row = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)) })
    if (!row) throw notFound('Shopping proposal')
    await audit(context, event, 'proposal.approved', proposalId)
  },

  async 'proposal.declined'(context, event) {
    const { proposalId } = payloadOf(event, proposalPayload)
    const row = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)) })
    if (!row) throw notFound('Shopping proposal')
    await audit(context, event, 'proposal.declined', proposalId)
  },

  async 'delivery.sync_requested'(context, event) {
    const payload = payloadOf(event, deliveryPayload)
    await providerSyncService.syncOrder(context, payload.orderId, event.id)
  },
}
