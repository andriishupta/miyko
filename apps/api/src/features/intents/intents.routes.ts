import { Hono } from 'hono'
import { parseJson } from '../../middleware/validation.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { createIntentSchema } from './intents.schemas.js'
import { intentsService } from './intents.service.js'

export const intentsRoutes = new Hono()

intentsRoutes.post('/', rateLimit('intent-create', 20, 60_000), async (c) => {
  const input = await parseJson(c, createIntentSchema)
  return c.json({ data: await intentsService.create(c.get('requestContext'), input) }, 201)
})

