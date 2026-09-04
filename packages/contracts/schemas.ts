import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

export const providerSchema = z.object({
  id: uuid, name: z.string().min(1), slug: z.string().min(1),
  status: z.enum(["active", "inactive"]),
  capabilities: z.array(z.string().min(1)),
}).strict();

export const providerAuthRequestSchema = z.object({ login: z.string().min(1), password: z.string().min(1) }).strict();
export const userProviderAccountSchema = z.object({
  id: uuid, providerId: uuid, providerSubject: z.string().nullable(), accountLogin: z.string().nullable(),
  authMethod: z.literal("mcp"),
  status: z.enum(["active", "expired", "revoked", "reconnect_required"]), scopes: z.array(z.string()),
  accessTokenExpiresAt: isoDate.nullable(), refreshTokenExpiresAt: isoDate.nullable(), lastUsedAt: isoDate.nullable(),
}).strict();
export const providerConnectionResponseSchema = z.object({ provider: providerSchema, account: userProviderAccountSchema }).strict();
export const householdProviderConnectionSchema = z.object({
  id: uuid,
  providerId: uuid,
  accountLogin: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked", "reconnect_required"]),
  connectedByMemberId: uuid,
  provider: providerSchema,
}).strict();
export const providerAccountsResponseSchema = z.object({ items: z.array(householdProviderConnectionSchema) }).strict();

const providerActionSchema = z.object({
  type: z.literal("provider_action"),
  requestId: z.string().min(1).max(255).optional(),
  intent: z.string().trim().min(1).max(500),
}).strict();

export const workflowActionSchema = z.discriminatedUnion("type", [
  providerActionSchema,
  z.object({ type: z.literal("fulfillment_selected"), mode: z.enum(["pickup", "delivery"]) }).strict(),
  z.object({ type: z.literal("delivery_slot_selected"), scheduledFrom: isoDate, scheduledTo: isoDate }).strict().refine((value) => value.scheduledTo >= value.scheduledFrom, "Delivery slot end must not precede its start"),
  z.object({ type: z.literal("approve"), approvalId: uuid }).strict(),
  z.object({ type: z.literal("decline"), approvalId: uuid }).strict(),
]);

export const createWorkflowSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  providerSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  source: z.enum(["text", "audio"]).optional(),
}).strict();

export const workflowResponseSchema = z.object({ workflow: z.object({ id: uuid }).passthrough() }).strict();
export const memoryWriteSchema = z.object({ text: z.string().trim().min(1).max(2_000), memberId: uuid.nullable().optional(), source: z.enum(["feedback", "audio", "order", "conversation"]), confirmed: z.boolean().optional() }).strict();
export const memoryQuerySchema = z.object({ memberId: uuid.optional(), query: z.string().trim().min(1).max(500) }).strict();
export const audioProcessResponseSchema = z.object({ requestId: z.string().min(1), status: z.literal("accepted"), transcript: z.string().min(1), workflow: z.object({ id: uuid }).passthrough() }).strict();
