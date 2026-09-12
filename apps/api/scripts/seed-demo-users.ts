import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { createClient } from '@miyko/database/client'
import { householdMembers, households, providers, userSessions, users } from '@miyko/database/schema'
import { hashPassword } from '../src/lib/password.js'

const migrationUrl = process.env.MIGRATION_DATABASE_URL
const demoPassword = process.env.DEMO_PASSWORD ?? 'miyko-demo-password'
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required for the demo seed')

const client = createClient({ connectionString: migrationUrl, maxConnections: 1 })
const db = client.db

const demoUsers = [
  { id: randomUUID(), memberId: randomUUID(), email: 'owner@miyko.local', firstName: 'Olena', lastName: 'Owner', displayName: 'Olena', role: 'owner' as const },
  { id: randomUUID(), memberId: randomUUID(), email: 'admin@miyko.local', firstName: 'Andrii', lastName: 'Admin', displayName: 'Andrii', role: 'admin' as const },
  { id: randomUUID(), memberId: randomUUID(), email: 'user@miyko.local', firstName: 'Danylo', lastName: 'User', displayName: 'Danylo', role: 'viewer' as const },
]

const householdId = randomUUID()
const seededAt = new Date()
const archiveTimestamp = seededAt.toISOString().replace(/[-:.]/g, '')

try {
  const result = await db.transaction(async (tx) => {
    const previousUsers = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.normalizedEmail, demoUsers.map((user) => user.email)))

    if (previousUsers.length > 0) {
      const previousUserIds = previousUsers.map((user) => user.id)
      await tx
        .update(userSessions)
        .set({ revokedAt: seededAt })
        .where(and(inArray(userSessions.userId, previousUserIds), isNull(userSessions.revokedAt)))

      for (const previousUser of previousUsers) {
        const [localPart, domain] = previousUser.email.split('@')
        if (!localPart || !domain) throw new Error(`Cannot archive invalid demo email: ${previousUser.email}`)
        const archivedEmail = `${localPart}+archived-${archiveTimestamp}@${domain}`.toLowerCase()
        await tx.update(users).set({
          email: archivedEmail,
          normalizedEmail: archivedEmail,
          updatedAt: seededAt,
        }).where(eq(users.id, previousUser.id))
      }
    }

    await tx.insert(users).values(demoUsers.map((user) => ({
      id: user.id,
      email: user.email,
      normalizedEmail: user.email,
      passwordHash: hashPassword(demoPassword),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
    })))

    await tx.insert(households).values({
      id: householdId,
      name: 'MiyKo Demo Household',
      ownerId: demoUsers[0].id,
    })

    await tx.insert(householdMembers).values(demoUsers.map((user) => ({
      id: user.memberId,
      householdId,
      userId: user.id,
      role: user.role,
      status: 'active' as const,
    })))

    const [provider] = await tx.insert(providers).values({
      id: randomUUID(),
      name: 'Silpo',
      slug: 'silpo',
      status: 'active',
      capabilities: ['mcp'],
    }).onConflictDoUpdate({
      target: providers.slug,
      set: { name: 'Silpo', status: 'active', capabilities: ['mcp'], updatedAt: seededAt },
    }).returning({ id: providers.id })

    if (!provider) throw new Error('Silpo provider was not created or resolved')

    return {
      archivedUsers: previousUsers.map((user) => user.email),
      providerId: provider.id,
    }
  })

  console.log(JSON.stringify({
    message: 'Created a fresh MiyKo demo household',
    seededAt: seededAt.toISOString(),
    householdId,
    archivedUsers: result.archivedUsers,
    users: demoUsers.map(({ id, memberId, email, role }) => ({
      id,
      memberId,
      email,
      role,
      password: demoPassword,
    })),
    provider: { id: result.providerId, slug: 'silpo' },
    next: 'Sign in as owner, connect Silpo, personalize from recent receipts, then start a workflow.',
  }))
} finally {
  await client.close()
}
