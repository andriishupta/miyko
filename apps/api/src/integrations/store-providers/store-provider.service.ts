import { and, eq } from 'drizzle-orm'
import {
  connectedProviderAccounts,
  shoppingProviders,
  userProviderAccounts,
} from '@miyko/database/schema'
import type {
  AuthUser,
  Provider,
  ProviderAccountsResponse,
  ProviderAuthRequest,
  ProviderConnectionResponse,
  RequestContext,
  UserProviderAccount,
} from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { providerNotConnected, providerReauthorizationRequired, notFound } from '../../lib/errors.js'
import { providerSecretStorage } from './provider-secret.storage.js'
import { storeProviderRegistry } from './store-provider.registry.js'
import type { ProviderTokenSet, StoreProvider } from './store-provider.types.js'

const toProvider = (row: typeof shoppingProviders.$inferSelect): Provider => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  status: row.status,
  capabilities: row.capabilities,
})

const toAccount = (row: typeof userProviderAccounts.$inferSelect): UserProviderAccount => ({
  id: row.id,
  providerId: row.providerId,
  providerSubject: row.providerSubject,
  accountLogin: row.accountLogin,
  authMethod: row.authMethod,
  status: row.status,
  scopes: row.scopes,
  accessTokenExpiresAt: row.accessTokenExpiresAt?.toISOString() ?? null,
  refreshTokenExpiresAt: row.refreshTokenExpiresAt?.toISOString() ?? null,
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
})

export class StoreProviderService {
  async listProviders(): Promise<Provider[]> {
    const rows = await db.query.shoppingProviders.findMany({ where: eq(shoppingProviders.status, 'active') })
    return rows.map(toProvider)
  }

  async listAccounts(user: AuthUser): Promise<ProviderAccountsResponse> {
    const rows = await db.query.userProviderAccounts.findMany({ where: eq(userProviderAccounts.userId, user.id), with: { provider: true } })
    return { items: rows.map((row) => ({ ...toAccount(row), provider: toProvider(row.provider) })) }
  }

  async discoverTools(providerSlug: string) {
    const { provider } = await this.resolve(providerSlug)
    return provider.discoverTools()
  }

