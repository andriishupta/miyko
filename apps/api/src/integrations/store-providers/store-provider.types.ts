import type {
  BasketUpdateResponse,
  Provider,
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

export type StoreProviderDefinition = Omit<Provider, 'id'>

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

export interface StoreProvider {
  name: string
  get(): StoreProviderDefinition
  discoverTools(): Promise<string[]>
  authenticate(input: ProviderAuthRequest): Promise<ProviderTokenSet>
  reauthorize(input: { refreshToken: string }): Promise<ProviderTokenSet>
  getOrders(context: ProviderRequestContext): Promise<ProviderOrder[]>
  getOrderRecords(context: ProviderRequestContext): Promise<StoreProviderOrderRecord[]>
  updateBasket(context: BasketUpdateContext): Promise<BasketUpdateResponse>
}
