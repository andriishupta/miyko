import { Hono } from 'hono'
import { authMiddleware, householdContextMiddleware, requireRole } from '../../middleware/auth.js'
import { parseParams } from '../../middleware/validation.js'
import { providerSlugSchema } from './providers.schemas.js'
import { storeProviderService } from '../../integrations/store-providers/store-provider.service.js'
import { logger } from '../../lib/logger.js'

/** Provider discovery plus household-scoped owner authorization routes. */
export const providersRoutes = new Hono()

providersRoutes.get('/', authMiddleware, async (c) => c.json({ data: await storeProviderService.listProviders() }))
providersRoutes.get('/connections', authMiddleware, householdContextMiddleware, async (c) => c.json({ data: await storeProviderService.listConnections(c.get('requestContext')) }))
providersRoutes.get('/oauth/callback', async (c) => {
  try {
    await storeProviderService.finishAuthorization(new URL(c.req.url).searchParams)
    return c.redirect(storeProviderService.callbackRedirect('connected'))
  } catch (error) {
    logger.error('provider.oauth.failed', { requestId: c.get('requestId'), error: error instanceof Error ? error.message : 'Unknown OAuth failure' })
    return c.redirect(storeProviderService.callbackRedirect('failed'))
  }
})
providersRoutes.post('/:providerSlug/oauth/start', authMiddleware, householdContextMiddleware, requireRole('owner'), async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.startAuthorization(c.get('requestContext'), params.providerSlug) })
})
providersRoutes.delete('/:providerSlug', authMiddleware, householdContextMiddleware, requireRole('owner'), async (c) => {
  const params = parseParams(c, providerSlugSchema)
  return c.json({ data: await storeProviderService.disconnect(c.get('requestContext'), params.providerSlug) })
})
