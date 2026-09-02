import { and, desc, eq } from 'drizzle-orm'
import { connectedProviderAccounts, deliveries, orderItems, orders, providerProducts, providerSyncEvents, shoppingProviders } from '@miyko/database/schema'
import type { RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError, notFound, providerNotConnected } from '../../lib/errors.js'
import { outboxService } from '../../features/outbox/outbox.service.js'
import { storeProviderService } from './store-provider.service.js'
import type { StoreProviderOrderRecord } from './store-provider.types.js'

const staleAfterMs = Number(process.env.PROVIDER_SYNC_STALE_MS ?? 86_400_000)

const safeStatus = (status: string): 'pending' | 'approved' | 'syncing' | 'in_cart' | 'placed' | 'completed' | 'cancelled' | 'failed' => {
  const normalized = status.toLowerCase()
  const aliases: Record<string, ReturnType<typeof safeStatus>> = { canceled: 'cancelled', delivered: 'completed', processing: 'syncing' }
  if (normalized in aliases) return aliases[normalized]
  const allowed = new Set(['pending', 'approved', 'syncing', 'in_cart', 'placed', 'completed', 'cancelled', 'failed'])
  if (!allowed.has(normalized)) throw new AppError('PROVIDER_INVALID_ORDER_STATUS', 'Provider returned an unsupported order status', 502)
  return normalized as ReturnType<typeof safeStatus>
}

