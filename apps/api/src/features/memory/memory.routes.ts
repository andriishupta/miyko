import { Hono } from 'hono'
import { parseJson, parseQuery } from '../../middleware/validation.js'
import { feedbackSchema, memoryQuerySchema, memoryWriteSchema } from './memory.schemas.js'
import { memoryService } from './memory.service.js'

export const memoryRoutes = new Hono()
memoryRoutes.get('/', (c) => {
  const query = parseQuery(c, memoryQuerySchema)
  return c.json({ data: memoryService.read(c.get('requestContext'), query.memberId, query.runId) })
})
memoryRoutes.post('/', async (c) => c.json({ data: memoryService.write(c.get('requestContext'), await parseJson(c, memoryWriteSchema)) }, 201))
memoryRoutes.post('/feedback', async (c) => c.json({ data: memoryService.feedback(c.get('requestContext'), await parseJson(c, feedbackSchema)) }, 201))

