import { z } from 'zod'

export const settingsUpdateSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  preferredPlanningDays: z.number().int().min(1).max(14).optional(),
  language: z.enum(['uk', 'en']).optional(),
}).strict()

