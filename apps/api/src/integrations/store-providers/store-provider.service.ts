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
  ProviderOrdersResponse,
  RequestContext,
  UserProviderAccount,
} from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError, notFound, providerCapabilityUnsupported, providerNotConnected, providerReauthorizationRequired } from '../../lib/errors.js'
import { providerSecretStore } from './provider-secrets.js'
import { storeProviderRegistry } from './store-provider.registry.js'
import type { ProviderTokenSet, StoreProvider } from './store-provider.types.js'

const toProvider = (row: typeof shoppingProviders.$inferSelect): Provider => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  kind: row.kind,
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
    const rows = await db.query.shoppingProviders.findMany({ where: eq(shoppingProviders.kind, 'store') })
    return rows.map(toProvider)
  }

  async listAccounts(user: AuthUser): Promise<ProviderAccountsResponse> {
    const rows = await db.query.userProviderAccounts.findMany({ where: eq(userProviderAccounts.userId, user.id), with: { provider: true } })
    return { items: rows.map((row) => ({ ...toAccount(row), provider: toProvider(row.provider) })) }
  }

  async connect(user: AuthUser, providerSlug: string, input: ProviderAuthRequest): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug, 'authenticate')
    const tokenSet = await provider.authenticate(input)
    const previous = tokenSet.providerSubject
      ? await this.findAccountBySubject(user.id, providerRow.id, tokenSet.providerSubject)
      : undefined
    const account = await this.saveTokenSet(user.id, providerRow.id, tokenSet, previous?.id, previous)
    return { provider: toProvider(providerRow), account: toAccount(account) }
  }

  async reauthorize(user: AuthUser, providerSlug: string, input: Partial<ProviderAuthRequest>): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug, 'reauthorize')
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
    await db.update(userProviderAccounts).set({ status: 'revoked', updatedAt: new Date() }).where(and(eq(userProviderAccounts.id, account.id), eq(userProviderAccounts.userId, user.id)))
    return { disconnected: true }
  }

  async bindToHousehold(userId: string, householdId: string, memberId: string) {
    const accounts = await db.query.userProviderAccounts.findMany({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.status, 'active')) })
    for (const account of accounts) {
      // A reference from a previous process is not usable by the scaffold's
      // in-memory vault until the user connects again.
      if (!providerSecretStore.get(account.accessTokenReference, account.refreshTokenReference)) continue
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
    if (!providerSecretStore.get(account.accessTokenReference, account.refreshTokenReference)) throw providerReauthorizationRequired()
    await this.bindToHousehold(context.user.id, context.household.id, context.membership.id)
    return { provider: toProvider(providerRow), account: toAccount(account) }
  }

  async getOrders(context: RequestContext, providerSlug: string): Promise<ProviderOrdersResponse> {
    const result = await this.withAccount(context, providerSlug, 'orders', (provider, token) => provider.getOrders({ householdId: context.household.id, accessToken: token.accessToken }))
    return { provider: result.provider, items: result.value }
  }

  async updateBasket(context: RequestContext, providerSlug: string, input: { proposalId: string; items: Array<{ productId: string; quantity: number }> }) {
    const result = await this.withAccount(context, providerSlug, 'basket', (provider, token) => provider.updateBasket({ householdId: context.household.id, proposalId: input.proposalId, items: input.items, accessToken: token.accessToken }))
    return { provider: result.provider, connectedAccountId: result.account.id, basket: result.value }
  }

  private async resolve(providerSlug: string, requiredCapability?: string): Promise<{ providerRow: typeof shoppingProviders.$inferSelect; provider: StoreProvider }> {
    const provider = storeProviderRegistry.get(providerSlug)
    const providerRow = await db.query.shoppingProviders.findFirst({ where: and(eq(shoppingProviders.slug, providerSlug), eq(shoppingProviders.kind, 'store'), eq(shoppingProviders.status, 'active')) })
    if (!providerRow) throw notFound('Store provider')
    if (requiredCapability && (!providerRow.capabilities.includes(requiredCapability) || !provider.get().capabilities.includes(requiredCapability))) throw providerCapabilityUnsupported()
    return { providerRow, provider }
  }

  private async findAccount(userId: string, providerId: string) {
    return db.query.userProviderAccounts.findFirst({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.providerId, providerId)) })
  }

  private async findAccountBySubject(userId: string, providerId: string, providerSubject: string) {
    return db.query.userProviderAccounts.findFirst({ where: and(eq(userProviderAccounts.userId, userId), eq(userProviderAccounts.providerId, providerId), eq(userProviderAccounts.providerSubject, providerSubject)) })
  }

  private async saveTokenSet(userId: string, providerId: string, tokenSet: ProviderTokenSet, accountId?: string, previous?: typeof userProviderAccounts.$inferSelect) {
    const references = providerSecretStore.put({ accessToken: tokenSet.accessToken, refreshToken: tokenSet.refreshToken })
    const accountValues = {
      providerSubject: tokenSet.providerSubject ?? previous?.providerSubject ?? null,
      accountLogin: tokenSet.accountLogin ?? previous?.accountLogin ?? null,
      authMethod: 'mcp' as const,
      status: 'active' as const,
      accessTokenReference: references.accessTokenReference,
      refreshTokenReference: references.refreshTokenReference,
      scopes: tokenSet.scopes,
      accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenSet.refreshTokenExpiresAt,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    }
    if (accountId) {
      const rows = await db.update(userProviderAccounts).set(accountValues).where(and(eq(userProviderAccounts.id, accountId), eq(userProviderAccounts.userId, userId))).returning()
      if (!rows[0]) throw providerNotConnected()
      return rows[0]
    }
    const rows = await db.insert(userProviderAccounts).values({ userId, providerId, ...accountValues }).returning()
    return rows[0]
  }

  private async refresh(provider: StoreProvider, account: typeof userProviderAccounts.$inferSelect) {
    const secrets = providerSecretStore.get(account.accessTokenReference, account.refreshTokenReference)
    if (!secrets?.refreshToken) throw providerReauthorizationRequired()
    try {
      return await provider.reauthorize({ refreshToken: secrets.refreshToken })
    } catch (error) {
      if (error instanceof AppError && error.status >= 500) throw error
      throw providerReauthorizationRequired()
    }
  }

  private async liveToken(provider: StoreProvider, account: typeof userProviderAccounts.$inferSelect) {
    if (account.status !== 'active') throw providerReauthorizationRequired()
    const secrets = providerSecretStore.get(account.accessTokenReference, account.refreshTokenReference)
    if (!secrets) throw providerReauthorizationRequired()
    if (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt <= new Date()) throw providerReauthorizationRequired()
    if (!account.accessTokenExpiresAt || account.accessTokenExpiresAt > new Date()) return { account, accessToken: secrets.accessToken }
    const tokenSet = await this.refresh(provider, account)
    const updated = await this.saveTokenSet(account.userId, account.providerId, tokenSet, account.id, account)
    const refreshedSecrets = providerSecretStore.get(updated.accessTokenReference, updated.refreshTokenReference)
    if (!refreshedSecrets) throw providerReauthorizationRequired()
    return { account: updated, accessToken: refreshedSecrets.accessToken }
  }

  private async withAccount<T>(context: RequestContext, providerSlug: string, requiredCapability: string, operation: (provider: StoreProvider, token: { account: typeof userProviderAccounts.$inferSelect; accessToken: string }) => Promise<T>) {
    const { providerRow, provider } = await this.resolve(providerSlug, requiredCapability)
    const account = await this.findConnectedAccount(context, providerRow.id)
    if (!account) throw providerNotConnected()
    const token = await this.liveToken(provider, account)
    try {
      const value = await operation(provider, token)
      await db.update(userProviderAccounts).set({ lastUsedAt: new Date() }).where(eq(userProviderAccounts.id, token.account.id))
      return { provider: toProvider(providerRow), account: token.account, value }
    } catch (error) {
      if (!(error instanceof AppError) || !['PROVIDER_TOKEN_EXPIRED', 'MCP_AUTH_EXPIRED'].includes(error.code)) throw error
      const tokenSet = await this.refresh(provider, token.account)
      const updated = await this.saveTokenSet(token.account.userId, token.account.providerId, tokenSet, token.account.id, token.account)
      const refreshed = providerSecretStore.get(updated.accessTokenReference, updated.refreshTokenReference)
      if (!refreshed) throw providerReauthorizationRequired()
      const value = await operation(provider, { account: updated, accessToken: refreshed.accessToken })
      await db.update(userProviderAccounts).set({ lastUsedAt: new Date() }).where(eq(userProviderAccounts.id, updated.id))
      return { provider: toProvider(providerRow), account: updated, value }
    }
  }

  private async findConnectedAccount(context: RequestContext, providerId: string) {
    const connections = await db.query.connectedProviderAccounts.findMany({
      where: and(
        eq(connectedProviderAccounts.householdId, context.household.id),
        eq(connectedProviderAccounts.providerId, providerId),
        eq(connectedProviderAccounts.status, 'active'),
      ),
      with: { userProviderAccount: true },
    })
    for (const connection of connections) {
      const account = connection.userProviderAccount
      if (account && account.userId === context.user.id && account.status === 'active') return account
    }
    return null
  }
}

export const storeProviderService = new StoreProviderService()
