import { outbox } from '../../lib/mock-store.js'
import type { RequestContext } from '../../lib/types.js'

export class OutboxService {
  listPending(context: RequestContext) { return outbox.filter((event) => event.householdId === context.household.id && event.status === 'pending') }

  async processPending(context: RequestContext) {
    const pending = this.listPending(context)
    pending.forEach((event) => {
      event.attempts += 1
      event.status = 'processed'
      event.processedAt = new Date().toISOString()
    })
    return { processed: pending.length, events: pending }
  }
}
export const outboxService = new OutboxService()

