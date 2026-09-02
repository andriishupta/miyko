import { z } from 'zod'

export const inviteSchema = z.object({ email: z.string().email().max(320), role: z.enum(['admin', 'editor', 'viewer']) }).strict()
export const createHouseholdSchema = z.object({ name: z.string().trim().min(1).max(160) }).strict()
export const invitationIdSchema = z.object({ id: z.string().uuid() }).strict()
