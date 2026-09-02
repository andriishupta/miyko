import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { providerAuthSchema, providerReauthorizeSchema, providerSlugSchema } from './providers.schemas.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'

/** User-level provider discovery and account authorization routes. */
export const providersRoutes = new Hono()

providersRoutes.get('/', authMiddleware, async (c) => c.json({ data: await storeProviderService.listProviders() }))
providersRoutes.get('/accounts', authMiddleware, async (c) => c.json({ data: await storeProviderService.listAccounts(c.get('user')) }))
providersRoutes.post('/:providerSlug/connect', authMiddleware, async (c) => {
  const params = parseParams(c, providerSlugSchema)
  const input = await parseJson(c, providerAuthSchema)
  return c.json({ data: await storeProviderService.connect(c.get('user'), params.providerSlug, input) }, 201)
})
providersRoutes.post('/:providerSlug/reauthorize', authMiddleware, async (c) => {
  const params = parseParams(c, providerSlugSchema)
  const input = await parseJson(c, providerReauthorizeSchema)
  return c.json({ data: await storeProviderService.reauthorize(c.get('user'), params.providerSlug, input) })
})
providersRoutes.delete('/:providerSlug', authMiddleware, async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.disconnect(c.get('user'), params.providerSlug) })
})

/** Household-scoped operations use the active binding, not just a user account. */
export const householdProviderRoutes = new Hono()
householdProviderRoutes.post('/:providerSlug/bind', async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.bindAccountToHousehold(c.get('requestContext'), params.providerSlug) })
})
householdProviderRoutes.get('/:providerSlug/orders', async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.getOrders(c.get('requestContext'), params.providerSlug) })
})
