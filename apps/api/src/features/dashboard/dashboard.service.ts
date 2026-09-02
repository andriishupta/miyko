import { and, desc, eq, inArray } from 'drizzle-orm'
import { connectedProviderAccounts, deliveries, householdMembers, mealPlans, orders, shoppingProposals } from '@miyko/database/schema'
import type { DashboardResponse, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { toContractOrder } from '../../lib/serializers.js'

export class DashboardService {
  async getDashboard(context: RequestContext, date?: string): Promise<DashboardResponse> {
    const [plan, latestOrder, latestDelivery, memberRows, pendingProposals, connectedAccounts] = await Promise.all([
      db.query.mealPlans.findFirst({ where: and(eq(mealPlans.householdId, context.household.id), inArray(mealPlans.status, ['draft', 'active'])), with: { items: true }, orderBy: [desc(mealPlans.updatedAt)] }),
      db.query.orders.findFirst({ where: eq(orders.householdId, context.household.id), with: { items: true }, orderBy: [desc(orders.createdAt)] }),
      db.query.deliveries.findFirst({ where: eq(deliveries.householdId, context.household.id), orderBy: [desc(deliveries.scheduledFrom), desc(deliveries.createdAt)], with: { order: true } }),
      db.query.householdMembers.findMany({ where: eq(householdMembers.householdId, context.household.id) }),
      db.query.shoppingProposals.findMany({ where: and(eq(shoppingProposals.householdId, context.household.id), inArray(shoppingProposals.status, ['draft', 'awaiting_changes', 'awaiting_owner_approval'])) }),
      db.query.connectedProviderAccounts.findMany({ where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, 'active')) }),
    ])
    const targetDate = date ?? new Date().toISOString().slice(0, 10)
    const items = (plan?.items ?? []).filter((item) => item.plannedFor.toISOString().slice(0, 10) === targetDate)
    return {
      household: context.household,
      date: targetDate,
      upcomingEvents: items.map((item) => ({ id: item.id, type: item.type, title: item.title, scheduledFor: item.plannedFor.toISOString(), status: plan?.status ?? 'draft' })),
      planning: plan ? { active: true, title: plan.name, proposalId: pendingProposals[0]?.id ?? null, status: plan.status } : { active: false, title: null, proposalId: pendingProposals[0]?.id ?? null, status: 'none' },
      latestOrder: latestOrder ? toContractOrder(latestOrder) : null,
      latestDelivery: latestDelivery ? { id: latestDelivery.id, orderId: latestDelivery.orderId, status: latestDelivery.status, scheduledFor: latestDelivery.scheduledFrom?.toISOString() ?? null, total: Number(latestDelivery.order?.totalAmount ?? 0), currency: 'UAH' as const } : null,
      householdSummary: { memberCount: memberRows.length, connectedShoppingAccounts: connectedAccounts.length, pendingApprovals: pendingProposals.length },
      input: { audioEnabled: true, chatEnabled: true },
    }
  }
}
export const dashboardService = new DashboardService()
