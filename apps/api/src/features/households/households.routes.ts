import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../middleware/auth.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { createHouseholdSchema, invitationIdSchema, inviteSchema } from './households.schemas.js'
import { householdsService } from './households.service.js'

export const householdsRoutes = new Hono()
householdsRoutes.get('/', async (c) => c.json({ data: await householdsService.summary(c.get('requestContext')) }))
householdsRoutes.get('/members', async (c) => c.json({ data: await householdsService.members(c.get('requestContext')) }))
householdsRoutes.get('/invitations', async (c) => c.json({ data: await householdsService.listInvitations(c.get('requestContext')) }))
householdsRoutes.post('/invitations', requireRole('owner', 'admin'), async (c) => {
  const input = await parseJson(c, inviteSchema)
  return c.json({ data: await householdsService.invite(c.get('requestContext'), input) }, 201)
})
householdsRoutes.post('/invitations/:id/accept', async (c) => {
  const params = parseParams(c, invitationIdSchema)
  return c.json({ data: await householdsService.acceptForUser(c.get('user'), params.id) })
})

export const invitationAcceptanceRoutes = new Hono()
invitationAcceptanceRoutes.post('/:id/accept', authMiddleware, async (c) => {
  const params = parseParams(c, invitationIdSchema)
  return c.json({ data: await householdsService.acceptForUser(c.get('user'), params.id) })
})

export const onboardingRoutes = new Hono()
onboardingRoutes.post('/households', authMiddleware, async (c) => {
  const input = await parseJson(c, createHouseholdSchema)
  return c.json({ data: await householdsService.createForUser(c.get('user'), input.name) }, 201)
})
