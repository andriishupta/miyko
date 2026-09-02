import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { mcpConfig } from './mcp.config.js'
import { sdkMcpClient } from './mcp.sdk.client.js'
import type { McpClient, ProviderLoginInput } from './mcp.client.js'

const providerAuthResultSchema = z.object({
  providerSubject: z.string().nullable(), accountLogin: z.string().nullable(), accessToken: z.string().min(1), refreshToken: z.string().nullable(), accessTokenExpiresAt: z.string().datetime().nullable(), refreshTokenExpiresAt: z.string().datetime().nullable(), scopes: z.array(z.string().min(1)),
}).strict()

const providerLoginInputSchema = z.object({ login: z.string().min(1).max(320), password: z.string().min(1).max(200) }).strict()
const providerReauthorizeInputSchema = z.object({ refreshToken: z.string().min(1) }).strict()

const parseExternal = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new AppError('MCP_INVALID_RESPONSE', 'MCP returned an invalid response', 502)
  return parsed.data
}

const withTimeout = async <T>(operation: string, work: () => Promise<T>) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new AppError('MCP_TIMEOUT', `${operation} timed out`, 504)), mcpConfig.requestTimeoutMs)
  })
  try {
    return await Promise.race([work(), timeoutPromise])
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('MCP_REQUEST_FAILED', 'MCP request failed', 502)
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

const readWithRetry = async <T>(operation: string, work: () => Promise<T>) => {
  try {
    return await withTimeout(operation, work)
  } catch (firstError) {
    if (firstError instanceof AppError && ['MCP_TIMEOUT', 'MCP_REQUEST_FAILED'].includes(firstError.code)) return withTimeout(operation, work)
    throw firstError
  }
}

export class McpService {
  constructor(private readonly client: McpClient = sdkMcpClient) {}

  async discoverTools() {
    return parseExternal(z.array(z.string().min(1)), await readWithRetry('tools/list', () => this.client.discoverTools()))
  }

  async authenticate(input: ProviderLoginInput) {
    const checkedInput = parseExternal(providerLoginInputSchema, input)
    return parseExternal(providerAuthResultSchema, await withTimeout('provider/authenticate', () => this.client.authenticate(checkedInput)))
  }

  async reauthorize(input: { refreshToken: string }) {
    const checkedInput = parseExternal(providerReauthorizeInputSchema, input)
    return parseExternal(providerAuthResultSchema, await withTimeout('provider/reauthorize', () => this.client.reauthorize(checkedInput)))
  }

}

export const mcpService = new McpService()
