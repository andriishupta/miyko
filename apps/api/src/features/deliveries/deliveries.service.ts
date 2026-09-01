import { notFound } from '../../lib/errors.js'
import { deliveries } from '../../lib/mock-store.js'
import { mcpService } from '../../integrations/mcp/mcp.service.js'
import type { RequestContext } from '../../lib/types.js'

export class DeliveriesService {
  async latest(context: RequestContext) { return (await mcpService.getOrderHistory(context.household.id))[0] ?? null }
  async all(context: RequestContext) { return mcpService.getOrderHistory(context.household.id) }
  details(context: RequestContext, id: string) {
    const delivery = deliveries.find((candidate) => candidate.id === id && candidate.householdId === context.household.id)
    if (!delivery) throw notFound('Delivery')
    return delivery
  }
}
export const deliveriesService = new DeliveriesService()

