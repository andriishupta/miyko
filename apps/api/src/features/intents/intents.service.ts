import { foodIntents } from '@miyko/database/schema'
import type { CreateFoodIntentRequest, IntentProcessResponse, RequestContext } from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError } from '../../lib/errors.js'
import { toContractFoodIntent } from '../../lib/serializers.js'
import { planningService } from '../planning/planning.service.js'

export class IntentsService {
  async create(context: RequestContext, input: CreateFoodIntentRequest): Promise<IntentProcessResponse> {
    const rows = await db.insert(foodIntents).values({
      householdId: context.household.id,
      submittedByMemberId: context.membership.id,
      text: input.text,
      desiredDate: input.desiredDate ? new Date(input.desiredDate) : null,
      desiredDateEnd: input.desiredDateEnd ? new Date(input.desiredDateEnd) : null,
      source: input.source ?? 'text',
      normalizedStatus: 'active',
    }).returning()
    const intent = rows[0]
    if (!intent) throw new AppError('INTENT_NOT_CREATED', 'Food intent could not be created', 503)
    return planningService.run(context, intent.id, toContractFoodIntent(intent))
  }
}

export const intentsService = new IntentsService()

