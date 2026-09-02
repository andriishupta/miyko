import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

export const providerCapabilitySchema = z.string().min(1);

export const providerSchema = z.object({
  id: uuid,
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: z.enum(["store", "delivery"]),
  status: z.enum(["active", "inactive"]),
  capabilities: z.array(providerCapabilitySchema),
});

export const providerAuthRequestSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export const userProviderAccountSchema = z.object({
  id: uuid,
  providerId: uuid,
  providerSubject: z.string().nullable(),
  accountLogin: z.string().nullable(),
  authMethod: z.enum(["oauth", "password", "api_key", "mcp"]),
  status: z.enum(["active", "expired", "revoked", "reconnect_required"]),
  scopes: z.array(z.string()),
  accessTokenExpiresAt: isoDate.nullable(),
  refreshTokenExpiresAt: isoDate.nullable(),
  lastUsedAt: isoDate.nullable(),
});

export const providerConnectionResponseSchema = z.object({
  provider: providerSchema,
  account: userProviderAccountSchema,
});

export const providerAccountsResponseSchema = z.object({
  items: z.array(userProviderAccountSchema.extend({ provider: providerSchema })),
});

export const providerOrderSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  total: z.number().nonnegative(),
  currency: z.literal("UAH"),
  placedAt: isoDate.nullable(),
});

export const providerOrdersResponseSchema = z.object({
  provider: providerSchema,
  items: z.array(providerOrderSchema),
});

export const providerSyncStatusResponseSchema = z.object({
  connectedAccountId: uuid,
  providerId: uuid,
  status: z.enum(["pending", "running", "succeeded", "failed", "stale"]),
  firstSyncedAt: isoDate.nullable(),
  lastSyncedAt: isoDate.nullable(),
  staleAt: isoDate.nullable(),
  lastError: z.string().nullable(),
});

export const providerSyncResponseSchema = providerSyncStatusResponseSchema.extend({
  provider: providerSchema,
  requested: z.boolean(),
  eventId: uuid.nullable(),
});

export const memoryInitializationStatusResponseSchema = z.object({
  id: uuid,
  userId: uuid,
  householdId: uuid.nullable(),
  memberId: uuid.nullable(),
  providerAccountId: uuid.nullable(),
  status: z.enum(["pending", "processing", "completed", "failed", "waiting_for_provider"]),
  requestedAt: isoDate,
  startedAt: isoDate.nullable(),
  completedAt: isoDate.nullable(),
  lastError: z.string().nullable(),
});

export const outboxEventPayloadSchema = z.union([
  z.object({ proposalId: uuid }).strict(),
  z.object({ proposalId: uuid, approvedByMemberId: uuid }).strict(),
  z.object({ feedbackId: uuid }).strict(),
  z.object({ memberId: uuid }).strict(),
  z.object({ providerId: uuid, connectedAccountId: uuid, providerSlug: z.string().min(1).optional() }).strict(),
  z.object({ orderId: uuid, providerSlug: z.string().min(1).optional() }).strict(),
]);

export const audioTranscriptionSchema = z.object({
  text: z.string(),
  language: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});

export const agentResponseSchema = z.object({
  message: z.string(),
  intentId: uuid.nullable(),
  planningRunId: uuid.nullable(),
  proposalId: uuid.nullable(),
});

export const audioAgentResponseSchema = z.object({
  transcription: audioTranscriptionSchema,
  agent: agentResponseSchema,
});

export const audioProcessResponseSchema = z.object({
  requestId: z.string().min(1),
  status: z.literal("processed"),
  transcript: z.string().min(1),
  intent: z.object({
    type: z.enum(["meal_planning", "shopping", "feedback", "other"]),
    summary: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }).strict().nullable(),
  response: z.object({ type: z.string().min(1), message: z.string().min(1) }).strict(),
  foodIntentId: uuid.nullable(),
  planningRunId: uuid,
  audioStored: z.boolean(),
});

export const planningRunResponseSchema = z.object({
  run: z.object({
    id: uuid,
    householdId: uuid,
    startedByMemberId: uuid,
    langgraphThreadId: z.string().nullable(),
    langgraphRunId: z.string().nullable(),
    status: z.enum(["pending", "running", "paused", "completed", "failed", "cancelled"]),
    startedAt: isoDate.nullable(),
    pausedAt: isoDate.nullable(),
    completedAt: isoDate.nullable(),
  }),
});

export const proposalWorkflowResponseSchema = z.object({
  proposal: z.object({ id: uuid, householdId: uuid, status: z.string() }).passthrough(),
  availableActions: z.array(z.enum(["edit", "approve", "decline", "comment"])),
});
