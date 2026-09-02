import type { BasketUpdateResponse, ProviderAuthRequest, ProviderOrder } from '@miyko/contracts'
import { mcpService } from '../mcp/mcp.service.js'
import type { StoreProvider, ProviderTokenSet, ProviderRequestContext, BasketUpdateContext, StoreProviderOrderRecord, StoreProviderProduct } from './store-provider.types.js'

const definition = {
  name: 'Silpo',
  slug: 'silpo',
  kind: 'store' as const,
  status: 'active' as const,
  capabilities: ['products.search', 'products.replacements', 'receipts.read', 'orders.history', 'basket.update', 'deliveries.read'],
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
  discoverTools: () => mcpService.discoverTools(),

  async authenticate(input: ProviderAuthRequest) {
    return toTokenSet(await mcpService.authenticate(input))
  },

  async reauthorize(input: { refreshToken: string }) {
    return toTokenSet(await mcpService.reauthorize(input))
  },

  async getOrderRecords(context: ProviderRequestContext): Promise<StoreProviderOrderRecord[]> {
    const orders = await mcpService.getOrderHistory(context)
    return orders.map((order) => ({
      order: { id: order.externalOrderId, status: order.status, total: order.total, currency: order.currency, placedAt: order.placedAt },
      items: order.items,
      delivery: order.delivery,
    }))
  },

  async getOrders(context: ProviderRequestContext): Promise<ProviderOrder[]> {
    return (await this.getOrderRecords(context)).map((record) => record.order)
  },

  async searchProducts(context: ProviderRequestContext, input: { query: string; limit: number }): Promise<StoreProviderProduct[]> {
    const products = await mcpService.searchProducts({ query: input.query, limit: input.limit, accessToken: context.accessToken })
    return products.map((product) => ({
      providerProductId: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      currency: product.currency,
      unit: product.unit,
      available: product.available,
      imageUrl: product.imageUrl,
    }))
  },

  async updateBasket(context: BasketUpdateContext): Promise<BasketUpdateResponse> {
    return mcpService.updateBasket({ householdId: context.householdId, proposalId: context.proposalId, items: context.items }, true)
  },
})
