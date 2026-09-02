import { notFound } from '../../lib/errors.js'
import { createSilpoProvider } from './silpo.provider.js'
import type { StoreProvider } from './store-provider.types.js'

const providers = new Map<string, StoreProvider>([
  ['silpo', createSilpoProvider()],
])

export const storeProviderRegistry = {
  get(slug: string) {
    const provider = providers.get(slug)
    if (!provider) throw notFound('Store provider')
    return provider
  },
}
