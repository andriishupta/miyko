import { z } from 'zod'

const proposalItemSchema = z.object({ productId: z.string().regex(/^product-[a-z0-9-]+$/), quantity: z.number().int().min(1).max(50) }).strict()
export const createProposalSchema = z.object({ title: z.string().min(1).max(120), intent: z.string().max(500).nullable().optional(), items: z.array(proposalItemSchema).min(1).max(50) }).strict()
export const proposalIdSchema = z.object({ proposalId: z.string().regex(/^proposal-[a-z0-9-]+$/) }).strict()
export const proposalItemParamsSchema = z.object({ proposalId: z.string().regex(/^proposal-[a-z0-9-]+$/), itemId: z.string().regex(/^item-[a-z0-9-]+$/) }).strict()
export const editItemSchema = z.object({ quantity: z.number().int().min(1).max(50) }).strict()
export const replaceItemSchema = z.object({ productId: z.string().regex(/^product-[a-z0-9-]+$/), quantity: z.number().int().min(1).max(50).optional() }).strict()

