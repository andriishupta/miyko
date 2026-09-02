import { Hono } from 'hono'
import { parseJson, parseQuery } from '../../middleware/validation.js'
import { memoryQuerySchema, memoryWriteSchema } from './memory.schemas.js'
import { requireMemoryNamespace } from './memory.access.js'
import { memoryService } from './memory.service.js'

export const memoryRoutes = new Hono()
memoryRoutes.get('/status', async (c) => c.json({ data: await memoryService.status() }))
memoryRoutes.get('/', async (c) => {
  const query = parseQuery(c, memoryQuerySchema)
  const namespace = await requireMemoryNamespace(c.get('requestContext'), query.memberId)
  return c.json({ data: await memoryService.search(namespace, query.query) })
})
memoryRoutes.post('/', async (c) => {
  const input = await parseJson(c, memoryWriteSchema)
  const namespace = await requireMemoryNamespace(c.get('requestContext'), input.memberId)
  return c.json({ data: await memoryService.write(namespace, input) }, 201)
})
