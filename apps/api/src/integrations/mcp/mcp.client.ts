import type { Delivery, Product } from '../../lib/types.js'

export type ProviderAuthResult = {
  providerSubject: string | null
  accountLogin: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  scopes: string[]
}

export type ProviderLoginInput = { login: string; password: string }
export type ProductSearchInput = { query: string; category?: string; limit: number }
export type BasketUpdateInput = { householdId: string; proposalId: string; items: Array<{ productId: string; quantity: number }> }

export interface McpClient {
  discoverTools(): Promise<string[]>
  authenticate(input: ProviderLoginInput): Promise<ProviderAuthResult>
  reauthorize(input: { refreshToken: string }): Promise<ProviderAuthResult>
  searchProducts(input: ProductSearchInput): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  getReplacements(productId: string): Promise<Product[]>
  getOrderHistory(input: { householdId: string; accessToken: string }): Promise<Delivery[]>
  getBasket(householdId: string): Promise<{ householdId: string; items: Array<{ productId: string; quantity: number }> }>
  updateBasket(input: BasketUpdateInput): Promise<{ basketId: string; updated: boolean }>
}
