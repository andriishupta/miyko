import { forbidden, notFound } from '../../lib/errors.js'
import { findHousehold, findMembership, memberships, users } from '../../lib/mock-store.js'
import type { RequestContext, Role, User } from '../../lib/types.js'

type Invitation = { id: string; householdId: string; email: string; role: Exclude<Role, 'owner'>; status: 'pending' | 'accepted'; invitedBy: string }
const invitations: Invitation[] = [{ id: 'invitation-demo-1', householdId: 'household-petrenko', email: 'friend@miyko.local', role: 'adult_member', status: 'pending', invitedBy: 'user-andrii' }]

export class HouseholdsService {
  summary(context: RequestContext) { return { ...context.household, role: context.membership.role } }

  members(context: RequestContext) {
    return memberships.filter((membership) => membership.householdId === context.household.id).map((membership) => {
      const user = users.find((candidate) => candidate.id === membership.userId)
      return { id: user?.id, name: user?.name, email: user?.email, role: membership.role }
    })
  }

  invite(context: RequestContext, email: string, role: Exclude<Role, 'owner'>) {
    if (context.membership.role !== 'owner') throw forbidden()
    const invitation: Invitation = { id: `invitation-${Date.now()}`, householdId: context.household.id, email, role, status: 'pending', invitedBy: context.user.id }
    invitations.push(invitation)
    return invitation
  }

  listInvitations(context: RequestContext) { return invitations.filter((invitation) => invitation.householdId === context.household.id) }

  accept(context: RequestContext, invitationId: string) {
    const invitation = invitations.find((candidate) => candidate.id === invitationId && candidate.householdId === context.household.id)
    if (!invitation) throw notFound('Invitation')
    invitation.status = 'accepted'
    return invitation
  }

  acceptForUser(user: User, invitationId: string) {
    const invitation = invitations.find((candidate) => candidate.id === invitationId && candidate.email === user.email && candidate.status === 'pending')
    const household = invitation ? findHousehold(invitation.householdId) : undefined
    if (!invitation || !household) throw notFound('Invitation')
    if (!findMembership(user.id, household.id)) memberships.push({ userId: user.id, householdId: household.id, role: invitation.role })
    invitation.status = 'accepted'
    return invitation
  }
}

export const householdsService = new HouseholdsService()
