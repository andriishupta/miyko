import type { RequestContext } from '../../lib/types.js'

export class DashboardService {
  getDashboard(context: RequestContext, date?: string) {
    return {
      household: { id: context.household.id, name: context.household.name },
      date: date ?? new Date().toISOString().slice(0, 10),
      upcomingEvents: [
        { id: 'event-breakfast-1', type: 'breakfast', title: 'Сніданок', scheduledFor: '2026-09-02T07:30:00.000Z', status: 'planned' },
        { id: 'event-dinner-1', type: 'dinner', title: 'Карбонара', scheduledFor: '2026-09-02T17:30:00.000Z', status: 'planned' },
      ],
      planning: { active: true, title: 'Карбонара на два дні', proposalId: 'proposal-carbonara', status: 'review' },
      latestDelivery: { id: 'delivery-demo-1', status: 'delivered', scheduledFor: '2026-08-30T18:00:00.000Z', total: 671.7, currency: 'UAH' },
      householdSummary: { memberCount: 3, connectedShoppingAccounts: 1, pendingApprovals: 1 },
      input: { audioEnabled: true, chatEnabled: true },
    }
  }
}

export const dashboardService = new DashboardService()
