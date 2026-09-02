import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { parseJson } from '../../middleware/validation.js'
import { authService } from './auth.service.js'
import { loginSchema, registerSchema } from './auth.schemas.js'

export const authRoutes = new Hono()

authRoutes.post('/login', rateLimit('auth-login', 10, 60_000), async (c) => {
  const input = await parseJson(c, loginSchema)
  return c.json({ data: await authService.login(input.email, input.password) })
})

authRoutes.post('/register', rateLimit('auth-register', 5, 60_000), async (c) => {
  const input = await parseJson(c, registerSchema)
  return c.json({ data: await authService.register(input) }, 201)
})

authRoutes.get('/session', authMiddleware, async (c) => c.json({ data: await authService.session(c.get('user')) }))
authRoutes.post('/logout', authMiddleware, async (c) => {
  const token = c.req.header('authorization')?.slice(7)
  return c.json({ data: token ? await authService.revoke(token) : { revoked: false } })
})
