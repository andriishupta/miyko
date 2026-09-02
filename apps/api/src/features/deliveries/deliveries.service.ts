import { and, desc, eq } from 'drizzle-orm'
import { deliveries, orderItems, orders } from '@miyko/database/schema'
import type { Delivery, DeliveryDetailsResponse, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { notFound } from '../../lib/errors.js'
import { toContractMealPlanItem, toContractOrder } from '../../lib/serializers.js'

type DeliveryRow = typeof deliveries.$inferSelect & { order?: (typeof orders.$inferSelect & { items: Array<typeof orderItems.$inferSelect> }) | null }
const toDelivery = (row: DeliveryRow): Delivery => ({ id: row.id, householdId: row.householdId, orderId: row.orderId, mealPlanItemId: row.mealPlanItemId, deliveryProviderId: row.deliveryProviderId, providerDeliveryId: row.providerDeliveryId, scheduledFrom: row.scheduledFrom?.toISOString() ?? null, scheduledTo: row.scheduledTo?.toISOString() ?? null, addressReference: row.addressReference, status: row.status })

export class DeliveriesService {
  async all(context: RequestContext) {
    const rows = await db.query.deliveries.findMany({ where: eq(deliveries.householdId, context.household.id), orderBy: [desc(deliveries.scheduledFrom), desc(deliveries.createdAt)], with: { order: { with: { items: true } } } })
    return rows.map(toDelivery)
  }

  async latest(context: RequestContext) { return (await this.all(context))[0] ?? null }

  async details(context: RequestContext, id: string): Promise<DeliveryDetailsResponse> {
    const row = await db.query.deliveries.findFirst({ where: and(eq(deliveries.id, id), eq(deliveries.householdId, context.household.id)), with: { order: { with: { items: true } }, mealPlanItem: true } })
    if (!row) throw notFound('Delivery')
    return { delivery: toDelivery(row), order: row.order ? toContractOrder(row.order) : null, mealPlanItem: row.mealPlanItem ? toContractMealPlanItem(row.mealPlanItem) : null }
  }
}
export const deliveriesService = new DeliveriesService()
