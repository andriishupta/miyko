import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../middleware/auth.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { invitationIdSchema, inviteSchema } from './households.schemas.js'
import { householdsService } from './households.service.js'

export const householdsRoutes = new Hono()
householdsRoutes.get('/', (c) => c.json({ data: householdsService.summary(c.get('requestContext')) }))
householdsRoutes.get('/members', (c) => c.json({ data: householdsService.members(c.get('requestContext')) }))
householdsRoutes.get('/invitations', (c) => c.json({ data: householdsService.listInvitations(c.get('requestContext')) }))
householdsRoutes.post('/invitations', requireRole('owner'), async (c) => {
  const input = await parseJson(c, inviteSchema)
  return c.json({ data: householdsService.invite(c.get('requestContext'), input.email, input.role) }, 201)
})
householdsRoutes.post('/invitations/:id/accept', async (c) => {
  const params = parseParams(c, invitationIdSchema)
  return c.json({ data: householdsService.accept(c.get('requestContext'), params.id) })
})

export const invitationAcceptanceRoutes = new Hono()
invitationAcceptanceRoutes.post('/:id/accept', authMiddleware, (c) => {
  const params = parseParams(c, invitationIdSchema)
  return c.json({ data: householdsService.acceptForUser(c.get('user'), params.id) })
})