const safeDate = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export class ProviderSyncService {
  async requestIfStale(context: RequestContext, providerSlug: string) {
    const target = await this.target(context, providerSlug)
    const latest = await db.query.providerSyncEvents.findFirst({
      where: and(eq(providerSyncEvents.householdId, context.household.id), eq(providerSyncEvents.providerId, target.provider.id)),
      orderBy: [desc(providerSyncEvents.createdAt)],
    })
    const stale = !latest || latest.status === 'failed' || !latest.finishedAt || latest.finishedAt.getTime() < Date.now() - staleAfterMs
    if (!stale) return null
    const event = await outboxService.enqueue({
      householdId: context.household.id,
      aggregateType: 'connected_provider_account',
      aggregateId: target.connection.id,
      eventType: 'provider.sync_requested',
      payload: { providerId: target.provider.id, connectedAccountId: target.connection.id, providerSlug },
    })
    return event?.id ?? null
  }

  async sync(context: RequestContext, providerSlug: string, sourceEventId?: string) {
    const target = await this.target(context, providerSlug)
    const providerEventId = sourceEventId ? `outbox:${sourceEventId}` : `request:${context.household.id}:${context.requestId}`
    const existing = await db.query.providerSyncEvents.findFirst({ where: and(eq(providerSyncEvents.householdId, context.household.id), eq(providerSyncEvents.providerId, target.provider.id), eq(providerSyncEvents.providerEventId, providerEventId)) })
    if (existing?.status === 'succeeded') return { providerId: target.provider.id, connectedAccountId: target.connection.id, imported: existing.responseSummary ?? {} }

    const syncEvent = existing ?? (await db.insert(providerSyncEvents).values({
      householdId: context.household.id,
      providerId: target.provider.id,
      connectedAccountId: target.connection.id,
      direction: 'inbound',
      status: 'pending',
      providerEventId,
      requestSummary: { providerSlug, sourceEventId: sourceEventId ?? null },
    }).onConflictDoNothing().returning())[0]
    if (!syncEvent) throw new AppError('PROVIDER_SYNC_EVENT_NOT_CREATED', 'Provider sync could not be recorded', 503)
    await db.update(providerSyncEvents).set({ status: 'running', startedAt: new Date(), errorMessage: null }).where(eq(providerSyncEvents.id, syncEvent.id))
    await db.update(connectedProviderAccounts).set({ syncStatus: 'pending', lastSyncError: null, updatedAt: new Date() }).where(eq(connectedProviderAccounts.id, target.connection.id))

    try {
      const result = await storeProviderService.sync(context, providerSlug)
      const imported = await this.persistOrders(context, target.provider.id, target.connection.id, result.value)
      const finishedAt = new Date()
      await db.update(providerSyncEvents).set({ status: 'succeeded', responseSummary: imported, finishedAt }).where(eq(providerSyncEvents.id, syncEvent.id))
      await db.update(connectedProviderAccounts).set({ syncStatus: 'succeeded', firstSyncedAt: target.connection.firstSyncedAt ?? finishedAt, lastSyncedAt: finishedAt, staleAt: new Date(finishedAt.getTime() + staleAfterMs), lastSyncError: null, updatedAt: finishedAt }).where(eq(connectedProviderAccounts.id, target.connection.id))
      return { providerId: target.provider.id, connectedAccountId: target.connection.id, imported }
    } catch (error) {
      const message = error instanceof AppError ? error.code : 'PROVIDER_SYNC_FAILED'
      await db.update(providerSyncEvents).set({ status: 'failed', errorMessage: message, finishedAt: new Date() }).where(eq(providerSyncEvents.id, syncEvent.id))
      await db.update(connectedProviderAccounts).set({ syncStatus: 'failed', staleAt: new Date(), lastSyncError: message, updatedAt: new Date() }).where(eq(connectedProviderAccounts.id, target.connection.id))
      throw error
    }
  }

  async syncOrder(context: RequestContext, orderId: string, sourceEventId?: string) {
    const row = await db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.householdId, context.household.id)), with: { provider: true } })
    if (!row) throw notFound('Order')
    return this.sync(context, row.provider.slug, sourceEventId)
  }

  private async target(context: RequestContext, providerSlug: string) {
    const provider = await db.query.shoppingProviders.findFirst({ where: and(eq(shoppingProviders.slug, providerSlug), eq(shoppingProviders.kind, 'store'), eq(shoppingProviders.status, 'active')) })
    if (!provider) throw notFound('Store provider')
    const connections = await db.query.connectedProviderAccounts.findMany({
      where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.providerId, provider.id), eq(connectedProviderAccounts.status, 'active')),
      with: { userProviderAccount: true },
    })
    const connection = connections.find((item) => item.userProviderAccount?.userId === context.user.id && item.userProviderAccount.status === 'active')
    if (!connection) throw providerNotConnected()
    return { provider, connection }
  }

  private async persistOrders(context: RequestContext, providerId: string, connectedAccountId: string, records: StoreProviderOrderRecord[]) {
    let importedOrders = 0
    let importedDeliveries = 0
    for (const record of records) {
      const orderRows = await db.insert(orders).values({
        householdId: context.household.id,
        providerId,
        connectedAccountId,
        providerOrderId: record.order.id,
        status: safeStatus(record.order.status),
        totalAmount: String(record.order.total),
        currency: record.order.currency,
        purchasedAt: safeDate(record.order.placedAt),
        lastProviderSyncAt: new Date(),
        syncStatus: 'succeeded',
      }).onConflictDoUpdate({ target: [orders.providerId, orders.providerOrderId], set: {
        connectedAccountId,
        status: safeStatus(record.order.status),
        totalAmount: String(record.order.total),
        currency: record.order.currency,
        purchasedAt: safeDate(record.order.placedAt),
        lastProviderSyncAt: new Date(),
        syncStatus: 'succeeded',
        updatedAt: new Date(),
      } }).returning()
      const order = orderRows[0]
      if (!order) continue
      importedOrders += 1
      await db.delete(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.householdId, context.household.id)))
      if (record.items.length > 0) {
        const importedItems = []
        for (const item of record.items) {
          const productRows = await db.insert(providerProducts).values({ providerId, providerProductId: item.providerProductId, normalizedName: item.name, details: { unit: item.unit, price: item.unitPrice, currency: record.order.currency }, lastSeenAt: new Date() }).onConflictDoUpdate({ target: [providerProducts.providerId, providerProducts.providerProductId], set: { normalizedName: item.name, details: { unit: item.unit, price: item.unitPrice, currency: record.order.currency }, lastSeenAt: new Date(), updatedAt: new Date() } }).returning()
          importedItems.push({ householdId: context.household.id, orderId: order.id, productId: productRows[0]?.id ?? null, providerProductIdSnapshot: item.providerProductId, productNameSnapshot: item.name, quantity: String(item.quantity), unit: item.unit, unitPriceSnapshot: item.unitPrice === null ? null : String(item.unitPrice), totalPriceSnapshot: item.totalPrice === null ? null : String(item.totalPrice), currency: record.order.currency, status: 'added' as const })
        }
        await db.insert(orderItems).values(importedItems)
      }
      if (record.delivery) {
        await db.insert(deliveries).values({ householdId: context.household.id, orderId: order.id, deliveryProviderId: providerId, providerDeliveryId: record.delivery.externalDeliveryId, scheduledFrom: safeDate(record.delivery.scheduledFrom), scheduledTo: safeDate(record.delivery.scheduledTo), status: record.delivery.status }).onConflictDoUpdate({ target: [deliveries.orderId, deliveries.providerDeliveryId], set: { deliveryProviderId: providerId, scheduledFrom: safeDate(record.delivery.scheduledFrom), scheduledTo: safeDate(record.delivery.scheduledTo), status: record.delivery.status, updatedAt: new Date() } })
        importedDeliveries += 1
      }
    }
    return { importedOrders, importedDeliveries }
  }
}

export const providerSyncService = new ProviderSyncService()
