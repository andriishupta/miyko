import { z } from 'zod'

export const inviteSchema = z.object({ email: z.string().email().max(200), role: z.enum(['adult_member', 'child']) }).strict()
export const invitationIdSchema = z.object({ id: z.string().regex(/^invitation-[a-z0-9-]+$/) }).strict()

