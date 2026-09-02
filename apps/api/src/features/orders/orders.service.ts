import { and, desc, eq, gt } from 'drizzle-orm'
import { idempotencyKeys, orderItems, orders, outboxEvents, providerProducts, shoppingProposalItems, shoppingProposals } from '@miyko/database/schema'
import type { CreateProposalRequest, Order, RequestContext, ShoppingProposal } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { toContractOrder, toContractProposal } from '../../lib/serializers.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'
import { z } from 'zod'

const productDetailsSchema = z.object({ price: z.number().nonnegative().nullable().optional(), unit: z.string().optional(), currency: z.literal('UAH').optional() }).passthrough()

const detailsOf = (details: unknown) => {
  const parsed = productDetailsSchema.safeParse(details ?? {})
  return parsed.success ? parsed.data : {}
}

const orderRow = (row: typeof orders.$inferSelect & { items: Array<typeof orderItems.$inferSelect> }): Order => toContractOrder(row)
const proposalRow = (row: typeof shoppingProposals.$inferSelect & { items: Array<typeof shoppingProposalItems.$inferSelect> }): ShoppingProposal => toContractProposal(row)

export class OrdersService {
  async list(context: RequestContext): Promise<Order[]> {
    const rows = await db.query.orders.findMany({ where: eq(orders.householdId, context.household.id), with: { items: true }, orderBy: [desc(orders.createdAt)] })
    return rows.map(orderRow)
  }

  async latest(context: RequestContext) { return (await this.list(context))[0] ?? null }

