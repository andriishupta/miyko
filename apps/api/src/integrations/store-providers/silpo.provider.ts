import { mcpService } from '../mcp/mcp.service.js'
import type { StoreProvider } from './store-provider.types.js'

export const silpoProvider: StoreProvider = {
  startAuthorization(state) {
    return mcpService.startAuthorization(state)
  },
  async finishAuthorization(session, callbackParams) {
    const result = await mcpService.finishAuthorization(session, callbackParams)
    return result.tokenSet
  },
}
