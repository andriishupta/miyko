import { z } from 'zod'

export const memoryQuerySchema = z.object({ memberId: z.string().uuid().optional(), runId: z.string().uuid().optional() }).strict()
export const memoryWriteSchema = z.object({ text: z.string().min(1).max(500), memberId: z.string().uuid().nullable().optional(), runId: z.string().uuid().nullable().optional(), source: z.enum(['feedback', 'audio', 'order']), confirmed: z.boolean().optional() }).strict()
export const feedbackSchema = z.object({ mealPlanItemId: z.string().uuid().nullable().optional(), orderId: z.string().uuid().nullable().optional(), kind: z.enum(['quantity', 'leftover', 'liked', 'repeat', 'general']), subject: z.string().max(200).nullable().optional(), value: z.record(z.unknown()) }).strict()
