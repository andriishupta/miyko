import { z } from 'zod'

const proposalItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50), unit: z.string().max(32).optional() }).strict()
export const createProposalSchema = z.object({ title: z.string().min(1).max(120), intent: z.string().max(500).nullable().optional(), items: z.array(proposalItemSchema).min(1).max(50) }).strict()
export const proposalIdSchema = z.object({ proposalId: z.string().uuid() }).strict()
export const proposalItemParamsSchema = z.object({ proposalId: z.string().uuid(), itemId: z.string().uuid() }).strict()
export const orderIdSchema = z.object({ id: z.string().uuid() }).strict()
export const editItemSchema = z.object({ quantity: z.number().int().min(1).max(50) }).strict()
export const replaceItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50).optional() }).strict()
