import { logger } from '../../lib/logger.js'
import type { RequestContext } from '@miyko/contracts'
import { outboxService } from './outbox.service.js'

export class MockOutboxWorker {
  async runOnce(context: RequestContext) {
    const result = await outboxService.processPending(context)
    if (result.processed > 0) logger.info('outbox.mock.processed', { requestId: context.requestId, processed: result.processed })
    return result
  }
}

export const mockOutboxWorker = new MockOutboxWorker()
