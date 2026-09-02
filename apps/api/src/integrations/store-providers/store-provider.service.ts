import { and, desc, eq } from 'drizzle-orm'
import {
  connectedProviderAccounts,
  memoryInitializations,
  outboxEvents,
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
  ProviderSyncStatusResponse,
  RequestContext,
  UserProviderAccount,
} from '@miyko/contracts'
import { db } from '../../lib/database.js'
import { AppError, notFound, providerCapabilityUnsupported, providerNotConnected, providerReauthorizationRequired } from '../../lib/errors.js'
import { providerSecretStorage } from './provider-secret.storage.js'
import { storeProviderRegistry } from './store-provider.registry.js'
import type { ProviderTokenSet, StoreProvider } from './store-provider.types.js'
import { outboxService } from '../../features/outbox/outbox.service.js'

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

  async discoverTools(providerSlug: string) {
    const { provider } = await this.resolve(providerSlug)
    return provider.discoverTools()
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
    await db.update(userProviderAccounts).set({ status: 'revoked', accessTokenReference: null, refreshTokenReference: null, credentialReference: null, updatedAt: new Date() }).where(and(eq(userProviderAccounts.id, account.id), eq(userProviderAccounts.userId, user.id)))
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
      const shouldRequestSync = !existing || existing.status !== 'active'
      if (existing) {
        await db.transaction(async (tx) => {
          await tx.update(connectedProviderAccounts).set({ userProviderAccountId: account.id, status: 'active', revokedAt: null, updatedAt: new Date() }).where(eq(connectedProviderAccounts.id, existing.id))
          if (shouldRequestSync) {
            const latest = await tx.query.outboxEvents.findFirst({ where: and(eq(outboxEvents.aggregateType, 'connected_provider_account'), eq(outboxEvents.aggregateId, existing.id), eq(outboxEvents.eventType, 'provider.sync_requested')), orderBy: [desc(outboxEvents.version)] })
            await tx.insert(outboxEvents).values({ householdId, aggregateType: 'connected_provider_account', aggregateId: existing.id, eventType: 'provider.sync_requested', version: latest ? latest.version + 1 : 1, payload: { providerId: provider.id, connectedAccountId: existing.id, providerSlug: provider.slug } })
          }
        })
      } else {
        const rows = await db.transaction(async (tx) => {
          const rows = await tx.insert(connectedProviderAccounts).values({ householdId, providerId: account.providerId, userProviderAccountId: account.id, authorizedByMemberId: memberId, status: 'active' }).returning()
          if (rows[0]) await tx.insert(outboxEvents).values({ householdId, aggregateType: 'connected_provider_account', aggregateId: rows[0].id, eventType: 'provider.sync_requested', version: 1, payload: { providerId: provider.id, connectedAccountId: rows[0].id, providerSlug: provider.slug } })
          return rows
        })
        await this.requeueWaitingMemory(householdId, memberId)
        continue
      }
      if (shouldRequestSync && existing) {
        await this.requeueWaitingMemory(householdId, memberId)
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

  async getOrders(context: RequestContext, providerSlug: string): Promise<ProviderOrdersResponse> {
    const result = await this.withAccount(context, providerSlug, 'orders.history', (provider, token) => provider.getOrders({ householdId: context.household.id, accessToken: token.accessToken }))
    return { provider: result.provider, items: result.value }
  }

  async syncStatus(context: RequestContext, providerSlug: string): Promise<ProviderSyncStatusResponse> {
    const { providerRow } = await this.resolve(providerSlug)
    const connections = await db.query.connectedProviderAccounts.findMany({ where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.providerId, providerRow.id), eq(connectedProviderAccounts.status, 'active')), with: { userProviderAccount: true } })
    const connection = connections.find((item) => item.userProviderAccount?.userId === context.user.id)
    if (!connection) throw providerNotConnected()
    return { connectedAccountId: connection.id, providerId: connection.providerId, status: connection.syncStatus, firstSyncedAt: connection.firstSyncedAt?.toISOString() ?? null, lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null, staleAt: connection.staleAt?.toISOString() ?? null, lastError: connection.lastSyncError }
  }

  async sync(context: RequestContext, providerSlug: string) {
    return this.withAccount(context, providerSlug, 'receipts.read', (provider, token) => provider.getOrderRecords({ householdId: context.household.id, accessToken: token.accessToken }))
  }

  async updateBasket(context: RequestContext, providerSlug: string, input: { proposalId: string; items: Array<{ productId: string; quantity: number }> }) {
    const result = await this.withAccount(context, providerSlug, 'basket.update', (provider, token) => provider.updateBasket({ householdId: context.household.id, proposalId: input.proposalId, items: input.items, accessToken: token.accessToken }))
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
    const accountValues = {
      providerSubject: tokenSet.providerSubject ?? previous?.providerSubject ?? null,
      accountLogin: tokenSet.accountLogin ?? previous?.accountLogin ?? null,
      authMethod: 'mcp' as const,
      status: 'active' as const,
      accessTokenReference: null,
      refreshTokenReference: null,
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
    } catch (error) {
      if (error instanceof AppError && error.status >= 500) throw error
      throw providerReauthorizationRequired()
    }
  }

  private async liveToken(provider: StoreProvider, account: typeof userProviderAccounts.$inferSelect) {
    if (account.status !== 'active') throw providerReauthorizationRequired()
    const secrets = await providerSecretStorage.load(account.id)
    if (!secrets) throw providerReauthorizationRequired()
    if (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt <= new Date()) throw providerReauthorizationRequired()
    if (!account.accessTokenExpiresAt || account.accessTokenExpiresAt > new Date()) return { account, accessToken: secrets.accessToken }
    const tokenSet = await this.refresh(provider, account)
    const updated = await this.saveTokenSet(account.userId, account.providerId, tokenSet, account.id, account)
    const refreshedSecrets = await providerSecretStorage.load(updated.id)
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
      const refreshed = await providerSecretStorage.load(updated.id)
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

  private async requeueWaitingMemory(householdId: string, memberId: string) {
    const initialization = await db.query.memoryInitializations.findFirst({ where: and(eq(memoryInitializations.householdId, householdId), eq(memoryInitializations.memberId, memberId), eq(memoryInitializations.status, 'waiting_for_provider')) })
    if (!initialization) return
    await outboxService.enqueue({ householdId, aggregateType: 'member', aggregateId: memberId, eventType: 'user.memory_initialization_requested', payload: { memberId } })
  }
}

export const storeProviderService = new StoreProviderService()
