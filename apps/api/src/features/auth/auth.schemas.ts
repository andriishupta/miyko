import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
}).strict()

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().max(200).nullable().optional(),
}).strict()
