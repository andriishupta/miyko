import { z } from 'zod'

export const createIntentSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  desiredDate: z.string().datetime({ offset: true }).nullable().optional(),
  desiredDateEnd: z.string().datetime({ offset: true }).nullable().optional(),
  source: z.enum(['text', 'audio']).optional(),
}).strict()

