import { and, desc, eq } from 'drizzle-orm'
import { foodIntents, mealPlanItems, mealPlans, orders, planningRuns, providerProducts, shoppingProposals, shoppingProposalItems, outboxEvents } from '@miyko/database/schema'
import type { FoodIntent, IntentProcessResponse, MealPlanItem, PlanningRunResponse, RequestContext } from '@miyko/contracts'
import { z } from 'zod'
import { db } from '../../lib/database.js'
import { AppError, forbidden, notFound } from '../../lib/errors.js'
import { toContractFoodIntent, toContractMealPlan, toContractPlanningRun, toContractProposal } from '../../lib/serializers.js'
import { agentLayer } from '../../integrations/agent/graphs.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'

const agentProductSchema = z.object({
  providerProductId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.literal('UAH'),
  unit: z.string().min(1),
  available: z.boolean().nullable(),
  imageUrl: z.string().url().nullable(),
}).strict()

const mealType = (title: string): MealPlanItem['type'] => {
  const value = title.toLowerCase()
  if (value.includes('breakfast')) return 'breakfast'
  if (value.includes('lunch')) return 'lunch'
  if (value.includes('dinner')) return 'dinner'
  if (value.includes('snack')) return 'snack'
  if (value.includes('dessert')) return 'dessert'
  return 'other'
}

const plannedFor = (intent: FoodIntent, index: number) => {
  const date = new Date(intent.desiredDate ?? new Date())
  date.setUTCHours(12, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + Math.floor(index / 3))
  return date
}

