import { z } from 'zod'
export const deliveryIdSchema = z.object({ id: z.string().uuid() }).strict()
