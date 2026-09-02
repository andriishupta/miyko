import { Hono } from 'hono'
import { parseJson, parseQuery } from '../../middleware/validation.js'
import { memoryQuerySchema, memoryWriteSchema } from './memory.schemas.js'
import { memoryService } from './memory.service.js'

export const memoryRoutes = new Hono()
memoryRoutes.get('/status', async (c) => c.json({ data: await memoryService.status() }))
memoryRoutes.get('/', async (c) => {
  const query = parseQuery(c, memoryQuerySchema)
  return c.json({ data: await memoryService.search(c.get('requestContext'), query.query, query.memberId) })
})
memoryRoutes.post('/', async (c) => c.json({ data: await memoryService.write(c.get('requestContext'), await parseJson(c, memoryWriteSchema)) }, 201))
