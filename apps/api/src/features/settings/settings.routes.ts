import { Hono } from 'hono'
import { parseJson } from '../../middleware/validation.js'
import { settingsUpdateSchema } from './settings.schemas.js'
import { settingsService } from './settings.service.js'

export const settingsRoutes = new Hono()
settingsRoutes.get('/', (c) => c.json({ data: settingsService.get(c.get('requestContext')) }))
settingsRoutes.patch('/', async (c) => c.json({ data: settingsService.update(c.get('requestContext'), await parseJson(c, settingsUpdateSchema)) }))

