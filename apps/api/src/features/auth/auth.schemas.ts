import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
}).strict()

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({ id: z.string(), email: z.string(), name: z.string() }),
  householdId: z.string(),
})

