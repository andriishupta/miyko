import type { MiddlewareHandler } from 'hono'
import { logger } from '../lib/logger.js'

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id')?.slice(0, 128) || crypto.randomUUID()
  c.set('requestId', requestId)
  c.header('x-request-id', requestId)
  await next()
}

export const requestLoggingMiddleware: MiddlewareHandler = async (c, next) => {
  const startedAt = Date.now()
  await next()
  logger.info('request.completed', {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - startedAt,
  })
}

