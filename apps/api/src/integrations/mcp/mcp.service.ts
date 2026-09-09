import { Client, StreamableHTTPClientTransport, type CallToolResult, type JSONObject } from '@modelcontextprotocol/client'
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

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

  async callTool(accessToken: string, toolName: string, arguments_: JSONObject = {}): Promise<CallToolResult> {
    return withTimeout(`provider/${toolName}`, async () => {
      const client = new Client({ name: 'miyko-api', version: '1.0.0' })
      const transport = new StreamableHTTPClientTransport(new URL(mcpConfig().serverUrl), {
        requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
      })
      try {
        await client.connect(transport)
        const { tools } = await client.listTools()
        const tool = tools.find((candidate) => candidate.name === toolName)
        if (!tool) throw new AppError('MCP_TOOL_UNAVAILABLE', 'Required provider tool is unavailable', 502)
        const properties = isRecord(tool.inputSchema) && isRecord(tool.inputSchema.properties) ? tool.inputSchema.properties : null
        const safeArguments = properties
          ? Object.fromEntries(Object.entries(arguments_).filter(([name]) => name in properties))
          : {}
        return await client.callTool({ name: tool.name, arguments: safeArguments })
      } finally {
        await client.close()
      }
    })
  }
}

export const mcpService = new McpService()
