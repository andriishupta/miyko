import { z } from 'zod'
export const deliveryIdSchema = z.object({ id: z.string().regex(/^delivery-[a-z0-9-]+$/) }).strict()

