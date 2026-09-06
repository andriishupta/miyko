import { z } from 'zod'

export const providerSlugSchema = z.object({
  providerSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
}).strict()
