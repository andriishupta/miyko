import { z } from 'zod'

export const planningIntentSchema = z.object({ intentId: z.string().uuid() }).strict()
export const planningRunIdSchema = z.object({ planningRunId: z.string().uuid() }).strict()

