import { randomBytes } from 'node:crypto'
import { and, eq, gt, or, sql } from 'drizzle-orm'
import { householdInvitations, householdMembers, households, users } from '@miyko/database/schema'
import type { AuthUser, CreateHouseholdResponse, HouseholdInvitation, HouseholdSummary, InviteMemberRequest, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { notFound } from '../../lib/errors.js'
import { sha256 } from '../../lib/crypto.js'
import { fromPostgresTimestamp } from '../../lib/dates.js'
import { toContractHousehold, toContractMember, toContractMembership } from '../../lib/serializers.js'

const toInvitation = (row: typeof householdInvitations.$inferSelect): HouseholdInvitation => ({
  id: row.id, householdId: row.householdId, inviterId: row.inviterId, inviteeUserId: row.inviteeUserId, inviteeEmail: row.inviteeEmail,
  role: row.role === 'owner' ? 'viewer' : row.role, status: row.status,
  expiresAt: row.expiresAt.toISOString(), acceptedAt: row.acceptedAt?.toISOString() ?? null,
})

type HouseholdMemberLookup = {
  member_id: string
  household_id: string
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  status: 'active' | 'removed'
  joined_at: Date | string
  removed_at: Date | string | null
  email: string
  display_name: string | null
}

export class HouseholdsService {
  async createForUser(user: AuthUser, name: string): Promise<CreateHouseholdResponse> {
    const { household, member } = await db.transaction(async (tx) => {
      const householdRows = await tx.insert(households).values({ name, ownerId: user.id }).returning()
      const household = householdRows[0]
      const memberRows = await tx.insert(householdMembers).values({ householdId: household.id, userId: user.id, role: 'owner', status: 'active' }).returning()
      return { household, member: memberRows[0] }
    })
    return { household: toContractHousehold(household), membership: toContractMembership(member) }
  }

  async summary(context: RequestContext): Promise<HouseholdSummary> {
    return { ...context.household, currentMember: context.membership }
  }

  async members(context: RequestContext) {
    const rows = await db.execute(sql`
      select * from public.miyko_household_members(${context.household.id}::uuid)
    `)
    return (rows as unknown as HouseholdMemberLookup[]).map((row) => toContractMember({
      id: row.member_id,
      householdId: row.household_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      joinedAt: fromPostgresTimestamp(row.joined_at),
      removedAt: row.removed_at ? fromPostgresTimestamp(row.removed_at) : null,
      user: { id: row.user_id, email: row.email, displayName: row.display_name },
    }))
  }

  async invite(context: RequestContext, input: InviteMemberRequest) {
    const invitee = await db.query.users.findFirst({ where: eq(users.normalizedEmail, input.email.trim().toLowerCase()) })
    const token = randomBytes(32).toString('base64url')
    const row = await db.insert(householdInvitations).values({
      householdId: context.household.id, inviterId: context.user.id, inviteeUserId: invitee?.id ?? null,
      inviteeEmail: invitee ? null : input.email.trim().toLowerCase(), role: input.role,
      tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000),
    }).returning()
    return { invitation: toInvitation(row[0]), token }
  }

  async listInvitations(context: RequestContext) {
    const rows = await db.query.householdInvitations.findMany({ where: eq(householdInvitations.householdId, context.household.id) })
    return rows.map(toInvitation)
  }

  async acceptForUser(user: AuthUser, invitationId: string) {
    const invitation = await db.query.householdInvitations.findFirst({
      where: and(eq(householdInvitations.id, invitationId), eq(householdInvitations.status, 'pending'), gt(householdInvitations.expiresAt, new Date()), or(eq(householdInvitations.inviteeUserId, user.id), eq(householdInvitations.inviteeEmail, user.email.toLowerCase()))),
    })
    if (!invitation) throw notFound('Invitation')
    let memberId: string
    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.householdMembers.findFirst({ where: and(eq(householdMembers.householdId, invitation.householdId), eq(householdMembers.userId, user.id)) })
      if (!existing) {
        const rows = await tx.insert(householdMembers).values({ householdId: invitation.householdId, userId: user.id, role: invitation.role === 'owner' ? 'viewer' : invitation.role, status: 'active' }).returning()
        memberId = rows[0].id
      } else if (existing.status === 'removed') {
        memberId = existing.id
        await tx.update(householdMembers).set({ role: invitation.role === 'owner' ? 'viewer' : invitation.role, status: 'active', joinedAt: new Date(), removedAt: null, updatedAt: new Date() }).where(eq(householdMembers.id, existing.id))
      } else {
        memberId = existing.id
      }
      await tx.update(householdInvitations).set({ inviteeUserId: user.id, inviteeEmail: null, status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() }).where(eq(householdInvitations.id, invitation.id))
      return toInvitation({ ...invitation, inviteeUserId: user.id, inviteeEmail: null, status: 'accepted', acceptedAt: new Date() })
    })
    return result
  }
}

export const householdsService = new HouseholdsService()
