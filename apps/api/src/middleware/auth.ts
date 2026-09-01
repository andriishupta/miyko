import type { MiddlewareHandler } from 'hono'
import { forbidden, unauthorized } from '../lib/errors.js'
import { findHousehold, findMembership, findUser, findUserByToken } from '../lib/mock-store.js'
import type { Role } from '../lib/types.js'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
  const user = token ? findUserByToken(token) : undefined
  if (!user) throw unauthorized()
  c.set('user', user)
  await next()
}

export const householdContextMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user')
  const householdId = c.req.header('x-household-id') || user.defaultHouseholdId
  const household = findHousehold(householdId)
  const membership = household ? findMembership(user.id, household.id) : undefined
  if (!household || !membership) throw forbidden()
  c.set('requestContext', { requestId: c.get('requestId'), user, household, membership })
  await next()
}

export const requireRole = (...roles: Role[]): MiddlewareHandler => async (c, next) => {
  if (!roles.includes(c.get('requestContext').membership.role)) throw forbidden()
  await next()
}

export const protectedRoute = [authMiddleware, householdContextMiddleware]

export const userById = (id: string) => findUser(id)

