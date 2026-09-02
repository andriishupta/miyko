import {
  deliveries,
  foodIntents,
  householdMembers,
  households,
  mealPlanItems,
  mealPlans,
  orderItems,
  orders,
  planningRuns,
  providerProducts,
  shoppingProposals,
  shoppingProposalItems,
  shoppingProviders,
  users,
} from '@miyko/database/schema'
import { createClient } from '@miyko/database/client'
import { hashPassword } from '../src/lib/password.js'

const migrationUrl = process.env.MIGRATION_DATABASE_URL
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required for the demo seed')

const client = createClient({ connectionString: migrationUrl, maxConnections: 1 })
const db = client.db
const date = (value: string) => new Date(value)

const ownerId = '10000000-0000-4000-8000-000000000001'
const adminId = '10000000-0000-4000-8000-000000000002'
const editorId = '10000000-0000-4000-8000-000000000003'
const viewerId = '10000000-0000-4000-8000-000000000004'
const householdId = '20000000-0000-4000-8000-000000000001'
const providerId = '30000000-0000-4000-8000-000000000001'
const deliveryProviderId = '30000000-0000-4000-8000-000000000004'
const planningRunId = '40000000-0000-4000-8000-000000000001'
const intentId = '41000000-0000-4000-8000-000000000001'
const mealPlanId = '42000000-0000-4000-8000-000000000001'
const mealPlanItemId = '43000000-0000-4000-8000-000000000001'
const proposalId = '50000000-0000-4000-8000-000000000001'
const proposalItemId = '51000000-0000-4000-8000-000000000001'
const orderId = '60000000-0000-4000-8000-000000000001'
const orderItemId = '61000000-0000-4000-8000-000000000001'
const deliveryId = '62000000-0000-4000-8000-000000000001'
const productIds = ['31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002']
const memberIds = ['21000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000004']

const demoPassword = process.env.DEMO_PASSWORD ?? 'demo'
const demoUsers = [
  { id: ownerId, email: 'owner@miyko.local', firstName: 'Olena', lastName: 'Owner', displayName: 'Olena', role: 'owner' as const },
  { id: adminId, email: 'admin@miyko.local', firstName: 'Andrii', lastName: 'Admin', displayName: 'Andrii', role: 'admin' as const },
  { id: editorId, email: 'editor@miyko.local', firstName: 'Marta', lastName: 'Editor', displayName: 'Marta', role: 'editor' as const },
  { id: viewerId, email: 'viewer@miyko.local', firstName: 'Danylo', lastName: 'Viewer', displayName: 'Danylo', role: 'viewer' as const },
]

try {
  for (const user of demoUsers) {
    await db.insert(users).values({
      id: user.id, email: user.email, normalizedEmail: user.email, passwordHash: hashPassword(demoPassword),
      firstName: user.firstName, lastName: user.lastName, displayName: user.displayName,
    }).onConflictDoNothing()
  }

  await db.insert(households).values({ id: householdId, name: 'MiyKo Demo Household', ownerId }).onConflictDoNothing()
  for (const [index, user] of demoUsers.entries()) {
    await db.insert(householdMembers).values({
      id: memberIds[index], householdId, userId: user.id, role: user.role,
      status: 'active',
    }).onConflictDoNothing()
  }

  await db.insert(shoppingProviders).values({ id: providerId, name: 'Silpo', slug: 'silpo', kind: 'store', status: 'active', capabilities: ['authenticate', 'reauthorize', 'orders', 'products', 'basket'] }).onConflictDoUpdate({ target: shoppingProviders.id, set: { name: 'Silpo', slug: 'silpo', kind: 'store', status: 'active', capabilities: ['authenticate', 'reauthorize', 'orders', 'products', 'basket'], updatedAt: new Date() } })
  await db.insert(shoppingProviders).values({ id: deliveryProviderId, name: 'Bolt', slug: 'bolt', kind: 'delivery', status: 'active', capabilities: ['deliveries.create', 'deliveries.track'] }).onConflictDoNothing()
  await db.insert(providerProducts).values([
    { id: productIds[0], providerId, providerProductId: 'demo-milk-1l', normalizedName: 'Молоко 2.5% 1 л', details: { price: 45.9, unit: 'bottle', category: 'dairy', available: true, currency: 'UAH' } },
    { id: productIds[1], providerId, providerProductId: 'demo-pasta-500g', normalizedName: 'Паста 500 г', details: { price: 32.5, unit: 'pack', category: 'pantry', available: true, currency: 'UAH' } },
  ]).onConflictDoNothing()

  await db.insert(foodIntents).values({
    id: intentId, householdId, submittedByMemberId: memberIds[2], text: 'Потрібні сніданки та паста на тиждень',
    normalizedStatus: 'planned', source: 'text', desiredDate: date('2026-09-03T00:00:00Z'), desiredDateEnd: date('2026-09-09T00:00:00Z'),
  }).onConflictDoNothing()
  await db.insert(planningRuns).values({
    id: planningRunId, householdId, startedByMemberId: memberIds[2], status: 'completed', langgraphThreadId: 'demo-thread-1', langgraphRunId: 'demo-run-1', startedAt: date('2026-09-01T09:00:00Z'), completedAt: date('2026-09-01T09:01:00Z'),
  }).onConflictDoNothing()
  await db.insert(mealPlans).values({
    id: mealPlanId, householdId, planningRunId, createdByMemberId: memberIds[2], name: 'Demo week plan', notes: 'Seed data for the first food loop', status: 'active',
  }).onConflictDoNothing()
  await db.insert(mealPlanItems).values({
    id: mealPlanItemId, householdId, mealPlanId, intentId, type: 'dinner', title: 'Паста з молочним соусом', servings: 4, plannedFor: date('2026-09-04T18:00:00Z'),
  }).onConflictDoNothing()

  await db.insert(shoppingProposals).values({
    id: proposalId, householdId, planningRunId, mealPlanId, createdByMemberId: memberIds[2], revision: 1, status: 'awaiting_owner_approval',
  }).onConflictDoNothing()
  await db.insert(shoppingProposalItems).values({
    id: proposalItemId, householdId, proposalId, productId: productIds[0], productNameSnapshot: 'Молоко 2.5% 1 л', quantity: '2', unit: 'bottle', estimatedUnitPrice: '45.90', estimatedTotalPrice: '91.80', currency: 'UAH', status: 'proposed',
  }).onConflictDoNothing()

  await db.insert(orders).values({
    id: orderId, householdId, providerId, proposalId, status: 'pending', totalAmount: '91.80', currency: 'UAH', syncStatus: 'pending',
  }).onConflictDoNothing()
  await db.insert(orderItems).values({
    id: orderItemId, householdId, orderId, productId: productIds[0], providerProductIdSnapshot: 'demo-milk-1l', productNameSnapshot: 'Молоко 2.5% 1 л', quantity: '2', unit: 'bottle', unitPriceSnapshot: '45.90', totalPriceSnapshot: '91.80', currency: 'UAH', status: 'pending',
  }).onConflictDoNothing()
  await db.insert(deliveries).values({
    id: deliveryId, householdId, orderId, mealPlanItemId, deliveryProviderId, providerDeliveryId: 'demo-delivery-1', scheduledFrom: date('2026-09-04T17:00:00Z'), scheduledTo: date('2026-09-04T19:00:00Z'), addressReference: 'demo household address', status: 'scheduled',
  }).onConflictDoNothing()

  console.log('Seeded MiyKo demo household with owner, admin, editor and viewer memberships')
} finally {
  await client.close()
}
