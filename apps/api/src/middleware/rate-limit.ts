import type { MiddlewareHandler } from 'hono'
import { tooManyRequests } from '../lib/errors.js'

const buckets = new Map<string, { count: number; resetAt: number }>()

export const rateLimit = (name: string, limit: number, windowMs: number): MiddlewareHandler => async (c, next) => {
  const key = `${name}:${c.req.header('x-forwarded-for') ?? c.req.header('authorization') ?? 'anonymous'}`
  const now = Date.now()
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
  bucket.count += 1
  buckets.set(key, bucket)
  c.header('x-ratelimit-limit', String(limit))
  c.header('x-ratelimit-remaining', String(Math.max(0, limit - bucket.count)))
  if (bucket.count > limit) throw tooManyRequests()
  await next()
}

