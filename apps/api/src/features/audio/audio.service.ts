import type { RequestContext } from '@miyko/contracts'
import { AppError } from '../../lib/errors.js'
import { transcriptionClient } from '../../integrations/transcription/transcription.client.js'
import { intentsService } from '../intents/intents.service.js'

const maxDurationSeconds = 180
const maxBytes = Number(process.env.AUDIO_MAX_BYTES ?? 6_000_000)

export class AudioService {
  async process(context: RequestContext, input: { fileName: string; mimeType: string; durationSeconds: number; audioBase64: string }) {
    if (input.durationSeconds > maxDurationSeconds) throw new AppError('AUDIO_TOO_LONG', 'Audio duration is not supported', 422)
    const bytes = Buffer.from(input.audioBase64, 'base64')
    if (bytes.length === 0 || bytes.length > maxBytes) throw new AppError('AUDIO_SIZE_INVALID', 'Audio file size is not supported', 422)
    const transcript = await transcriptionClient.transcribe(input)
    const result = await intentsService.create(context, { text: transcript, source: 'audio' })
    return { requestId: context.requestId, status: 'processed' as const, transcript, intent: result.classification, response: result.response, foodIntentId: result.intent.id, planningRunId: result.planning.id, mealPlanId: result.mealPlan.id, proposalId: result.proposal?.id ?? null, audioStored: false }
  }
}
export const audioService = new AudioService()
