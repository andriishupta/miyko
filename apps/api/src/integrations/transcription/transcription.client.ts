import { z } from 'zod'
import { AppError } from '../../lib/errors.js'

const responseSchema = z.object({ text: z.string().min(1).max(20_000) }).passthrough()

export const transcriptionClient = {
  async transcribe(input: { fileName: string; mimeType: string; audioBase64: string }) {
    const apiKey = process.env.TRANSCRIPTION_API_KEY ?? process.env.OPENAI_API_KEY
    if (!apiKey) throw new AppError('TRANSCRIPTION_API_KEY_REQUIRED', 'Audio transcription is not configured', 503)
    const bytes = Buffer.from(input.audioBase64, 'base64')
    if (bytes.length === 0 || bytes.length > Number(process.env.AUDIO_MAX_BYTES ?? 6_000_000)) throw new AppError('AUDIO_SIZE_INVALID', 'Audio file size is not supported', 422)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(bytes)], { type: input.mimeType }), input.fileName)
    form.append('model', process.env.TRANSCRIPTION_MODEL ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe')
    const response = await fetch(process.env.TRANSCRIPTION_API_URL ?? 'https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form })
    if (!response.ok) throw new AppError('TRANSCRIPTION_PROVIDER_FAILED', 'Audio transcription failed', 502)
    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) throw new AppError('TRANSCRIPTION_INVALID_RESPONSE', 'Transcription provider returned an invalid response', 502)
    return parsed.data.text
  },
}
