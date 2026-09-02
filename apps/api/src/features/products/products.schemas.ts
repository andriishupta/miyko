import { z } from 'zod'

export const productSearchSchema = z.object({
  query: z.string().max(100).optional().default(''),
  category: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
}).strict()

export const productIdSchema = z.object({ id: z.string().uuid() }).strict()
