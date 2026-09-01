import { z } from 'zod'

export const dashboardQuerySchema = z.object({ date: z.string().date().optional() }).strict()

