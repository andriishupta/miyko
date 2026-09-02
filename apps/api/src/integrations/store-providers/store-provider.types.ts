import type {
  BasketUpdateResponse,
  ProviderAuthRequest,
  ProviderOrder,
} from '@miyko/contracts'

export type ProviderTokenSet = {
  providerSubject: string | null
  accountLogin: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scopes: string[]
}

export type ProviderRequestContext = {
  householdId: string
  accessToken: string
}

export type BasketUpdateContext = ProviderRequestContext & {
  proposalId: string
  items: Array<{ productId: string; quantity: number }>
}

export type StoreProviderOrderRecord = {
  order: ProviderOrder
  items: Array<{ providerProductId: string; name: string; quantity: number; unit: string; unitPrice: number | null; totalPrice: number | null }>
  delivery: { externalDeliveryId: string; status: 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'; scheduledFrom: string | null; scheduledTo: string | null } | null
}

export type StoreProviderProduct = {
  providerProductId: string
  name: string
  brand: string | null
  category: string | null
  price: number | null
  currency: 'UAH'
  unit: string
  available: boolean | null
  imageUrl: string | null
}

export interface StoreProvider {
  discoverTools(): Promise<string[]>
  authenticate(input: ProviderAuthRequest): Promise<ProviderTokenSet>
  reauthorize(input: { refreshToken: string }): Promise<ProviderTokenSet>
  getOrderRecords(context: ProviderRequestContext): Promise<StoreProviderOrderRecord[]>
  searchProducts(context: ProviderRequestContext, input: { query: string; limit: number }): Promise<StoreProviderProduct[]>
  updateBasket(context: BasketUpdateContext): Promise<BasketUpdateResponse>
}
