import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { providerAuthSchema, providerReauthorizeSchema, providerSlugSchema } from './providers.schemas.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'
import { providerSyncService } from '../../integrations/store-providers/provider-sync.service.js'
import { notFound } from '../../lib/errors.js'

/** User-level provider discovery and account authorization routes. */
export const providersRoutes = new Hono()

providersRoutes.get('/', authMiddleware, async (c) => c.json({ data: await storeProviderService.listProviders() }))
providersRoutes.get('/accounts', authMiddleware, async (c) => c.json({ data: await storeProviderService.listAccounts(c.get('user')) }))
providersRoutes.get('/:providerSlug/tools', authMiddleware, async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: { providerSlug: params.providerSlug, tools: await storeProviderService.discoverTools(params.providerSlug) } })
})
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
householdProviderRoutes.post('/:providerSlug/sync', async (c) => {
  const params = parseParams(c, providerSlugSchema)
  const context = c.get('requestContext')
  const eventId = await providerSyncService.requestIfStale(context, params.providerSlug)
  const status = await storeProviderService.syncStatus(context, params.providerSlug)
  const provider = (await storeProviderService.listProviders()).find((item) => item.slug === params.providerSlug)
  if (!provider) throw notFound('Store provider')
  return c.json({ data: { provider, ...status, requested: Boolean(eventId), eventId } })
})
householdProviderRoutes.get('/:providerSlug/sync-status', async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.syncStatus(c.get('requestContext'), params.providerSlug) })
})
householdProviderRoutes.get('/:providerSlug/orders', async (c) => {
  const params = parseParams(c, providerSlugSchema)
  await providerSyncService.requestIfStale(c.get('requestContext'), params.providerSlug)
  return c.json({ data: await storeProviderService.getOrders(c.get('requestContext'), params.providerSlug) })
})
