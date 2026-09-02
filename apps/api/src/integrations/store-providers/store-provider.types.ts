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

export interface StoreProvider {
  name: string
  get(): StoreProviderDefinition
  authenticate(input: ProviderAuthRequest): Promise<ProviderTokenSet>
  reauthorize(input: { refreshToken: string }): Promise<ProviderTokenSet>
  getOrders(context: ProviderRequestContext): Promise<ProviderOrder[]>
  updateBasket(context: BasketUpdateContext): Promise<BasketUpdateResponse>
}
