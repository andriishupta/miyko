import type { BasketUpdateResponse, ProviderAuthRequest, ProviderOrder } from '@miyko/contracts'
import { mcpService } from '../mcp/mcp.service.js'
import type { StoreProvider, ProviderTokenSet, ProviderRequestContext, BasketUpdateContext } from './store-provider.types.js'

const definition = {
  name: 'Silpo',
  slug: 'silpo',
  kind: 'store' as const,
  status: 'active' as const,
  capabilities: ['authenticate', 'reauthorize', 'orders', 'products', 'basket'],
}

const toTokenSet = (result: Awaited<ReturnType<typeof mcpService.authenticate>>): ProviderTokenSet => ({
  providerSubject: result.providerSubject,
  accountLogin: result.accountLogin,
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  accessTokenExpiresAt: result.accessTokenExpiresAt ? new Date(result.accessTokenExpiresAt) : null,
  refreshTokenExpiresAt: result.refreshTokenExpiresAt ? new Date(result.refreshTokenExpiresAt) : null,
  scopes: result.scopes,
})

export const createSilpoProvider = (): StoreProvider => ({
  name: definition.name,
  get: () => ({ ...definition }),

  async authenticate(input: ProviderAuthRequest) {
    return toTokenSet(await mcpService.authenticate(input))
  },

  async reauthorize(input: { refreshToken: string }) {
    return toTokenSet(await mcpService.reauthorize(input))
  },

  async getOrders(context: ProviderRequestContext): Promise<ProviderOrder[]> {
    const deliveries = await mcpService.getOrderHistory(context)
    return deliveries.map((delivery) => ({ id: delivery.id, status: delivery.status, total: delivery.total, currency: delivery.currency, placedAt: delivery.scheduledFor }))
  },

  async updateBasket(context: BasketUpdateContext): Promise<BasketUpdateResponse> {
    return mcpService.updateBasket({ householdId: context.householdId, proposalId: context.proposalId, items: context.items }, true)
  },
})
