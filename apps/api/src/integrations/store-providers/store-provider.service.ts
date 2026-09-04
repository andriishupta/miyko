import { and, eq } from 'drizzle-orm'
import {
  connectedProviderAccounts,
  providers,
  userProviderAccounts,
} from '@miyko/database/schema'
import type {
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

const toProvider = (row: typeof providers.$inferSelect): Provider => ({
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
    const rows = await db.query.providers.findMany({ where: eq(providers.status, 'active') })
    return rows.map(toProvider)
  }

  async listAccounts(context: RequestContext): Promise<ProviderAccountsResponse> {
    const rows = await db.query.connectedProviderAccounts.findMany({
      where: eq(connectedProviderAccounts.householdId, context.household.id),
      with: { provider: true },
    })
    return {
      items: rows.flatMap((row) => row.provider ? [{
        id: row.id,
        providerId: row.providerId,
        accountLogin: null,
        status: row.status,
        connectedByMemberId: row.authorizedByMemberId,
        provider: toProvider(row.provider),
      }] : []),
    }
  }

  async discoverTools(providerSlug: string) {
    const { provider } = await this.resolve(providerSlug)
    return provider.discoverTools()
  }

  async connect(context: RequestContext, providerSlug: string, input: ProviderAuthRequest): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug)
    const tokenSet = await provider.authenticate(input)
    const previous = tokenSet.providerSubject
      ? await this.findAccountBySubject(context.user.id, providerRow.id, tokenSet.providerSubject)
      : await this.findAccount(context.user.id, providerRow.id)
    const account = await this.saveTokenSet(context.user.id, providerRow.id, tokenSet, previous?.id, previous)
    await this.bindAccount(context, providerRow.id, account.id)
    return { provider: toProvider(providerRow), account: toAccount(account) }
  }

  async reauthorize(context: RequestContext, providerSlug: string, input: Partial<ProviderAuthRequest>): Promise<ProviderConnectionResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug)
    const account = await this.findAccount(context.user.id, providerRow.id)
    if (!account) throw providerNotConnected()

    const tokenSet = input.login && input.password
      ? await provider.authenticate(input as ProviderAuthRequest)
      : await this.refresh(provider, account)
    const updated = await this.saveTokenSet(context.user.id, providerRow.id, tokenSet, account.id, account)
    await this.bindAccount(context, providerRow.id, updated.id)
    return { provider: toProvider(providerRow), account: toAccount(updated) }
  }

  async disconnect(context: RequestContext, providerSlug: string) {
    const { providerRow } = await this.resolve(providerSlug)
    const connection = await db.query.connectedProviderAccounts.findFirst({
      where: and(
        eq(connectedProviderAccounts.householdId, context.household.id),
        eq(connectedProviderAccounts.providerId, providerRow.id),
      ),
    })
    if (!connection) throw providerNotConnected()
    const now = new Date()
    await db.update(connectedProviderAccounts)
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(and(eq(connectedProviderAccounts.id, connection.id), eq(connectedProviderAccounts.householdId, context.household.id)))
    return { disconnected: true }
  }

  private async bindAccount(context: RequestContext, providerId: string, accountId: string) {
    const existing = await db.query.connectedProviderAccounts.findFirst({
      where: and(
        eq(connectedProviderAccounts.householdId, context.household.id),
        eq(connectedProviderAccounts.providerId, providerId),
      ),
    })
    const values = {
      userProviderAccountId: accountId,
      authorizedByMemberId: context.membership.id,
      status: 'active' as const,
      revokedAt: null,
      updatedAt: new Date(),
    }
    if (existing) {
      await db.update(connectedProviderAccounts).set(values).where(eq(connectedProviderAccounts.id, existing.id))
      return
    }
    await db.insert(connectedProviderAccounts).values({
      householdId: context.household.id,
      providerId,
      ...values,
    })
  }

  async findActiveProvider(context: RequestContext, providerSlug?: string): Promise<{ id: string; slug: string }> {
    const connections = await db.query.connectedProviderAccounts.findMany({
      where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, 'active')),
      with: { provider: true },
    })
    const connection = connections.find((item) => (!providerSlug || item.provider?.slug === providerSlug) && item.provider?.status === 'active')
    if (!connection?.provider) throw providerNotConnected()
    return { id: connection.provider.id, slug: connection.provider.slug }
  }

  private async resolve(providerSlug: string): Promise<{ providerRow: typeof providers.$inferSelect; provider: StoreProvider }> {
    const provider = storeProviderRegistry.get(providerSlug)
    const providerRow = await db.query.providers.findFirst({ where: and(eq(providers.slug, providerSlug), eq(providers.status, 'active')) })
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
    if (!rows[0]) throw providerNotConnected()
    await providerSecretStorage.save(rows[0].id, { accessToken: tokenSet.accessToken, refreshToken: tokenSet.refreshToken })
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
