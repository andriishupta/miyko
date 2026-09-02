import { desc, eq, ilike } from 'drizzle-orm'
import { foodIntents, orders, planningRuns, providerProducts } from '@miyko/database/schema'
import type { RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError } from '../../lib/errors.js'
import { agentLayer } from '../../integrations/agent/graphs.js'
import { transcriptionClient } from '../../integrations/transcription/transcription.client.js'

const maxDurationSeconds = 180
const maxBytes = Number(process.env.AUDIO_MAX_BYTES ?? 6_000_000)

export class AudioService {
  async process(context: RequestContext, input: { fileName: string; mimeType: string; durationSeconds: number; audioBase64: string }) {
    if (input.durationSeconds > maxDurationSeconds) throw new AppError('AUDIO_TOO_LONG', 'Audio duration is not supported', 422)
    const bytes = Buffer.from(input.audioBase64, 'base64')
    if (bytes.length === 0 || bytes.length > maxBytes) throw new AppError('AUDIO_SIZE_INVALID', 'Audio file size is not supported', 422)
    const transcript = await transcriptionClient.transcribe(input)
    const history = await db.query.orders.findMany({ where: eq(orders.householdId, context.household.id), orderBy: [desc(orders.purchasedAt)], limit: 100, with: { items: true } })
    const runRows = await db.insert(planningRuns).values({ householdId: context.household.id, startedByMemberId: context.membership.id, status: 'running', context: { source: 'audio' }, startedAt: new Date() }).returning()
    const run = runRows[0]
    try {
      const graph = await agentLayer.foodIntent({ text: transcript, namespace: `member:${context.membership.id}`, providerHistory: history, searchProducts: async (query) => db.query.providerProducts.findMany({ where: ilike(providerProducts.normalizedName, `%${query}%`), limit: 10 }) })
      await db.update(planningRuns).set({ status: 'completed', langgraphThreadId: graph.threadId, langgraphRunId: graph.runId, completedAt: new Date(), updatedAt: new Date() }).where(eq(planningRuns.id, run.id))
      const rows = await db.insert(foodIntents).values({ householdId: context.household.id, submittedByMemberId: context.membership.id, text: transcript, source: 'audio', normalizedStatus: 'active' }).returning()
      return { requestId: context.requestId, status: 'processed' as const, transcript, intent: graph.classification, response: { type: 'planning_intent', message: graph.plan?.title ?? graph.classification?.summary ?? 'Food intent created' }, foodIntentId: rows[0]?.id ?? null, planningRunId: run.id, audioStored: false }
    } catch (error) {
      await db.update(planningRuns).set({ status: 'failed', completedAt: new Date(), updatedAt: new Date() }).where(eq(planningRuns.id, run.id))
      throw error
    }
  }
}
export const audioService = new AudioService()
