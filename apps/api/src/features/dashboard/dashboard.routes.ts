import { Hono } from 'hono'
import { parseQuery } from '../../middleware/validation.js'
import { dashboardQuerySchema } from './dashboard.schemas.js'
import { dashboardService } from './dashboard.service.js'

export const dashboardRoutes = new Hono()
dashboardRoutes.get('/', (c) => {
  const query = parseQuery(c, dashboardQuerySchema)
  return c.json({ data: dashboardService.getDashboard(c.get('requestContext'), query.date) })
})

