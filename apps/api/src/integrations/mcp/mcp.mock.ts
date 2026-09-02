import { createHash } from 'node:crypto'
import { deliveries, products } from '../../lib/mock-store.js'
import type { McpClient, BasketUpdateInput, ProductSearchInput, ProviderAuthResult, ProviderLoginInput } from './mcp.client.js'

export class MockMcpClient implements McpClient {
  async discoverTools() { return ['products/search', 'products/details', 'products/replacements', 'orders/history', 'basket/read', 'basket/update'] }

  async authenticate(input: ProviderLoginInput): Promise<ProviderAuthResult> {
    const subject = createHash('sha256').update(input.login.trim().toLowerCase()).digest('hex').slice(0, 24)
    const token = createHash('sha256').update(`${input.login}:${input.password}`).digest('hex')
    return { providerSubject: `mock:${subject}`, accountLogin: input.login.trim(), accessToken: `mock-silpo-access:${token}`, refreshToken: `mock-silpo-refresh:${subject}`, accessTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(), scopes: ['orders:read', 'products:read', 'basket:write'] }
  }

  async reauthorize(input: { refreshToken: string }): Promise<ProviderAuthResult> {
    const subject = input.refreshToken.split(':').at(-1) ?? 'unknown'
    return { providerSubject: `mock:${subject}`, accountLogin: null, accessToken: `mock-silpo-refreshed:${subject}`, refreshToken: input.refreshToken, accessTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(), scopes: ['orders:read', 'products:read', 'basket:write'] }
  }

  async searchProducts({ query, category, limit }: ProductSearchInput) {
    const normalized = query.toLowerCase()
    return products.filter((product) => (product.name.toLowerCase().includes(normalized) || product.category === category || !query) && product.available).slice(0, limit)
  }

  async getProduct(productId: string) { return products.find((product) => product.id === productId) ?? null }

  async getReplacements(productId: string) {
    const product = products.find((item) => item.id === productId)
    return product ? products.filter((item) => item.id !== productId && item.category === product.category).slice(0, 3) : []
  }

  async getOrderHistory({ householdId }: { householdId: string; accessToken: string }) { return deliveries.filter((delivery) => delivery.householdId === householdId) }

  async getBasket(householdId: string) { return { householdId, items: [] } }

  async updateBasket(_input: BasketUpdateInput) { return { basketId: 'mock-basket-1', updated: true } }
}

export const mockMcpClient = new MockMcpClient()
