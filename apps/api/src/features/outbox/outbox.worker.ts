import { randomUUID } from 'node:crypto'
import type { RequestContext } from '@miyko/contracts'
import { withRlsContext } from '../../lib/database.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { outboxHandlers } from './outbox.handlers.js'
import { outboxService } from './outbox.service.js'

const maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 5)
const baseBackoffMs = Number(process.env.OUTBOX_BASE_BACKOFF_MS ?? 1_000)
const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5_000)

export class OutboxWorker {
  private readonly workerId = `api:${randomUUID()}`
  private readonly contexts = new Map<string, RequestContext>()
  private timer: ReturnType<typeof setInterval> | undefined
  private running = false

  register(context: RequestContext) {
    this.contexts.set(`${context.user.id}:${context.household.id}`, context)
    this.start()
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.runRegistered(), pollIntervalMs)
    if (typeof this.timer === 'object' && 'unref' in this.timer) this.timer.unref()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async runOnce(context: RequestContext) {
    return withRlsContext(context.user.id, async () => {
      const claimed = await outboxService.claim(context, this.workerId)
      let published = 0
      let retrying = 0
      let deadLetter = 0
      for (const event of claimed) {
        const handler = outboxHandlers[event.eventType]
        if (!handler) {
          await outboxService.markFailed(event.id, event.householdId, maxAttempts, 'UNKNOWN_EVENT_TYPE', maxAttempts, 0)
          deadLetter += 1
          continue
        }
        try {
          await handler(context, event)
          await outboxService.markPublished(event.id, event.householdId)
          published += 1
        } catch (error) {
          const safeError = error instanceof AppError ? error.code : 'OUTBOX_HANDLER_FAILED'
          const backoffMs = Math.min(baseBackoffMs * (2 ** Math.max(event.attempts - 1, 0)), 3_600_000)
          await outboxService.markFailed(event.id, event.householdId, event.attempts, safeError, maxAttempts, backoffMs)
          if (event.attempts >= maxAttempts) deadLetter += 1
          else retrying += 1
        }
      }
      return { claimed: claimed.length, published, retrying, deadLetter }
    })
  }

  private async runRegistered() {
    if (this.running) return
    this.running = true
    try {
      for (const context of this.contexts.values()) {
        try {
          const result = await this.runOnce(context)
          if (result.claimed > 0) logger.info('outbox.processed', { requestId: context.requestId, householdId: context.household.id, ...result })
        } catch (error) {
          logger.error('outbox.worker.failed', { requestId: context.requestId, householdId: context.household.id, error: error instanceof AppError ? error.code : 'OUTBOX_WORKER_FAILED' })
        }
      }
    } finally {
      this.running = false
    }
  }
}

export const outboxWorker = new OutboxWorker()
