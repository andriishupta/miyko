import { Hono } from 'hono'
import { parseParams } from '../../middleware/validation.js'
import { deliveryIdSchema } from './deliveries.schemas.js'
import { deliveriesService } from './deliveries.service.js'

export const deliveriesRoutes = new Hono()
deliveriesRoutes.get('/latest', async (c) => c.json({ data: await deliveriesService.latest(c.get('requestContext')) }))
deliveriesRoutes.get('/', async (c) => c.json({ data: await deliveriesService.all(c.get('requestContext')) }))
deliveriesRoutes.get('/:id', (c) => {
  const params = parseParams(c, deliveryIdSchema)
  return c.json({ data: deliveriesService.details(c.get('requestContext'), params.id) })
})

