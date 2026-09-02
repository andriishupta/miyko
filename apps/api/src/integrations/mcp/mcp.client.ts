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
export type ProductSearchInput = { query: string; category?: string; limit: number; accessToken: string }
export type BasketUpdateInput = { householdId: string; proposalId: string; items: Array<{ productId: string; quantity: number }>; accessToken: string }

export type McpOrderRecord = {
  externalOrderId: string
  status: string
  total: number
  currency: 'UAH'
  placedAt: string | null
  items: Array<{ providerProductId: string; name: string; quantity: number; unit: string; unitPrice: number | null; totalPrice: number | null }>
  delivery: { externalDeliveryId: string; status: 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'; scheduledFrom: string | null; scheduledTo: string | null } | null
}

export interface McpClient {
  discoverTools(): Promise<string[]>
  authenticate(input: ProviderLoginInput): Promise<unknown>
  reauthorize(input: { refreshToken: string }): Promise<unknown>
  searchProducts(input: ProductSearchInput): Promise<unknown>
  getProduct(input: { productId: string; accessToken: string }): Promise<unknown>
  getReplacements(input: { productId: string; accessToken: string }): Promise<unknown>
  getOrderHistory(input: { householdId: string; accessToken: string }): Promise<unknown>
  getBasket(input: { householdId: string; accessToken: string }): Promise<unknown>
  updateBasket(input: BasketUpdateInput): Promise<unknown>
}
