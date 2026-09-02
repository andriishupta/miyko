import type { AuthUser, Feedback, Household, HouseholdMember, MealPlanItem, Membership, Order, OrderItem, ShoppingProposal } from '@miyko/contracts'

type UserRow = { id: string; email: string; firstName: string; lastName: string; displayName: string | null }
type MemberRow = { id: string; householdId: string; userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer'; status: 'active' | 'removed'; joinedAt: Date; removedAt: Date | null; user?: UserRow | null }

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null

export const toContractUser = (row: UserRow): AuthUser => ({ id: row.id, email: row.email, displayName: row.displayName ?? [row.firstName, row.lastName].filter(Boolean).join(' ') || null })

export const toContractHousehold = (row: { id: string; name: string; ownerId: string; createdAt: Date; updatedAt: Date }): Household => ({ id: row.id, name: row.name, ownerId: row.ownerId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })

export const toContractMembership = (row: { id: string; householdId: string; userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer'; status: 'active' | 'removed' }): Membership => ({ id: row.id, householdId: row.householdId, userId: row.userId, role: row.role, status: row.status })

export const toContractMember = (row: MemberRow): HouseholdMember => ({ id: row.id, householdId: row.householdId, userId: row.userId, role: row.role, status: row.status, joinedAt: row.joinedAt.toISOString(), removedAt: iso(row.removedAt), user: row.user ? toContractUser(row.user) : undefined })

export const toContractMealPlanItem = (row: { id: string; householdId: string; mealPlanId: string; intentId: string | null; type: MealPlanItem['type']; title: string; notes: string | null; servings: number; plannedFor: Date }): MealPlanItem => ({ id: row.id, householdId: row.householdId, mealPlanId: row.mealPlanId, intentId: row.intentId, type: row.type, title: row.title, notes: row.notes, servings: row.servings, plannedFor: row.plannedFor.toISOString() })

export const toContractFeedback = (row: { id: string; householdId: string; memberId: string; mealPlanItemId: string | null; orderId: string | null; kind: Feedback['kind']; subject: string | null; value: Record<string, unknown>; observedAt: Date; createdAt: Date }): Feedback => ({ id: row.id, householdId: row.householdId, memberId: row.memberId, mealPlanItemId: row.mealPlanItemId, orderId: row.orderId, kind: row.kind, subject: row.subject, value: row.value, observedAt: row.observedAt.toISOString(), createdAt: row.createdAt.toISOString() })

const numberValue = (value: string | number | null) => value === null ? null : Number(value)

type OrderItemRow = { id: string; orderId: string; productId: string | null; providerProductIdSnapshot: string; productNameSnapshot: string; quantity: string | number; unit: string; unitPriceSnapshot: string | number | null; totalPriceSnapshot: string | number | null; currency: string; status: OrderItem['status'] }
type OrderRow = { id: string; householdId: string; providerId: string; connectedAccountId: string | null; proposalId: string | null; providerOrderId: string | null; providerBasketId: string | null; status: Order['status']; totalAmount: string | number | null; currency: string; purchasedAt: Date | null; lastProviderSyncAt: Date | null; syncStatus: Order['syncStatus']; items?: OrderItemRow[] }

export const toContractOrder = (row: OrderRow): Order => ({
  id: row.id, householdId: row.householdId, providerId: row.providerId, connectedAccountId: row.connectedAccountId, proposalId: row.proposalId,
  providerOrderId: row.providerOrderId, providerBasketId: row.providerBasketId, status: row.status, totalAmount: numberValue(row.totalAmount), currency: 'UAH',
  purchasedAt: iso(row.purchasedAt), lastProviderSyncAt: iso(row.lastProviderSyncAt), syncStatus: row.syncStatus,
  items: (row.items ?? []).map((item) => ({ id: item.id, orderId: item.orderId, productId: item.productId, providerProductId: item.providerProductIdSnapshot, productName: item.productNameSnapshot, quantity: Number(item.quantity), unit: item.unit, unitPrice: numberValue(item.unitPriceSnapshot), totalPrice: numberValue(item.totalPriceSnapshot), currency: 'UAH', status: item.status })),
})

type ProposalItemRow = { id: string; proposalId: string; productId: string; replacementForProductId: string | null; productNameSnapshot: string; quantity: string | number; unit: string; estimatedUnitPrice: string | number | null; estimatedTotalPrice: string | number | null; currency: string; status: ProposalItem['status']; finalDecisionByMemberId: string | null; finalDecisionAt: Date | null }
type ProposalRow = { id: string; householdId: string; planningRunId: string | null; mealPlanId: string | null; createdByMemberId: string; revision: number; status: ShoppingProposal['status']; approvedByMemberId: string | null; approvedAt: Date | null; declinedByMemberId: string | null; declinedAt: Date | null; createdAt: Date; updatedAt: Date; items?: ProposalItemRow[] }

export const toContractProposal = (row: ProposalRow): ShoppingProposal => ({
  id: row.id, householdId: row.householdId, planningRunId: row.planningRunId, mealPlanId: row.mealPlanId, createdByMemberId: row.createdByMemberId, revision: row.revision,
  status: row.status, approvedByMemberId: row.approvedByMemberId, approvedAt: iso(row.approvedAt), declinedByMemberId: row.declinedByMemberId, declinedAt: iso(row.declinedAt),
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), items: (row.items ?? []).map((item) => ({ id: item.id, proposalId: item.proposalId, productId: item.productId, replacementForProductId: item.replacementForProductId, productName: item.productNameSnapshot, quantity: Number(item.quantity), unit: item.unit, estimatedUnitPrice: numberValue(item.estimatedUnitPrice), estimatedTotalPrice: numberValue(item.estimatedTotalPrice), currency: 'UAH', status: item.status, finalDecisionByMemberId: item.finalDecisionByMemberId, finalDecisionAt: iso(item.finalDecisionAt) })),
})
