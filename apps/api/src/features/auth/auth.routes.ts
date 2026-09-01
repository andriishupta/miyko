import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { parseJson } from '../../middleware/validation.js'
import { authService } from './auth.service.js'
import { loginSchema } from './auth.schemas.js'

export const authRoutes = new Hono()

authRoutes.post('/login', rateLimit('auth-login', 10, 60_000), async (c) => {
  const input = await parseJson(c, loginSchema)
  return c.json({ data: authService.login(input.email, input.password) })
})

authRoutes.get('/session', authMiddleware, (c) => c.json({ data: authService.session(c.get('user')) }))
authRoutes.post('/logout', authMiddleware, (c) => c.json({ data: authService.logout(c.req.header('authorization')) }))
