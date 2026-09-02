import { notFound } from '../../lib/errors.js'
import { silpoProvider } from './silpo.provider.js'
import type { StoreProvider } from './store-provider.types.js'

const providers = new Map<string, StoreProvider>([
  ['silpo', silpoProvider],
])

export const storeProviderRegistry = {
  get(slug: string) {
    const provider = providers.get(slug)
    if (!provider) throw notFound('Store provider')
    return provider
  },
}
