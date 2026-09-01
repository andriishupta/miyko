import { z } from 'zod'

export const memoryQuerySchema = z.object({ memberId: z.string().regex(/^user-[a-z0-9-]+$/).optional(), runId: z.string().regex(/^run-[a-z0-9-]+$/).optional() }).strict()
export const memoryWriteSchema = z.object({ text: z.string().min(1).max(500), memberId: z.string().regex(/^user-[a-z0-9-]+$/).nullable().optional(), runId: z.string().regex(/^run-[a-z0-9-]+$/).nullable().optional(), source: z.enum(['feedback', 'audio', 'order']), confirmed: z.boolean().optional() }).strict()
export const feedbackSchema = z.object({ proposalId: z.string().regex(/^proposal-[a-z0-9-]+$/).nullable().optional(), text: z.string().min(1).max(500), sufficient: z.boolean().optional(), unusedProducts: z.array(z.string().regex(/^product-[a-z0-9-]+$/)).max(50).optional() }).strict()

