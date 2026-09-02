import { z } from 'zod'

export const providerSlugSchema = z.object({
  providerSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
}).strict()

export const providerAuthSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
}).strict()

export const providerReauthorizeSchema = providerAuthSchema.partial().strict()
