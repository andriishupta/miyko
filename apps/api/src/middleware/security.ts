import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Hono } from 'hono'
import { config } from '../lib/config.js'

export const applySecurityMiddleware = <T extends Hono>(app: T) => {
  app.use('*', secureHeaders())
  app.use('*', cors({
    origin: (origin) => config.allowedOrigins.includes(origin) ? origin : undefined,
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Household-Id', 'X-Request-Id'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  app.use('*', bodyLimit({ maxSize: 10 * 1024 * 1024 }))
  return app
}
