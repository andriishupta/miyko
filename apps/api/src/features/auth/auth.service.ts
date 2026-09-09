import { randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { householdMembers, userSessions, users } from '@miyko/database/schema'
import type { AuthUser, LoginResponse, RegisterRequest } from '@miyko/contracts'
import { db, withRlsContext } from '../../lib/database.js'
import { conflict, unauthorized } from '../../lib/errors.js'
import { toContractUser } from '../../lib/serializers.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { sha256 } from '../../lib/crypto.js'
import { toPostgresTimestamp } from '../../lib/dates.js'

const SESSION_DAYS = 30

type AuthUserLookup = {
  id: string
  email: string
  normalized_email: string
  password_hash: string
  first_name: string
  last_name: string
  display_name: string | null
  status: 'active' | 'suspended' | 'deactivated'
  last_login_at: Date | null
}

type AuthSessionLookup = {
  session_id: string
  user_id: string
  expires_at: Date
  revoked_at: Date | null
  last_used_at: Date | null
}

const firstRow = <T>(rows: unknown) => (rows as T[])[0]

export class AuthService {
  // These calls happen before app.user_id exists. The SQL functions are
  // SECURITY DEFINER and expose only the minimum fields needed by auth.
  async lookupUserByEmail(email: string): Promise<AuthUserLookup | undefined> {
    const rows = await db.execute(sql`select * from public.miyko_auth_find_user_by_email(${email})`)
    return firstRow<AuthUserLookup>(rows)
  }

  async lookupSession(tokenHash: string): Promise<AuthSessionLookup | undefined> {
    const rows = await db.execute(sql`select * from public.miyko_auth_find_session(${tokenHash})`)
    return firstRow<AuthSessionLookup>(rows)
  }

  async register(input: RegisterRequest): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase()
    const rows = await db.execute(sql`
      select * from public.miyko_auth_create_user(
        ${email}, ${email}, ${hashPassword(input.password)},
        ${input.firstName.trim()}, ${input.lastName.trim()}, ${input.displayName?.trim() || null}
      )
    `)
    const created = firstRow<AuthUserLookup>(rows)
    if (!created) throw conflict('An account with this email already exists')

    return this.createSession(created.id)
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.lookupUserByEmail(email.trim().toLowerCase())
    if (!user || !verifyPassword(password, user.password_hash)) throw unauthorized()

    return this.createSession(user.id)
  }

  private async createSession(userId: string): Promise<LoginResponse> {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
    const sessionRows = await db.execute(sql`
      select * from public.miyko_auth_create_session(
        ${userId}::uuid,
        ${sha256(token)},
        ${toPostgresTimestamp(expiresAt)}::timestamptz
      )
    `)
    if (!firstRow<{ session_id: string }>(sessionRows)) throw unauthorized()

    return withRlsContext(userId, async () => {
      await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId))

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!user) throw unauthorized()
      const member = await db.query.householdMembers.findFirst({
        where: and(eq(householdMembers.userId, userId), eq(householdMembers.status, 'active')),
      })
      return { accessToken: token, user: toContractUser(user), householdId: member?.householdId ?? null, expiresAt: expiresAt.toISOString() }
    })
  }

  async session(user: AuthUser): Promise<{ user: AuthUser; householdId: string | null }> {
    const member = await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.userId, user.id), eq(householdMembers.status, 'active')) })
    return { user, householdId: member?.householdId ?? null }
  }

  async revoke(token: string) {
    await db.update(userSessions).set({ revokedAt: new Date(), lastUsedAt: new Date() }).where(and(eq(userSessions.tokenHash, sha256(token)), isNull(userSessions.revokedAt)))
    return { revoked: true }
  }
}

export const authService = new AuthService()
