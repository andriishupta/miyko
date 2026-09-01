import { AppError } from '../../lib/errors.js'
import type { RequestContext } from '../../lib/types.js'

export class AudioService {
  process(context: RequestContext, input: { fileName: string; mimeType: string; durationSeconds: number; audioBase64: string }) {
    if (input.durationSeconds > 180) throw new AppError('AUDIO_TOO_LONG', 'Audio duration is not supported', 422)
    return {
      requestId: context.requestId,
      status: 'mock_processed' as const,
      transcript: 'Хочу карбонару на два дні',
      intent: { type: 'meal_planning', text: 'Хочу карбонару на два дні', confidence: 0.91 },
      response: { type: 'planning_intent', message: 'Зберіг намір і підготував mock-пропозицію для перегляду.' },
      audioStored: false,
    }
  }
}
export const audioService = new AudioService()

