import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware, householdContextMiddleware } from './middleware/auth.js'
import { applySecurityMiddleware } from './middleware/security.js'
import { requestContextMiddleware, requestLoggingMiddleware } from './middleware/request-context.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { authRoutes } from './features/auth/auth.routes.js'
import { dashboardRoutes } from './features/dashboard/dashboard.routes.js'
import { productsRoutes } from './features/products/products.routes.js'
import { householdsRoutes, invitationAcceptanceRoutes } from './features/households/households.routes.js'
import { ordersRoutes } from './features/orders/orders.routes.js'
import { deliveriesRoutes } from './features/deliveries/deliveries.routes.js'
import { settingsRoutes } from './features/settings/settings.routes.js'
import { audioRoutes } from './features/audio/audio.routes.js'
import { memoryRoutes } from './features/memory/memory.routes.js'

const protectedApi = new Hono()
protectedApi.use('*', authMiddleware)
protectedApi.use('*', householdContextMiddleware)
protectedApi.route('/dashboard', dashboardRoutes)
protectedApi.route('/products', productsRoutes)
protectedApi.route('/household', householdsRoutes)
protectedApi.route('/orders', ordersRoutes)
protectedApi.route('/deliveries', deliveriesRoutes)
protectedApi.route('/settings', settingsRoutes)
protectedApi.route('/audio', audioRoutes)
protectedApi.route('/memory', memoryRoutes)

export const app = new Hono()
applySecurityMiddleware(app)
app.use('*', requestContextMiddleware)
app.use('*', requestLoggingMiddleware)

app.get('/health', (c) => c.json({ data: { status: 'ok', service: 'miyko-api', mode: 'mock' } }))
app.route('/auth', authRoutes)
app.route('/invitations', invitationAcceptanceRoutes)
app.route('/', protectedApi)
// Keep even unknown non-health paths behind authentication.
app.use('*', authMiddleware)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))
app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message, requestId: c.get('requestId') } }, error.status)
  }
  if (error instanceof HTTPException) return c.json({ error: { code: 'HTTP_ERROR', message: 'Request could not be processed', requestId: c.get('requestId') } }, error.status)
  logger.error('request.failed', { requestId: c.get('requestId'), method: c.req.method, path: c.req.path, error: error.message })
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: c.get('requestId') } }, 500)
})