  async get(context: RequestContext, orderId: string) {
    const row = await db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.householdId, context.household.id)), with: { items: true } })
    if (!row) throw notFound('Order')
    return orderRow(row)
  }

  async listProposals(context: RequestContext) {
    const rows = await db.query.shoppingProposals.findMany({ where: eq(shoppingProposals.householdId, context.household.id), with: { items: true }, orderBy: [desc(shoppingProposals.createdAt)] })
    return rows.map(proposalRow)
  }

  async getProposal(context: RequestContext, proposalId: string) {
    const row = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)), with: { items: true } })
    if (!row) throw notFound('Shopping proposal')
    return proposalRow(row)
  }

  async createProposal(context: RequestContext, input: CreateProposalRequest, idempotencyKey: string) {
    this.assertCanEdit(context)
    const existing = await db.query.idempotencyKeys.findFirst({ where: and(eq(idempotencyKeys.householdId, context.household.id), eq(idempotencyKeys.operation, 'proposal.create'), eq(idempotencyKeys.key, idempotencyKey), gt(idempotencyKeys.expiresAt, new Date())) })
    if (existing?.aggregateId) return this.getProposal(context, existing.aggregateId)

    const result = await db.transaction(async (tx) => {
      const products = await Promise.all(input.items.map((item) => tx.query.providerProducts.findFirst({ where: eq(providerProducts.id, item.productId) })))
      if (products.some((product) => !product)) throw notFound('Product')
      const member = context.membership
      const proposalRows = await tx.insert(shoppingProposals).values({ householdId: context.household.id, createdByMemberId: member.id, status: 'awaiting_owner_approval' }).returning()
      const proposal = proposalRows[0]
      await tx.insert(shoppingProposalItems).values(input.items.map((item, index) => {
        const product = products[index]!
        const details = detailsOf(product.details)
        const unit = item.unit ?? details.unit ?? 'item'
        const price = details.price ?? null
        return { householdId: context.household.id, proposalId: proposal.id, productId: product.id, productNameSnapshot: product.normalizedName, quantity: String(item.quantity), unit, estimatedUnitPrice: price === null ? null : String(price), estimatedTotalPrice: price === null ? null : String(price * item.quantity), currency: 'UAH' }
      }))
      await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'shopping_proposal', aggregateId: proposal.id, eventType: 'proposal.created', version: proposal.revision, payload: { proposalId: proposal.id } })
      await tx.insert(idempotencyKeys).values({ householdId: context.household.id, key: idempotencyKey, operation: 'proposal.create', status: 'completed', aggregateType: 'shopping_proposal', aggregateId: proposal.id, response: { proposalId: proposal.id }, expiresAt: new Date(Date.now() + 86_400_000) })
      return proposal.id
    })
    return this.getProposal(context, result)
  }

  private assertCanEdit(context: RequestContext) {
    if (context.membership.role === 'viewer') throw forbidden()
  }

  private async bumpRevision(context: RequestContext, proposalId: string) {
    const current = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)) })
    if (!current) throw notFound('Shopping proposal')
    if (['approved', 'applied', 'declined', 'failed'].includes(current.status)) throw conflict('Proposal cannot be edited in its current state')
    await db.update(shoppingProposals).set({ revision: current.revision + 1, status: 'awaiting_owner_approval', updatedAt: new Date() }).where(eq(shoppingProposals.id, proposalId))
  }

  async editQuantity(context: RequestContext, proposalId: string, itemId: string, quantity: number) {
    this.assertCanEdit(context)
    await this.bumpRevision(context, proposalId)
    const updated = await db.update(shoppingProposalItems).set({ quantity: String(quantity), status: 'edited', updatedAt: new Date() }).where(and(eq(shoppingProposalItems.id, itemId), eq(shoppingProposalItems.proposalId, proposalId), eq(shoppingProposalItems.householdId, context.household.id))).returning()
    if (!updated[0]) throw notFound('Proposal item')
    return this.getProposal(context, proposalId)
  }

  async replaceItem(context: RequestContext, proposalId: string, itemId: string, productId: string, quantity?: number) {
    this.assertCanEdit(context)
    const product = await db.query.providerProducts.findFirst({ where: eq(providerProducts.id, productId) })
    if (!product) throw notFound('Product')
    const item = await db.query.shoppingProposalItems.findFirst({ where: and(eq(shoppingProposalItems.id, itemId), eq(shoppingProposalItems.proposalId, proposalId), eq(shoppingProposalItems.householdId, context.household.id)) })
    if (!item) throw notFound('Proposal item')
    await this.bumpRevision(context, proposalId)
    const details = detailsOf(product.details)
    await db.update(shoppingProposalItems).set({ productId: product.id, productNameSnapshot: product.normalizedName, quantity: quantity === undefined ? item.quantity : String(quantity), unit: details.unit ?? item.unit, estimatedUnitPrice: details.price === undefined || details.price === null ? null : String(details.price), estimatedTotalPrice: details.price === undefined || details.price === null ? null : String(details.price * Number(quantity ?? item.quantity)), status: 'replaced', updatedAt: new Date() }).where(eq(shoppingProposalItems.id, itemId))
    return this.getProposal(context, proposalId)
  }

  async removeItem(context: RequestContext, proposalId: string, itemId: string) {
    this.assertCanEdit(context)
    const items = await db.query.shoppingProposalItems.findMany({ where: and(eq(shoppingProposalItems.proposalId, proposalId), eq(shoppingProposalItems.householdId, context.household.id)) })
    if (items.length <= 1) throw conflict('Proposal must contain at least one item')
    await this.bumpRevision(context, proposalId)
    const deleted = await db.delete(shoppingProposalItems).where(and(eq(shoppingProposalItems.id, itemId), eq(shoppingProposalItems.proposalId, proposalId), eq(shoppingProposalItems.householdId, context.household.id))).returning()
    if (!deleted[0]) throw notFound('Proposal item')
    return this.getProposal(context, proposalId)
  }

  async approve(context: RequestContext, proposalId: string, idempotencyKey: string) {
    if (context.membership.role !== 'owner') throw forbidden()
    const existing = await db.query.idempotencyKeys.findFirst({ where: and(eq(idempotencyKeys.householdId, context.household.id), eq(idempotencyKeys.operation, 'proposal.approve'), eq(idempotencyKeys.key, idempotencyKey)) })
    if (existing?.aggregateId) return this.getProposal(context, existing.aggregateId)
    const proposal = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)), with: { items: true } })
    if (!proposal) throw notFound('Shopping proposal')
    if (!['draft', 'awaiting_changes', 'awaiting_owner_approval'].includes(proposal.status)) throw conflict('Proposal cannot be approved in its current state')

    await db.transaction(async (tx) => {
      await tx.update(shoppingProposals).set({ status: 'approved', approvedByMemberId: context.membership.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(shoppingProposals.id, proposal.id))
      await tx.update(shoppingProposalItems).set({ status: 'approved', finalDecisionByMemberId: context.membership.id, finalDecisionAt: new Date(), updatedAt: new Date() }).where(eq(shoppingProposalItems.proposalId, proposal.id))
      await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'shopping_proposal', aggregateId: proposal.id, eventType: 'proposal.approved', version: proposal.revision, payload: { proposalId: proposal.id, approvedByMemberId: context.membership.id } })
      await tx.insert(idempotencyKeys).values({ householdId: context.household.id, key: idempotencyKey, operation: 'proposal.approve', status: 'completed', aggregateType: 'shopping_proposal', aggregateId: proposal.id, response: { proposalId: proposal.id }, expiresAt: new Date(Date.now() + 86_400_000) })
    })
    const approved = await this.getProposal(context, proposal.id)
    try {
      const products = await Promise.all(approved.items.map((item) => db.query.providerProducts.findFirst({ where: eq(providerProducts.id, item.productId), with: { provider: true } })))
      const provider = products[0]?.provider
      if (!provider || products.some((product) => !product || product.providerId !== provider.id)) throw conflict('Proposal must use one store provider')
      const connection = await storeProviderService.updateBasket(context, provider.slug, { proposalId: proposal.id, items: approved.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) })
      await db.update(shoppingProposals).set({ status: 'applied', updatedAt: new Date() }).where(eq(shoppingProposals.id, proposal.id))
      {
        await db.transaction(async (tx) => {
          const orderRows = await tx.insert(orders).values({ householdId: context.household.id, providerId: connection.provider.id, connectedAccountId: connection.connectedAccountId, proposalId: proposal.id, providerBasketId: connection.basket.basketId, status: 'in_cart', totalAmount: String(approved.items.reduce((sum, item) => sum + (item.estimatedTotalPrice ?? 0), 0)), currency: 'UAH', syncStatus: 'succeeded', lastProviderSyncAt: new Date() }).returning()
          const order = orderRows[0]
          await tx.insert(orderItems).values(approved.items.map((item) => ({ householdId: context.household.id, orderId: order.id, productId: item.productId, providerProductIdSnapshot: item.productId, productNameSnapshot: item.productName, quantity: String(item.quantity), unit: item.unit, unitPriceSnapshot: item.estimatedUnitPrice === null ? null : String(item.estimatedUnitPrice), totalPriceSnapshot: item.estimatedTotalPrice === null ? null : String(item.estimatedTotalPrice), currency: 'UAH', status: 'added' })))
          await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'order', aggregateId: order.id, eventType: 'delivery.sync_requested', version: 1, payload: { orderId: order.id, providerSlug: provider.slug } })
        })
      }
    } catch (error) {
      await db.update(shoppingProposals).set({ status: 'failed', updatedAt: new Date() }).where(eq(shoppingProposals.id, proposal.id))
      throw error
    }
    return this.getProposal(context, proposal.id)
  }

  async decline(context: RequestContext, proposalId: string, idempotencyKey: string) {
    if (context.membership.role !== 'owner') throw forbidden()
    const proposal = await db.query.shoppingProposals.findFirst({ where: and(eq(shoppingProposals.id, proposalId), eq(shoppingProposals.householdId, context.household.id)) })
    if (!proposal) throw notFound('Shopping proposal')
    if (['applied', 'approved'].includes(proposal.status)) throw conflict('Proposal cannot be declined in its current state')
    await db.transaction(async (tx) => {
      await tx.update(shoppingProposals).set({ status: 'declined', declinedByMemberId: context.membership.id, declinedAt: new Date(), updatedAt: new Date() }).where(eq(shoppingProposals.id, proposal.id))
      await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'shopping_proposal', aggregateId: proposal.id, eventType: 'proposal.declined', version: proposal.revision, payload: { proposalId: proposal.id } })
      await tx.insert(idempotencyKeys).values({ householdId: context.household.id, key: idempotencyKey, operation: 'proposal.decline', status: 'completed', aggregateType: 'shopping_proposal', aggregateId: proposal.id, response: { proposalId: proposal.id }, expiresAt: new Date(Date.now() + 86_400_000) })
    })
    return this.getProposal(context, proposalId)
  }
}

export const ordersService = new OrdersService()
