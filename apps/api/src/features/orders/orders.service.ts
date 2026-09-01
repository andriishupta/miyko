import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { outbox, products, proposals } from '../../lib/mock-store.js'
import { mcpService } from '../../integrations/mcp/mcp.service.js'
import type { OrderProposal, RequestContext } from '../../lib/types.js'

const now = () => new Date().toISOString()
const idempotentResults = new Map<string, OrderProposal>()
const createResults = new Map<string, OrderProposal>()

export class OrdersService {
  private getOwned(context: RequestContext, proposalId: string) {
    const proposal = proposals.find((candidate) => candidate.id === proposalId && candidate.householdId === context.household.id)
    if (!proposal) throw notFound('Order proposal')
    return proposal
  }

  list(context: RequestContext) { return proposals.filter((proposal) => proposal.householdId === context.household.id) }
  get(context: RequestContext, proposalId: string) { return this.getOwned(context, proposalId) }

  create(context: RequestContext, input: { title: string; intent?: string | null; items: Array<{ productId: string; quantity: number }> }, idempotencyKey: string) {
    const prior = createResults.get(`${context.household.id}:${idempotencyKey}`)
    if (prior) return prior
    const checkedItems = input.items.map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId && candidate.available)
      if (!product) throw notFound('Product')
      return { id: `item-${Date.now()}-${index}`, productId: product.id, quantity: item.quantity, price: product.price, status: 'proposed' as const }
    })
    const timestamp = now()
    const proposal: OrderProposal = { id: `proposal-${Date.now()}`, householdId: context.household.id, createdBy: context.user.id, title: input.title, status: 'review', intent: input.intent ?? null, version: 1, createdAt: timestamp, updatedAt: timestamp, items: checkedItems }
    proposals.push(proposal)
    outbox.push({ id: `outbox-${Date.now()}`, householdId: context.household.id, type: 'order.created', aggregateId: proposal.id, status: 'pending', attempts: 0, lastError: null, processedAt: null, createdAt: timestamp })
    createResults.set(`${context.household.id}:${idempotencyKey}`, proposal)
    return proposal
  }

  private canEdit(context: RequestContext) {
    if (!['owner', 'adult_member'].includes(context.membership.role)) throw forbidden()
  }

  editQuantity(context: RequestContext, proposalId: string, itemId: string, quantity: number, idempotencyKey: string) {
    this.canEdit(context)
    const operationKey = `${context.household.id}:edit:${proposalId}:${itemId}:${idempotencyKey}`
    const prior = idempotentResults.get(operationKey)
    if (prior) return prior
    const proposal = this.getOwned(context, proposalId)
    if (proposal.status === 'basket_updated' || proposal.status === 'declined') throw conflict('Proposal cannot be edited in its current state')
    const item = proposal.items.find((candidate) => candidate.id === itemId)
    if (!item) throw notFound('Proposal item')
    item.quantity = quantity
    proposal.version += 1
    proposal.updatedAt = now()
    idempotentResults.set(operationKey, proposal)
    return proposal
  }

  replaceItem(context: RequestContext, proposalId: string, itemId: string, productId: string, quantity: number | undefined, idempotencyKey: string) {
    this.canEdit(context)
    const operationKey = `${context.household.id}:replace:${proposalId}:${itemId}:${idempotencyKey}`
    const prior = idempotentResults.get(operationKey)
    if (prior) return prior
    const proposal = this.getOwned(context, proposalId)
    const item = proposal.items.find((candidate) => candidate.id === itemId)
    const product = products.find((candidate) => candidate.id === productId && candidate.available)
    if (!item) throw notFound('Proposal item')
    if (!product) throw notFound('Product')
    item.productId = product.id
    item.price = product.price
    item.quantity = quantity ?? item.quantity
    item.status = 'replaced'
    proposal.version += 1
    proposal.updatedAt = now()
    idempotentResults.set(operationKey, proposal)
    return proposal
  }

  removeItem(context: RequestContext, proposalId: string, itemId: string, idempotencyKey: string) {
    this.canEdit(context)
    const operationKey = `${context.household.id}:remove:${proposalId}:${itemId}:${idempotencyKey}`
    const prior = idempotentResults.get(operationKey)
    if (prior) return prior
    const proposal = this.getOwned(context, proposalId)
    if (proposal.items.length <= 1) throw conflict('Proposal must contain at least one item')
    const index = proposal.items.findIndex((candidate) => candidate.id === itemId)
    if (index < 0) throw notFound('Proposal item')
    proposal.items.splice(index, 1)
    proposal.version += 1
    proposal.updatedAt = now()
    idempotentResults.set(operationKey, proposal)
    return proposal
  }

  approve(context: RequestContext, proposalId: string, idempotencyKey: string) {
    if (context.membership.role !== 'owner') throw forbidden()
    const idempotencyId = `${context.household.id}:${proposalId}:${idempotencyKey}`
    const prior = idempotentResults.get(idempotencyId)
    if (prior) return prior
    const proposal = this.getOwned(context, proposalId)
    if (proposal.status === 'basket_updated') return proposal
    if (!['review', 'draft'].includes(proposal.status)) throw conflict('Proposal cannot be approved in its current state')
    proposal.items.forEach((item) => { item.status = 'approved' })
    proposal.status = 'approved'
    proposal.updatedAt = now()
    const result = proposal
    void mcpService.updateBasket({ householdId: context.household.id, proposalId: proposal.id, items: proposal.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) }, true).then(() => {
      proposal.status = 'basket_updated'
      proposal.updatedAt = now()
    }).catch((error: unknown) => logger.error('mcp.basket_update.failed', { proposalId: proposal.id, error: error instanceof Error ? error.message : 'unknown' }))
    idempotentResults.set(idempotencyId, result)
    return result
  }

  decline(context: RequestContext, proposalId: string, idempotencyKey: string) {
    if (context.membership.role !== 'owner') throw forbidden()
    const operationKey = `${context.household.id}:decline:${proposalId}:${idempotencyKey}`
    const prior = idempotentResults.get(operationKey)
    if (prior) return prior
    const proposal = this.getOwned(context, proposalId)
    if (['basket_updated', 'approved'].includes(proposal.status)) throw conflict('Proposal cannot be declined in its current state')
    proposal.status = 'declined'
    proposal.updatedAt = now()
    idempotentResults.set(operationKey, proposal)
    return proposal
  }
}

export const ordersService = new OrdersService()
