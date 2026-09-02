import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { householdMembers, households, users } from "@miyko/database/schema";
import type { AuthUser, RequestContext } from "@miyko/contracts";
import { withRlsContext, db } from "../../lib/database.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { toContractHousehold, toContractMembership, toContractUser } from "../../lib/serializers.js";
import { outboxHandlers } from "./outbox.handlers.js";
import { outboxService } from "./outbox.service.js";
import { outboxWorkerStore, type StandaloneOutboxClaim } from "./outbox.worker-store.js";

const maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 5);
const baseBackoffMs = Number(process.env.OUTBOX_BASE_BACKOFF_MS ?? 1_000);
const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5_000);
const claimLimit = Number(process.env.OUTBOX_CLAIM_LIMIT ?? 25);
const leaseMs = Number(process.env.OUTBOX_LEASE_MS ?? 60_000);

const loadContext = async (claim: StandaloneOutboxClaim): Promise<RequestContext> => {
  const [user, household, membership] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, claim.userId) }),
    db.query.households.findFirst({ where: eq(households.id, claim.event.householdId) }),
    db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, claim.memberId), eq(householdMembers.householdId, claim.event.householdId), eq(householdMembers.status, "active")) }),
  ]);
  if (!user || !household || !membership || user.status !== "active") {
    throw new AppError("OUTBOX_RLS_CONTEXT_UNAVAILABLE", "No active household identity is available for the outbox event", 503);
  }

  const authUser: AuthUser = toContractUser(user);
  return {
    requestId: `outbox:${claim.event.id}`,
    user: authUser,
    household: toContractHousehold(household),
    membership: toContractMembership(membership),
  };
};

export class OutboxWorker {
  private readonly workerId = `api:${randomUUID()}`;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => {
        logger.error("outbox.worker.failed", { error: error instanceof AppError ? error.code : "OUTBOX_WORKER_FAILED" });
      });
    }, pollIntervalMs);
    if (typeof this.timer === "object" && "unref" in this.timer) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce() {
    if (this.running) return { claimed: 0, published: 0, retrying: 0, deadLetter: 0 };
    this.running = true;
    try {
      const claims = await outboxWorkerStore.claim(this.workerId, claimLimit, leaseMs);
      let published = 0;
      let retrying = 0;
      let deadLetter = 0;

      for (const claim of claims) {
        try {
          const result = await withRlsContext(claim.userId, async () => this.processClaim(claim));
          published += result.published;
          retrying += result.retrying;
          deadLetter += result.deadLetter;
        } catch (error) {
          logger.error("outbox.event.failed", { eventId: claim.event.id, error: error instanceof AppError ? error.code : "OUTBOX_EVENT_FAILED" });
        }
      }

      const result = { claimed: claims.length, published, retrying, deadLetter };
      if (claims.length > 0) logger.info("outbox.processed", result);
      return result;
    } finally {
      this.running = false;
    }
  }

  private async processClaim(claim: StandaloneOutboxClaim) {
    const context = await loadContext(claim);
    const event = claim.event;
    const handler = outboxHandlers[event.eventType];
    if (!handler) {
      await outboxService.markFailed(event.id, event.householdId, maxAttempts, "UNKNOWN_EVENT_TYPE", maxAttempts, 0);
      return { published: 0, retrying: 0, deadLetter: 1 };
    }

    try {
      await handler(context, event);
      await outboxService.markPublished(event.id, event.householdId);
      return { published: 1, retrying: 0, deadLetter: 0 };
    } catch (error) {
      const safeError = error instanceof AppError ? error.code : "OUTBOX_HANDLER_FAILED";
      const backoffMs = Math.min(baseBackoffMs * (2 ** Math.max(event.attempts - 1, 0)), 3_600_000);
      await outboxService.markFailed(event.id, event.householdId, event.attempts, safeError, maxAttempts, backoffMs);
      return event.attempts >= maxAttempts
        ? { published: 0, retrying: 0, deadLetter: 1 }
        : { published: 0, retrying: 1, deadLetter: 0 };
    }
  }
}

export const outboxWorker = new OutboxWorker();