  async connect(user: AuthUser, providerSlug: string, input: ProviderAuthRequest): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug)
    const tokenSet = await provider.authenticate(input)
    const previous = tokenSet.providerSubject
      ? await this.findAccountBySubject(user.id, providerRow.id, tokenSet.providerSubject)
      : await this.findAccount(user.id, providerRow.id)
    const account = await this.saveTokenSet(user.id, providerRow.id, tokenSet, previous?.id, previous)
    return { provider: toProvider(providerRow), account: toAccount(account) }
  }

  async reauthorize(user: AuthUser, providerSlug: string, input: Partial<ProviderAuthRequest>): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug)
    const account = await this.findAccount(user.id, providerRow.id)
    if (!account) throw providerNotConnected()

    const tokenSet = input.login && input.password
      ? await provider.authenticate(input as ProviderAuthRequest)
      : await this.refresh(provider, account)
    const updated = await this.saveTokenSet(user.id, providerRow.id, tokenSet, account.id, account)
    return { provider: toProvider(providerRow), account: toAccount(updated) }
  }

  async disconnect(user: AuthUser, providerSlug: string) {
    const { providerRow } = await this.resolve(providerSlug)
    const account = await this.findAccount(user.id, providerRow.id)
    if (!account) throw providerNotConnected()
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.update(userProviderAccounts).set({ status: 'revoked', updatedAt: now }).where(and(eq(userProviderAccounts.id, account.id), eq(userProviderAccounts.userId, user.id)))
      await tx.update(connectedProviderAccounts).set({ status: 'revoked', revokedAt: now, updatedAt: now }).where(eq(connectedProviderAccounts.userProviderAccountId, account.id))
    })
    await providerSecretStorage.revoke(account.id)
    return { disconnected: true }
  }

  async bindToHousehold(userId: string, householdId: string, memberId: string) {
    const accounts = await db.query.userProviderAccounts.findMany({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.status, 'active')) })
    for (const account of accounts) {
      if (!(await providerSecretStorage.load(account.id))) continue
      const provider = await db.query.shoppingProviders.findFirst({ where: eq(shoppingProviders.id, account.providerId) })
      if (!provider) continue
      const existing = await db.query.connectedProviderAccounts.findFirst({
        where: and(
          eq(connectedProviderAccounts.householdId, householdId),
          eq(connectedProviderAccounts.providerId, account.providerId),
          eq(connectedProviderAccounts.authorizedByMemberId, memberId),
        ),
      })
      if (existing) {
        await db.update(connectedProviderAccounts).set({ userProviderAccountId: account.id, status: 'active', revokedAt: null, updatedAt: new Date() }).where(eq(connectedProviderAccounts.id, existing.id))
      } else {
        await db.insert(connectedProviderAccounts).values({ householdId, providerId: account.providerId, userProviderAccountId: account.id, authorizedByMemberId: memberId, status: 'active' })
      }
    }
  }

  async bindAccountToHousehold(context: RequestContext, providerSlug: string): Promise<ProviderConnectionResponse> {
    const { providerRow } = await this.resolve(providerSlug)
    const account = await this.findAccount(context.user.id, providerRow.id)
    if (!account || account.status !== 'active') throw providerNotConnected()
    if (!(await providerSecretStorage.load(account.id))) throw providerReauthorizationRequired()
    await this.bindToHousehold(context.user.id, context.household.id, context.membership.id)
    return { provider: toProvider(providerRow), account: toAccount(account) }
  }

  async findActiveProvider(context: RequestContext, providerSlug?: string): Promise<{ id: string; slug: string }> {
    const connections = await db.query.connectedProviderAccounts.findMany({
      where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, 'active')),
      with: { provider: true, userProviderAccount: true },
    })
    const connection = connections.find((item) => (!providerSlug || item.provider?.slug === providerSlug) && item.provider?.status === 'active' && item.userProviderAccount?.status === 'active')
    if (!connection?.provider) throw providerNotConnected()
    return { id: connection.provider.id, slug: connection.provider.slug }
  }

  private async resolve(providerSlug: string): Promise<{ providerRow: typeof shoppingProviders.$inferSelect; provider: StoreProvider }> {
    const provider = storeProviderRegistry.get(providerSlug)
    const providerRow = await db.query.shoppingProviders.findFirst({ where: and(eq(shoppingProviders.slug, providerSlug), eq(shoppingProviders.status, 'active')) })
    if (!providerRow) throw notFound('Store provider')
    return { providerRow, provider }
  }

  private async findAccount(userId: string, providerId: string) {
    return db.query.userProviderAccounts.findFirst({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.providerId, providerId)) })
  }

  private async findAccountBySubject(userId: string, providerId: string, providerSubject: string) {
    return db.query.userProviderAccounts.findFirst({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.providerId, providerId), eq(userProviderAccounts.providerSubject, providerSubject)) })
  }

  private async saveTokenSet(userId: string, providerId: string, tokenSet: ProviderTokenSet, accountId?: string, previous?: typeof userProviderAccounts.$inferSelect) {
    const accountValues = {
      providerSubject: tokenSet.providerSubject ?? previous?.providerSubject ?? null,
      accountLogin: tokenSet.accountLogin ?? previous?.accountLogin ?? null,
      authMethod: 'mcp' as const,
      status: 'active' as const,
      scopes: tokenSet.scopes,
      accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenSet.refreshTokenExpiresAt,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    }
    if (accountId) {
      const rows = await db.update(userProviderAccounts).set(accountValues).where(and(eq(userProviderAccounts.id, accountId), eq(userProviderAccounts.userId, userId))).returning()
      if (!rows[0]) throw providerNotConnected()
      await providerSecretStorage.save(rows[0].id, { accessToken: tokenSet.accessToken, refreshToken: tokenSet.refreshToken })
      return rows[0]
    }
    const rows = await db.insert(userProviderAccounts).values({ userId, providerId, ...accountValues }).returning()
    if (rows[0]) await providerSecretStorage.save(rows[0].id, { accessToken: tokenSet.accessToken, refreshToken: tokenSet.refreshToken })
    return rows[0]
  }

  private async refresh(provider: StoreProvider, account: typeof userProviderAccounts.$inferSelect) {
    const secrets = await providerSecretStorage.load(account.id)
    if (!secrets?.refreshToken) throw providerReauthorizationRequired()
    try {
      return await provider.reauthorize({ refreshToken: secrets.refreshToken })
    } catch {
      throw providerReauthorizationRequired()
    }
  }

}

export const storeProviderService = new StoreProviderService()
