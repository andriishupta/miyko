import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { mcpConfig } from './mcp.config.js'
import { sdkMcpClient } from './mcp.sdk.client.js'
import type { McpClient, McpOAuthSession } from './mcp.client.js'

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
}).passthrough()

const withTimeout = async <T>(operation: string, work: () => Promise<T>) => {
  const { requestTimeoutMs } = mcpConfig()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new AppError('MCP_TIMEOUT', `${operation} timed out`, 504)), requestTimeoutMs)
  })
  try {
    return await Promise.race([work(), timeoutPromise])
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('MCP_REQUEST_FAILED', 'MCP authorization failed', 502)
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export class McpService {
  constructor(private readonly client: McpClient = sdkMcpClient) {}

  startAuthorization(state: string) {
    const config = mcpConfig()
    return withTimeout('provider/oauth/start', () => this.client.startAuthorization({ state, redirectUri: config.oauthRedirectUri }))
  }

  async finishAuthorization(session: McpOAuthSession, callbackParams: URLSearchParams) {
    const config = mcpConfig()
    const result = await withTimeout('provider/oauth/callback', () => this.client.finishAuthorization(session, callbackParams, config.oauthRedirectUri))
    const tokens = tokenSchema.parse(result.tokens)
    return {
      session: result.session,
      tokenSet: {
        providerSubject: null,
        accountLogin: null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1_000) : null,
        refreshTokenExpiresAt: null,
        scopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? [],
      },
    }
  }
}

export const mcpService = new McpService()
