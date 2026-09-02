import type { MiddlewareHandler } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'
import { households, householdMembers, userSessions, users } from '@miyko/database/schema'
import { db, withRlsContext } from '../lib/database.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import type { HouseholdRole } from '@miyko/contracts'
import { toContractHousehold, toContractMembership, toContractUser } from '../lib/serializers.js'
import { authService, sha256 } from '../features/auth/auth.service.js'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
  if (!token) throw unauthorized()
  const session = await authService.lookupSession(sha256(token))
  if (!session) throw unauthorized()

  await withRlsContext(session.user_id, async () => {
    // Re-check both rows through ordinary RLS-protected queries after the
    // SECURITY DEFINER bootstrap lookup established the trusted identity.
    const [user, sessionRow] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user_id) }),
      db.query.userSessions.findFirst({
        where: and(eq(userSessions.id, session.session_id), eq(userSessions.userId, session.user_id), isNull(userSessions.revokedAt)),
      }),
    ])
    if (!user || !sessionRow || sessionRow.expiresAt <= new Date() || user.status !== 'active') throw unauthorized()

    await db.update(userSessions).set({ lastUsedAt: new Date() }).where(eq(userSessions.id, sessionRow.id))
    c.set('user', toContractUser(user))
    await next()
  })
}

export const householdContextMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user')
  const householdId = c.req.header('x-household-id')
  if (!householdId) throw forbidden()
  const household = await db.query.households.findFirst({ where: eq(households.id, householdId) })
  const membership = await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.userId, user.id), eq(householdMembers.householdId, householdId), eq(householdMembers.status, 'active')) })
  if (!household || !membership) throw forbidden()
  c.set('requestContext', { requestId: c.get('requestId'), user, household: toContractHousehold(household), membership: toContractMembership(membership) })
  await next()
}

export const requireRole = (...roles: HouseholdRole[]): MiddlewareHandler => async (c, next) => {
  if (!roles.includes(c.get('requestContext').membership.role)) throw forbidden()
  await next()
}

export const protectedRoute = [authMiddleware, householdContextMiddleware]
