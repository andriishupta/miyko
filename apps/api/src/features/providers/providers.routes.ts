import { Hono } from 'hono'
import { authMiddleware, householdContextMiddleware, requireRole } from '../../middleware/auth.js'
import { parseJson, parseParams } from '../../middleware/validation.js'
import { providerAuthSchema, providerReauthorizeSchema, providerSlugSchema } from './providers.schemas.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'

/** Provider discovery plus household-scoped owner authorization routes. */
export const providersRoutes = new Hono()

providersRoutes.get('/', authMiddleware, async (c) => c.json({ data: await storeProviderService.listProviders() }))
providersRoutes.get('/accounts', authMiddleware, householdContextMiddleware, async (c) => c.json({ data: await storeProviderService.listAccounts(c.get('requestContext')) }))
providersRoutes.get('/:providerSlug/tools', authMiddleware, async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: { providerSlug: params.providerSlug, tools: await storeProviderService.discoverTools(params.providerSlug) } })
})
providersRoutes.post('/:providerSlug/connect', authMiddleware, householdContextMiddleware, requireRole('owner'), async (c) => {
  const params = parseParams(c, providerSlugSchema)
  const input = await parseJson(c, providerAuthSchema)
  return c.json({ data: await storeProviderService.connect(c.get('requestContext'), params.providerSlug, input) }, 201)
})
providersRoutes.post('/:providerSlug/reauthorize', authMiddleware, householdContextMiddleware, requireRole('owner'), async (c) => {
  const params = parseParams(c, providerSlugSchema)
  const input = await parseJson(c, providerReauthorizeSchema)
  return c.json({ data: await storeProviderService.reauthorize(c.get('requestContext'), params.providerSlug, input) })
})
providersRoutes.delete('/:providerSlug', authMiddleware, householdContextMiddleware, requireRole('owner'), async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.disconnect(c.get('requestContext'), params.providerSlug) })
})
