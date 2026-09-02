import { and, desc, eq, or } from 'drizzle-orm'
import { connectedProviderAccounts, memoryInitializations, memorySyncRecords, orders } from '@miyko/database/schema'
import type { RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError, notFound } from '../../lib/errors.js'
import { agentLayer } from '../agent/graphs.js'
import { providerSyncService } from '../store-providers/provider-sync.service.js'

export class MemoryInitializationService {
  async run(context: RequestContext, memberId: string, sourceEventId: string) {
    const member = await db.query.householdMembers.findFirst({ where: (table, { and, eq }) => and(eq(table.id, memberId), eq(table.householdId, context.household.id), eq(table.userId, context.user.id), eq(table.status, 'active')) })
    if (!member) throw notFound('Household member')

    const existing = await db.query.memoryInitializations.findFirst({
      where: or(
        eq(memoryInitializations.sourceEventId, sourceEventId),
        and(eq(memoryInitializations.householdId, context.household.id), eq(memoryInitializations.memberId, memberId)),
      ),
      orderBy: [desc(memoryInitializations.updatedAt)],
    })
    if (existing?.status === 'completed') return existing
    const init = existing
      ? (await db.update(memoryInitializations).set({ userId: context.user.id, householdId: context.household.id, memberId, sourceEventId, status: 'pending', requestedAt: new Date(), updatedAt: new Date() }).where(eq(memoryInitializations.id, existing.id)).returning())[0]
      : (await db.insert(memoryInitializations).values({ userId: context.user.id, householdId: context.household.id, memberId, sourceEventId, status: 'pending' }).onConflictDoNothing().returning())[0]
    if (!init) throw new AppError('MEMORY_INITIALIZATION_NOT_CREATED', 'Memory initialization could not be recorded', 503)

    const binding = (await db.query.connectedProviderAccounts.findMany({
      where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, 'active')),
      with: { provider: true, userProviderAccount: true },
    })).find((row) => row.userProviderAccount?.userId === context.user.id && row.userProviderAccount.status === 'active')
    if (!binding) {
      return (await db.update(memoryInitializations).set({ status: 'waiting_for_provider', lastError: null, updatedAt: new Date() }).where(eq(memoryInitializations.id, init.id)).returning())[0]
    }

    await db.update(memoryInitializations).set({ status: 'processing', startedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(memoryInitializations.id, init.id))
    try {
      await providerSyncService.sync(context, binding.provider.slug, sourceEventId)
      const receipts = await db.query.orders.findMany({ where: and(eq(orders.householdId, context.household.id), eq(orders.providerId, binding.provider.id), eq(orders.connectedAccountId, binding.id)), with: { items: true }, orderBy: [desc(orders.purchasedAt)], limit: 100 })
      const priorMemory = await db.query.memorySyncRecords.findFirst({ where: and(eq(memorySyncRecords.householdId, context.household.id), eq(memorySyncRecords.memberId, memberId), eq(memorySyncRecords.namespace, `member:${memberId}`)) })
      const graph = await agentLayer.initializeMemory({ namespace: `member:${memberId}`, receipts, memoryId: priorMemory?.externalMemoryId })
      await db.insert(memorySyncRecords).values({ householdId: context.household.id, memberId, planningRunId: null, scope: 'member', namespace: `member:${memberId}`, externalMemoryId: graph.memoryId, lastSyncedAt: new Date(), metadata: { source: 'receipt_initialization', status: 'completed' } }).onConflictDoUpdate({ target: memorySyncRecords.namespace, set: { externalMemoryId: graph.memoryId, lastSyncedAt: new Date(), metadata: { source: 'receipt_initialization', status: 'completed' }, updatedAt: new Date() } })
      return (await db.update(memoryInitializations).set({ status: 'completed', providerAccountId: binding.userProviderAccount?.id ?? null, completedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(memoryInitializations.id, init.id)).returning())[0]
    } catch (error) {
      const message = error instanceof AppError ? error.code : 'MEMORY_INITIALIZATION_FAILED'
      await db.update(memoryInitializations).set({ status: 'failed', lastError: message, updatedAt: new Date() }).where(eq(memoryInitializations.id, init.id))
      throw error
    }
  }
}

export const memoryInitializationService = new MemoryInitializationService()
