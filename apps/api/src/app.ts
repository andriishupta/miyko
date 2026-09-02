import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware, householdContextMiddleware } from './middleware/auth.js'
import { applySecurityMiddleware } from './middleware/security.js'
import { requestContextMiddleware, requestLoggingMiddleware } from './middleware/request-context.js'
import { notFoundMiddleware } from './middleware/fallback.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { authRoutes } from './features/auth/auth.routes.js'
import { dashboardRoutes } from './features/dashboard/dashboard.routes.js'
import { productsRoutes } from './features/products/products.routes.js'
import { householdsRoutes, invitationAcceptanceRoutes, onboardingRoutes } from './features/households/households.routes.js'
import { ordersRoutes } from './features/orders/orders.routes.js'
import { deliveriesRoutes } from './features/deliveries/deliveries.routes.js'
import { audioRoutes } from './features/audio/audio.routes.js'
import { memoryRoutes } from './features/memory/memory.routes.js'
import { householdProviderRoutes, providersRoutes } from './features/providers/providers.routes.js'

const protectedApi = new Hono()
protectedApi.use('*', authMiddleware)
protectedApi.use('*', householdContextMiddleware)
protectedApi.route('/dashboard', dashboardRoutes)
protectedApi.route('/products', productsRoutes)
protectedApi.route('/household', householdsRoutes)
protectedApi.route('/orders', ordersRoutes)
protectedApi.route('/deliveries', deliveriesRoutes)
protectedApi.route('/audio', audioRoutes)
protectedApi.route('/memory', memoryRoutes)
protectedApi.route('/providers', householdProviderRoutes)

export const app = new Hono()
applySecurityMiddleware(app)
app.use('*', requestContextMiddleware)
app.use('*', requestLoggingMiddleware)

app.get('/health', (c) => c.json({ data: { status: 'ok', service: 'miyko-api', mode: 'scaffold' } }))
app.route('/auth', authRoutes)
app.route('/invitations', invitationAcceptanceRoutes)
app.route('/onboarding', onboardingRoutes)
app.route('/providers', providersRoutes)
app.route('/', protectedApi)
// Keep even unknown non-health paths behind authentication.
app.use('*', authMiddleware)
app.use('*', notFoundMiddleware)

export const onUncaughtError = (error: Error, c: Context) => {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message, requestId: c.get('requestId') } }, error.status)
  }
  if (error instanceof HTTPException) return c.json({ error: { code: 'HTTP_ERROR', message: 'Request could not be processed', requestId: c.get('requestId') } }, error.status)
  logger.error('request.failed', { requestId: c.get('requestId'), method: c.req.method, path: c.req.path, error: error.message })
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: c.get('requestId') } }, 500)
}

app.onError(onUncaughtError)
