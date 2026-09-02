import { Hono } from 'hono'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { planningIntentSchema, planningRunIdSchema } from './planning.schemas.js'
import { planningService } from './planning.service.js'

export const planningRoutes = new Hono()

planningRoutes.post('/', rateLimit('planning-start', 10, 60_000), async (c) => {
  const input = await parseJson(c, planningIntentSchema)
  return c.json({ data: await planningService.run(c.get('requestContext'), input.intentId) })
})

planningRoutes.get('/:planningRunId', async (c) => {
  const params = parseParams(c, planningRunIdSchema)
  return c.json({ data: await planningService.get(c.get('requestContext'), params.planningRunId) })
})

