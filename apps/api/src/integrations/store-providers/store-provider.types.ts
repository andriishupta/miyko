import type { McpOAuthSession } from '../mcp/mcp.client.js'

export type ProviderTokenSet = {
  providerSubject: string | null
  accountLogin: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scopes: string[]
}

/** Provider authorization only. LangGraph/MCP owns tools, basket and product data. */
export interface StoreProvider {
  startAuthorization(state: string): Promise<{ authorizationUrl: string; session: McpOAuthSession }>
  finishAuthorization(session: McpOAuthSession, callbackParams: URLSearchParams): Promise<ProviderTokenSet>
}
