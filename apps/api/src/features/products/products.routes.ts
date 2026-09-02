import { Hono } from 'hono'
import { parseParams, parseQuery } from '../../middleware/validation.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { productIdSchema, productSearchSchema } from './products.schemas.js'
import { productsService } from './products.service.js'

export const productsRoutes = new Hono()

productsRoutes.get('/search', rateLimit('product-search', 60, 60_000), async (c) => {
  const query = parseQuery(c, productSearchSchema)
  return c.json({ data: await productsService.search(c.get('requestContext'), query.query, query.category, query.limit) })
})

productsRoutes.get('/:id/replacements', async (c) => {
  const params = parseParams(c, productIdSchema)
  return c.json({ data: await productsService.replacements(c.get('requestContext'), params.id) })
})

productsRoutes.get('/:id', async (c) => {
  const params = parseParams(c, productIdSchema)
  return c.json({ data: await productsService.details(c.get('requestContext'), params.id) })
})
