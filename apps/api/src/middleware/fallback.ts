import type { MiddlewareHandler } from 'hono'

export const notFoundMiddleware: MiddlewareHandler = async (c, next) => {
  await next()
  if (c.res.status === 404) return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: c.get('requestId') } }, 404)
}
