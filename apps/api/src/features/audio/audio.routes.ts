import { Hono } from 'hono'
import { parseJson } from '../../middleware/validation.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { audioProcessSchema } from './audio.schemas.js'
import { audioService } from './audio.service.js'

export const audioRoutes = new Hono()
audioRoutes.post('/process', rateLimit('audio-process', 20, 60_000), async (c) => {
  const input = await parseJson(c, audioProcessSchema)
  return c.json({ data: await audioService.process(c.get('requestContext'), input) })
})
