import { createClient } from '@miyko/database/client'
import { householdMembers, households, providers, users } from '@miyko/database/schema'
import { hashPassword } from '../src/lib/password.js'

const migrationUrl = process.env.MIGRATION_DATABASE_URL
const demoPassword = process.env.DEMO_PASSWORD
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required for the demo seed')
if (!demoPassword) throw new Error('DEMO_PASSWORD is required for the demo seed')

const client = createClient({ connectionString: migrationUrl, maxConnections: 1 })
const db = client.db

const ownerId = '10000000-0000-4000-8000-000000000001'
const adminId = '10000000-0000-4000-8000-000000000002'
const editorId = '10000000-0000-4000-8000-000000000003'
const viewerId = '10000000-0000-4000-8000-000000000004'
const householdId = '20000000-0000-4000-8000-000000000001'
const providerId = '30000000-0000-4000-8000-000000000001'

const demoUsers = [
  { id: ownerId, memberId: '21000000-0000-4000-8000-000000000001', email: 'owner@miyko.local', firstName: 'Olena', lastName: 'Owner', displayName: 'Olena', role: 'owner' as const },
  { id: adminId, memberId: '21000000-0000-4000-8000-000000000002', email: 'admin@miyko.local', firstName: 'Andrii', lastName: 'Admin', displayName: 'Andrii', role: 'admin' as const },
  { id: editorId, memberId: '21000000-0000-4000-8000-000000000003', email: 'editor@miyko.local', firstName: 'Marta', lastName: 'Editor', displayName: 'Marta', role: 'editor' as const },
  { id: viewerId, memberId: '21000000-0000-4000-8000-000000000004', email: 'viewer@miyko.local', firstName: 'Danylo', lastName: 'Viewer', displayName: 'Danylo', role: 'viewer' as const },
]

try {
  for (const user of demoUsers) {
    await db.insert(users).values({
      id: user.id,
      email: user.email,
      normalizedEmail: user.email,
      passwordHash: hashPassword(demoPassword),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
    }).onConflictDoNothing()
  }

  await db.insert(households).values({ id: householdId, name: 'MiyKo Demo Household', ownerId }).onConflictDoNothing()
  for (const user of demoUsers) {
    await db.insert(householdMembers).values({
      id: user.memberId,
      householdId,
      userId: user.id,
      role: user.role,
      status: 'active',
    }).onConflictDoNothing()
  }

  await db.insert(providers).values({
    id: providerId,
    name: 'Silpo',
    slug: 'silpo',
    status: 'active',
    capabilities: ['mcp'],
  }).onConflictDoUpdate({
    target: providers.id,
    set: { name: 'Silpo', slug: 'silpo', status: 'active', capabilities: ['mcp'], updatedAt: new Date() },
  })

  console.log('Seeded MiyKo demo household with users, roles and the Silpo provider')
} finally {
  await client.close()
}
