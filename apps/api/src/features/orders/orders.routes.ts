import { Hono } from 'hono'
import type { Context } from 'hono'
import { requireRole } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { AppError } from '../../lib/errors.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { createProposalSchema, editItemSchema, orderIdSchema, proposalIdSchema, proposalItemParamsSchema, replaceItemSchema } from './orders.schemas.js'
import { ordersService } from './orders.service.js'

export const ordersRoutes = new Hono()
const idempotencyKey = (c: Context) => {
  const key = c.req.header('idempotency-key')
  if (!key || key.length > 200) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key required', 400)
  return key
}

ordersRoutes.get('/latest', async (c) => c.json({ data: await ordersService.latest(c.get('requestContext')) }))
ordersRoutes.get('/', async (c) => c.json({ data: await ordersService.list(c.get('requestContext')) }))
ordersRoutes.get('/proposals', async (c) => c.json({ data: await ordersService.listProposals(c.get('requestContext')) }))
ordersRoutes.post('/proposals', rateLimit('proposal-create', 20, 60_000), async (c) => {
  const input = await parseJson(c, createProposalSchema)
  return c.json({ data: await ordersService.createProposal(c.get('requestContext'), input, idempotencyKey(c)) }, 201)
})
ordersRoutes.get('/proposals/:proposalId', async (c) => {
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: await ordersService.getProposal(c.get('requestContext'), params.proposalId) })
})
ordersRoutes.patch('/proposals/:proposalId/items/:itemId', requireRole('owner', 'admin', 'editor'), async (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  const input = await parseJson(c, editItemSchema)
  idempotencyKey(c)
  return c.json({ data: await ordersService.editQuantity(c.get('requestContext'), params.proposalId, params.itemId, input.quantity) })
})
ordersRoutes.post('/proposals/:proposalId/items/:itemId/replace', requireRole('owner', 'admin', 'editor'), async (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  const input = await parseJson(c, replaceItemSchema)
  idempotencyKey(c)
  return c.json({ data: await ordersService.replaceItem(c.get('requestContext'), params.proposalId, params.itemId, input.productId, input.quantity) })
})
ordersRoutes.delete('/proposals/:proposalId/items/:itemId', requireRole('owner', 'admin', 'editor'), async (c) => {
  const params = parseParams(c, proposalItemParamsSchema)
  idempotencyKey(c)
  return c.json({ data: await ordersService.removeItem(c.get('requestContext'), params.proposalId, params.itemId) })
})
ordersRoutes.post('/proposals/:proposalId/approve', requireRole('owner'), async (c) => {
  const key = idempotencyKey(c)
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: await ordersService.approve(c.get('requestContext'), params.proposalId, key) })
})
ordersRoutes.post('/proposals/:proposalId/decline', requireRole('owner'), async (c) => {
  const params = parseParams(c, proposalIdSchema)
  return c.json({ data: await ordersService.decline(c.get('requestContext'), params.proposalId, idempotencyKey(c)) })
})
ordersRoutes.get('/:id', async (c) => {
  const params = parseParams(c, orderIdSchema)
  return c.json({ data: await ordersService.get(c.get('requestContext'), params.id) })
})