export class PlanningService {
  async run(context: RequestContext, intentId: string, intentContract?: FoodIntent): Promise<IntentProcessResponse> {
    const intentRow = await db.query.foodIntents.findFirst({ where: and(eq(foodIntents.id, intentId), eq(foodIntents.householdId, context.household.id)) })
    if (!intentRow) throw notFound('Food intent')
    if (intentRow.submittedByMemberId !== context.membership.id && context.membership.role !== 'owner' && context.membership.role !== 'admin') throw forbidden()
    const intent = intentContract ?? toContractFoodIntent(intentRow)
    const provider = await storeProviderService.findActiveProvider(context)
    const history = await db.query.orders.findMany({ where: eq(orders.householdId, context.household.id), with: { items: true }, orderBy: [desc(orders.purchasedAt)], limit: 100 })
    const runRows = await db.insert(planningRuns).values({ householdId: context.household.id, startedByMemberId: context.membership.id, status: 'running', context: { intentId: intent.id, source: intent.source }, startedAt: new Date() }).returning()
    const run = runRows[0]
    if (!run) throw new AppError('PLANNING_RUN_NOT_CREATED', 'Planning run could not be created', 503)

    try {
      const graph = await agentLayer.foodIntent({
        text: intent.text,
        namespace: `member:${context.membership.id}`,
        providerHistory: history,
        searchProducts: provider ? (query) => storeProviderService.searchProducts(context, provider.slug, query, 5) : null,
      })
      if (!graph.plan) throw new AppError('AGENT_PLAN_MISSING', 'Agent did not return a meal plan', 502)
      const parsedProducts = z.array(agentProductSchema).safeParse(graph.products)
      if (!parsedProducts.success) throw new AppError('AGENT_PRODUCT_RESULT_INVALID', 'Agent returned invalid product data', 502)
      const products = Array.from(new Map(parsedProducts.data.map((product) => [product.providerProductId, product])).values()).slice(0, 50)

      const result = await db.transaction(async (tx) => {
        const now = new Date()
        const localProducts = new Map<string, typeof providerProducts.$inferSelect>()
        if (provider) {
          for (const product of products) {
            const rows = await tx.insert(providerProducts).values({
              providerId: provider.id,
              providerProductId: product.providerProductId,
              normalizedName: product.name,
              details: { brand: product.brand, category: product.category, price: product.price, currency: product.currency, unit: product.unit, available: product.available, imageUrl: product.imageUrl },
              lastSeenAt: now,
              updatedAt: now,
            }).onConflictDoUpdate({ target: [providerProducts.providerId, providerProducts.providerProductId], set: { normalizedName: product.name, details: { brand: product.brand, category: product.category, price: product.price, currency: product.currency, unit: product.unit, available: product.available, imageUrl: product.imageUrl }, lastSeenAt: now, updatedAt: now } }).returning()
            if (rows[0]) localProducts.set(product.providerProductId, rows[0])
          }
        }

        const planRows = await tx.insert(mealPlans).values({ householdId: context.household.id, planningRunId: run.id, createdByMemberId: context.membership.id, name: graph.plan.title, notes: graph.classification?.summary ?? null, status: 'active' }).returning()
        const plan = planRows[0]
        if (!plan) throw new AppError('MEAL_PLAN_NOT_CREATED', 'Meal plan could not be created', 503)
        const planItemRows = await tx.insert(mealPlanItems).values(graph.plan.meals.map((meal, index) => ({ householdId: context.household.id, mealPlanId: plan.id, intentId: intent.id, type: mealType(meal.name), title: meal.name, notes: meal.ingredients.join(', '), servings: 1, plannedFor: plannedFor(intent, index) }))).returning()

        let proposal: typeof shoppingProposals.$inferSelect | null = null
        let proposalItems: Array<typeof shoppingProposalItems.$inferSelect> = []
        const proposalProducts = products.map((product) => localProducts.get(product.providerProductId)).filter((product): product is typeof providerProducts.$inferSelect => Boolean(product))
        if (provider && proposalProducts.length > 0) {
          const proposalRows = await tx.insert(shoppingProposals).values({ householdId: context.household.id, planningRunId: run.id, mealPlanId: plan.id, createdByMemberId: context.membership.id, status: 'awaiting_owner_approval' }).returning()
          proposal = proposalRows[0] ?? null
          if (!proposal) throw new AppError('PROPOSAL_NOT_CREATED', 'Shopping proposal could not be created', 503)
          proposalItems = await tx.insert(shoppingProposalItems).values(proposalProducts.map((product) => {
            const details = product.details && typeof product.details === 'object' ? product.details as Record<string, unknown> : {}
            const price = typeof details.price === 'number' ? details.price : null
            const unit = typeof details.unit === 'string' ? details.unit : 'item'
            return { householdId: context.household.id, proposalId: proposal!.id, productId: product.id, productNameSnapshot: product.normalizedName, quantity: '1', unit, estimatedUnitPrice: price === null ? null : String(price), estimatedTotalPrice: price === null ? null : String(price), currency: 'UAH' as const, status: 'proposed' as const }
          })).returning()
          await tx.insert(outboxEvents).values({ householdId: context.household.id, aggregateType: 'shopping_proposal', aggregateId: proposal.id, eventType: 'proposal.created', version: proposal.revision, payload: { proposalId: proposal.id } })
        }

        const updatedIntentRows = await tx.update(foodIntents).set({ normalizedStatus: 'planned', updatedAt: now }).where(eq(foodIntents.id, intent.id)).returning()
        const updatedRunRows = await tx.update(planningRuns).set({ status: 'completed', langgraphThreadId: graph.threadId, langgraphRunId: graph.runId, completedAt: now, updatedAt: now }).where(eq(planningRuns.id, run.id)).returning()
        if (!updatedIntentRows[0] || !updatedRunRows[0]) throw new AppError('PLANNING_RESULT_NOT_SAVED', 'Planning result could not be saved', 503)
        return { intent: updatedIntentRows[0], run: updatedRunRows[0], plan, planItemRows, proposal, proposalItems }
      })

      const mealPlan = toContractMealPlan({ ...result.plan, items: result.planItemRows })
      const proposal = result.proposal ? toContractProposal({ ...result.proposal, items: result.proposalItems }) : null
      return {
        intent: toContractFoodIntent(result.intent),
        planning: toContractPlanningRun(result.run),
        mealPlan,
        proposal,
        classification: graph.classification,
        response: { type: 'planning_completed', message: proposal ? 'Meal plan and shopping proposal are ready for owner review.' : provider ? 'Meal plan created without matching provider products.' : 'Meal plan created. Connect a store provider to generate a shopping proposal.' },
      }
    } catch (error) {
      await db.update(planningRuns).set({ status: 'failed', completedAt: new Date(), updatedAt: new Date() }).where(eq(planningRuns.id, run.id))
      throw error
    }
  }

  async get(context: RequestContext, planningRunId: string): Promise<PlanningRunResponse> {
    const run = await db.query.planningRuns.findFirst({ where: and(eq(planningRuns.id, planningRunId), eq(planningRuns.householdId, context.household.id)) })
    if (!run) throw notFound('Planning run')
    return { run: toContractPlanningRun(run) }
  }
}

export const planningService = new PlanningService()
