import { Hono } from 'hono'
import { dashboardService } from './dashboard.service.js'

export const dashboardRoutes = new Hono()
dashboardRoutes.get('/', async (c) => c.json({ data: await dashboardService.getDashboard(c.get('requestContext')) }))
