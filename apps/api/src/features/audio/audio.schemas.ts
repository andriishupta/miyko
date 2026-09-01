import { z } from 'zod'

export const audioProcessSchema = z.object({
  fileName: z.string().min(1).max(120),
  mimeType: z.enum(['audio/m4a', 'audio/mpeg', 'audio/wav', 'audio/webm']),
  durationSeconds: z.number().positive().max(180),
  audioBase64: z.string().min(1).max(8_000_000),
}).strict()

