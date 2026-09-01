import { Hono } from 'hono'
import type { Context } from 'hono'
import { requireRole } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { AppError } from '../../lib/errors.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { createProposalSchema, editItemSchema, proposalIdSchema, proposalItemParamsSchema, replaceItemSchema } from './orders.schemas.js'
import { ordersService } from './orders.service.js'

export const ordersRoutes = new Hono()
const idempotencyKey = (c: Context) => {
  const key = c.req.header('idempotency-key')
  if (!key || key.length > 200) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key required', 400)
  return key
}
ordersRoutes.get('/proposals', (c) => c.json({ data: ordersService.list(c.get('requestContext')) }))
ordersRoutes.post('/proposals', rateLimit('proposal-create', 20, 60_000), async (c) => {
  const input = await parseJson(c, createProposalSchema)
  return c.json({ data: ordersService.create(c.get('requestContext'), input, idempotencyKey(c)) }, 201)
})
ordersRoutes.get('/proposals/:proposalId', (c) => {
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: ordersService.get(c.get('requestContext'), params.proposalId) })
})
ordersRoutes.patch('/proposals/:proposalId/items/:itemId', requireRole('owner', 'adult_member'), async (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  const input = await parseJson(c, editItemSchema)
  return c.json({ data: ordersService.editQuantity(c.get('requestContext'), params.proposalId, params.itemId, input.quantity, idempotencyKey(c)) })
})
ordersRoutes.post('/proposals/:proposalId/items/:itemId/replace', requireRole('owner', 'adult_member'), async (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  const input = await parseJson(c, replaceItemSchema)
  return c.json({ data: ordersService.replaceItem(c.get('requestContext'), params.proposalId, params.itemId, input.productId, input.quantity, idempotencyKey(c)) })
})
ordersRoutes.delete('/proposals/:proposalId/items/:itemId', requireRole('owner', 'adult_member'), (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  return c.json({ data: ordersService.removeItem(c.get('requestContext'), params.proposalId, params.itemId, idempotencyKey(c)) })
})
ordersRoutes.post('/proposals/:proposalId/approve', requireRole('owner'), (c) => {
  const key = idempotencyKey(c)
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: ordersService.approve(c.get('requestContext'), params.proposalId, key) })
})
ordersRoutes.post('/proposals/:proposalId/decline', requireRole('owner'), (c) => {
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: ordersService.decline(c.get('requestContext'), params.proposalId, idempotencyKey(c)) })
})
