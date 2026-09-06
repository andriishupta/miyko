import { randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  connectedProviderAccounts,
  providerOAuthSessions,
  providers,
  userProviderAccounts,
} from '@miyko/database/schema'
import type {
  Provider,
  ProviderConnectionsResponse,
  ProviderOAuthStartResponse,
  RequestContext,
} from '@miyko/contracts'
import { db, withRlsContext } from '../../lib/database.js'
import { sha256 } from '../../lib/crypto.js'
import { forbidden, notFound, providerNotConnected } from '../../lib/errors.js'
import { mcpConfig } from '../mcp/mcp.config.js'
import { parseOAuthSession, serializeOAuthSession } from '../mcp/mcp.client.js'
import { providerSecretStorage } from './provider-secret.storage.js'
import { decryptProviderValue, encryptProviderValue } from './provider-secrets.js'
import { storeProviderRegistry } from './store-provider.registry.js'
import type { ProviderTokenSet, StoreProvider } from './store-provider.types.js'

const OAUTH_SESSION_MINUTES = 10

type OAuthSessionLookup = { session_id: string; user_id: string }

const firstRow = <T>(rows: unknown) => (rows as T[])[0]

const toProvider = (row: typeof providers.$inferSelect): Provider => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  status: row.status,
  capabilities: row.capabilities,
})

export class StoreProviderService {
  async listProviders(): Promise<Provider[]> {
    const rows = await db.query.providers.findMany({ where: eq(providers.status, 'active') })
    return rows.map(toProvider)
  }

  async listConnections(context: RequestContext): Promise<ProviderConnectionsResponse> {
    const rows = await db.query.connectedProviderAccounts.findMany({
      where: eq(connectedProviderAccounts.householdId, context.household.id),
      with: { provider: true },
    })
    return {
      items: rows.flatMap((row) => row.provider ? [{
        id: row.id,
        providerId: row.providerId,
        status: row.status,
        authorizedByMemberId: row.authorizedByMemberId,
        provider: toProvider(row.provider),
      }] : []),
    }
  }

  async startAuthorization(context: RequestContext, providerSlug: string): Promise<ProviderOAuthStartResponse> {
    const { providerRow, provider } = await this.resolve(providerSlug)
    const state = randomBytes(32).toString('base64url')
    const authorization = await provider.startAuthorization(state)
    await db.insert(providerOAuthSessions).values({
      userId: context.user.id,
      householdId: context.household.id,
      memberId: context.membership.id,
      providerId: providerRow.id,
      stateHash: sha256(state),
      encryptedSession: Buffer.from(encryptProviderValue(serializeOAuthSession(authorization.session))),
      expiresAt: new Date(Date.now() + OAUTH_SESSION_MINUTES * 60_000),
    })
    return { authorizationUrl: authorization.authorizationUrl, returnUrl: mcpConfig().appRedirectUri }
  }

  async finishAuthorization(callbackParams: URLSearchParams): Promise<void> {
    const state = callbackParams.get('state')
    if (!state) throw forbidden()
    const rows = await db.execute(sql`select * from public.miyko_provider_oauth_find_session(${sha256(state)}::varchar)`)
    const lookup = firstRow<OAuthSessionLookup>(rows)
    if (!lookup) throw forbidden()

    await withRlsContext(lookup.user_id, async () => {
      const oauthSession = await db.query.providerOAuthSessions.findFirst({
        where: and(
          eq(providerOAuthSessions.id, lookup.session_id),
          eq(providerOAuthSessions.userId, lookup.user_id),
          isNull(providerOAuthSessions.completedAt),
        ),
        with: { member: true, provider: true },
      })
      if (!oauthSession?.member || !oauthSession.provider) throw forbidden()
      if (oauthSession.member.userId !== lookup.user_id || oauthSession.member.householdId !== oauthSession.householdId || oauthSession.member.status !== 'active' || oauthSession.member.role !== 'owner') throw forbidden()

      const provider = storeProviderRegistry.get(oauthSession.provider.slug)
      const session = parseOAuthSession(decryptProviderValue(oauthSession.encryptedSession.toString()))
      const tokenSet = await provider.finishAuthorization(session, callbackParams)
      const previous = await this.findAccount(lookup.user_id, oauthSession.providerId)
      const account = await this.saveTokenSet(lookup.user_id, oauthSession.providerId, tokenSet, previous?.id, previous)
      await this.upsertHouseholdConnection(oauthSession.householdId, oauthSession.memberId, oauthSession.providerId, account.id)
      const now = new Date()
      await db.update(providerOAuthSessions).set({ completedAt: now, updatedAt: now }).where(eq(providerOAuthSessions.id, oauthSession.id))
    })
  }

  callbackRedirect(status: 'connected' | 'failed') {
    const url = new URL(mcpConfig().appRedirectUri)
    url.searchParams.set('providerOAuth', status)
    return url.toString()
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

  async findActiveProvider(context: RequestContext, providerSlug?: string): Promise<{ id: string; slug: string }> {
    const connections = await db.query.connectedProviderAccounts.findMany({
      where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, 'active')),
      with: { provider: true },
    })
    const connection = connections.find((item) => (!providerSlug || item.provider?.slug === providerSlug) && item.provider?.status === 'active')
    if (!connection?.provider) throw providerNotConnected()
    return { id: connection.provider.id, slug: connection.provider.slug }
  }

  async getAccessToken(context: RequestContext, providerSlug: string): Promise<string> {
    const { providerRow } = await this.resolve(providerSlug)
    const connection = await db.query.connectedProviderAccounts.findFirst({
      where: and(
        eq(connectedProviderAccounts.householdId, context.household.id),
        eq(connectedProviderAccounts.providerId, providerRow.id),
        eq(connectedProviderAccounts.status, 'active'),
      ),
    })
    if (!connection) throw providerNotConnected()
    const secret = await providerSecretStorage.load(connection.userProviderAccountId)
    if (!secret?.accessToken) throw providerNotConnected()
    return secret.accessToken
  }

  private async upsertHouseholdConnection(householdId: string, memberId: string, providerId: string, accountId: string) {
    const existing = await db.query.connectedProviderAccounts.findFirst({
      where: and(eq(connectedProviderAccounts.householdId, householdId), eq(connectedProviderAccounts.providerId, providerId)),
    })
    const values = {
      userProviderAccountId: accountId,
      authorizedByMemberId: memberId,
      status: 'active' as const,
      revokedAt: null,
      updatedAt: new Date(),
    }
    if (existing) {
      await db.update(connectedProviderAccounts).set(values).where(eq(connectedProviderAccounts.id, existing.id))
      return
    }
    await db.insert(connectedProviderAccounts).values({ householdId, providerId, ...values })
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

  private async saveTokenSet(userId: string, providerId: string, tokenSet: ProviderTokenSet, accountId?: string, previous?: typeof userProviderAccounts.$inferSelect) {
    const accountValues = {
      providerSubject: tokenSet.providerSubject ?? previous?.providerSubject ?? null,
      accountLogin: tokenSet.accountLogin ?? previous?.accountLogin ?? null,
      authMethod: 'oauth' as const,
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
}

export const storeProviderService = new StoreProviderService()
