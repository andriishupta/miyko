import { eq } from 'drizzle-orm'
import { providerSecrets } from '@miyko/database/schema'
import { db } from '../../lib/database.js'
import { providerSecretCrypto } from './provider-secrets.js'

export const providerSecretStorage = {
  async save(accountId: string, value: { accessToken: string; refreshToken: string | null }) {
    const encrypted = providerSecretCrypto.put(value)
    await db.transaction(async (tx) => {
      await tx.delete(providerSecrets).where(eq(providerSecrets.userProviderAccountId, accountId))
      await tx.insert(providerSecrets).values([
        { userProviderAccountId: accountId, kind: 'access_token', encryptedValue: Buffer.from(encrypted.accessTokenReference), keyVersion: 'v1' },
        ...(encrypted.refreshTokenReference ? [{ userProviderAccountId: accountId, kind: 'refresh_token' as const, encryptedValue: Buffer.from(encrypted.refreshTokenReference), keyVersion: 'v1' }] : []),
      ])
    })
  },

  async load(accountId: string) {
    const rows = await db.query.providerSecrets.findMany({ where: eq(providerSecrets.userProviderAccountId, accountId) })
    const access = rows.find((row) => row.kind === 'access_token')
    if (!access) return null
    const refresh = rows.find((row) => row.kind === 'refresh_token')
    return providerSecretCrypto.get(access.encryptedValue.toString(), refresh?.encryptedValue.toString() ?? null)
  },

  async revoke(accountId: string) {
    await db.delete(providerSecrets).where(eq(providerSecrets.userProviderAccountId, accountId))
  },
}
