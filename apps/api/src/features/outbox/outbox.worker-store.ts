import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../lib/database.js";
import { AppError } from "../../lib/errors.js";
import type { OutboxEventRow } from "./outbox.service.js";

const claimedRowSchema = z.object({
  user_id: z.string().uuid(),
  member_id: z.string().uuid(),
  id: z.string().uuid(),
  household_id: z.string().uuid(),
  aggregate_type: z.string(),
  aggregate_id: z.string().uuid(),
  event_type: z.string(),
  version: z.number().int(),
  payload: z.record(z.unknown()),
  status: z.enum(["pending", "processing", "published", "retrying", "dead_letter"]),
  attempts: z.number().int(),
  available_at: z.coerce.date(),
  claimed_at: z.coerce.date().nullable(),
  claimed_by: z.string().nullable(),
  claim_expires_at: z.coerce.date().nullable(),
  processed_at: z.coerce.date().nullable(),
  last_error: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
}).strict();

export type StandaloneOutboxClaim = {
  userId: string;
  memberId: string;
  event: OutboxEventRow;
};

const rowsOf = (value: unknown): unknown => {
  if (value && typeof value === "object" && "rows" in value) return value.rows;
  return value;
};

export class OutboxWorkerStore {
  async claim(workerId: string, limit: number, leaseMs: number): Promise<StandaloneOutboxClaim[]> {
    let result: unknown;
    try {
      result = await db.execute(sql`
        select * from public.miyko_claim_outbox_events(
          ${workerId}, ${limit}, ${leaseMs}
        )
      `);
    } catch {
      throw new AppError("OUTBOX_RLS_WORKER_UNAVAILABLE", "Standalone outbox worker database boundary is unavailable", 503);
    }

    const parsed = z.array(claimedRowSchema).safeParse(rowsOf(result));
    if (!parsed.success) throw new AppError("OUTBOX_INVALID_CLAIM", "Standalone outbox worker returned an invalid claim", 502);

    return parsed.data.map((row) => ({
      userId: row.user_id,
      memberId: row.member_id,
      event: {
        id: row.id,
        householdId: row.household_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        version: row.version,
        payload: row.payload,
        status: row.status,
        attempts: row.attempts,
        availableAt: row.available_at,
        claimedAt: row.claimed_at,
        claimedBy: row.claimed_by,
        claimExpiresAt: row.claim_expires_at,
        processedAt: row.processed_at,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }));
  }
}

export const outboxWorkerStore = new OutboxWorkerStore();
