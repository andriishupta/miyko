import { createClient } from '@miyko/database/client'
import { householdMembers, households, providers, users } from '@miyko/database/schema'
import { hashPassword } from '../src/lib/password.js'

const migrationUrl = process.env.MIGRATION_DATABASE_URL
const demoPassword = process.env.DEMO_PASSWORD ?? 'miyko-demo-password'
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required for the demo seed')

const client = createClient({ connectionString: migrationUrl, maxConnections: 1 })
const db = client.db

const ownerId = '10000000-0000-4000-8000-000000000001'
const adminId = '10000000-0000-4000-8000-000000000002'
const householdId = '20000000-0000-4000-8000-000000000001'
const providerId = '30000000-0000-4000-8000-000000000001'

const demoUsers = [
  { id: ownerId, memberId: '21000000-0000-4000-8000-000000000001', email: 'owner@miyko.local', firstName: 'Olena', lastName: 'Owner', displayName: 'Olena', role: 'owner' as const },
  { id: adminId, memberId: '21000000-0000-4000-8000-000000000002', email: 'admin@miyko.local', firstName: 'Andrii', lastName: 'Admin', displayName: 'Andrii', role: 'admin' as const },
  { id: '10000000-0000-4000-8000-000000000003', memberId: '21000000-0000-4000-8000-000000000003', email: 'user@miyko.local', firstName: 'Danylo', lastName: 'User', displayName: 'Danylo', role: 'viewer' as const },
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
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        normalizedEmail: user.email,
        passwordHash: hashPassword(demoPassword),
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        status: 'active',
        updatedAt: new Date(),
      },
    })
  }

  await db.insert(households).values({ id: householdId, name: 'MiyKo Demo Household', ownerId }).onConflictDoUpdate({ target: households.id, set: { name: 'MiyKo Demo Household', ownerId, updatedAt: new Date() } })
  for (const user of demoUsers) {
    await db.insert(householdMembers).values({
      id: user.memberId,
      householdId,
      userId: user.id,
      role: user.role,
      status: 'active',
    }).onConflictDoUpdate({
      target: householdMembers.id,
      set: { householdId, userId: user.id, role: user.role, status: 'active', removedAt: null, updatedAt: new Date() },
    })
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

  console.log(JSON.stringify({
    message: 'Seeded MiyKo demo household',
    householdId,
    users: demoUsers.map(({ email, role }) => ({ email, role, password: demoPassword })),
    provider: 'silpo',
  }))
} finally {
  await client.close()
}
