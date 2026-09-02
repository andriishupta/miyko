import { Client } from '@modelcontextprotocol/client'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { AppError } from '../../lib/errors.js'
import { mcpConfig } from './mcp.config.js'
import type { McpClient, ProviderLoginInput } from './mcp.client.js'

type JsonRecord = Record<string, unknown>

const sdkResultPayload = (result: unknown): unknown => {
  if (!result || typeof result !== 'object') throw new AppError('MCP_INVALID_RESPONSE', 'MCP returned an invalid response', 502)
  const record = result as JsonRecord
  if (record.isError === true) {
    const details = JSON.stringify(record.structuredContent ?? record.content ?? '')
    if (/unauthori[sz]|expired|invalid token/i.test(details)) throw new AppError('MCP_AUTH_EXPIRED', 'MCP authorization expired', 401)
    throw new AppError('MCP_TOOL_ERROR', 'MCP tool execution failed', 502)
  }

  const structuredContent = record.structuredContent
  if (structuredContent !== undefined) return structuredContent

  const content = record.content
  if (!Array.isArray(content)) throw new AppError('MCP_INVALID_RESPONSE', 'MCP response content is invalid', 502)
  const textBlock = content.find((item): item is JsonRecord => Boolean(item && typeof item === 'object' && (item as JsonRecord).type === 'text' && typeof (item as JsonRecord).text === 'string'))
  if (!textBlock) throw new AppError('MCP_INVALID_RESPONSE', 'MCP response has no structured content', 502)
  try {
    const parsed: unknown = JSON.parse(textBlock.text as string)
    return parsed
  } catch {
    throw new AppError('MCP_INVALID_RESPONSE', 'MCP response content is not valid JSON', 502)
  }
}

const requiredTool = (name: string | undefined): string => {
  if (!name) throw new AppError('MCP_TOOL_NOT_CONFIGURED', 'Required MCP tool is not configured', 503)
  return name
}

const environment = (): Record<string, string> => Object.fromEntries(
  mcpConfig.envKeys
    .map((key) => [key, process.env[key]] as const)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
)

export class SdkMcpClient implements McpClient {
  private async withClient<T>(accessToken: string | null, work: (client: Client) => Promise<T>): Promise<T> {
    if (!mcpConfig.serverUrl && !mcpConfig.command) throw new AppError('MCP_CONFIGURATION_REQUIRED', 'MCP server configuration is required', 503)
    if (mcpConfig.serverUrl && mcpConfig.command) throw new AppError('MCP_CONFIGURATION_INVALID', 'Configure one MCP transport', 503)

    const client = new Client({ name: 'miyko-api', version: '1.0.0' })
    const transport = mcpConfig.serverUrl
      ? new StreamableHTTPClientTransport(new URL(mcpConfig.serverUrl), {
          fetch: async (input, init) => {
            const headers = new Headers(init?.headers)
            if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
            return fetch(input, { ...init, headers })
          },
        })
      : new StdioClientTransport({ command: mcpConfig.command!, args: mcpConfig.args, env: environment() })

    let connected = false
    try {
      await client.connect(transport)
      connected = true
      return await work(client)
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
      if (status === 401 || status === 403) throw new AppError('MCP_AUTH_EXPIRED', 'MCP authorization expired', 401)
      throw error
    } finally {
      if (connected) await client.close()
    }
  }

  async discoverTools(): Promise<string[]> {
    return this.withClient(null, async (client) => {
      const result = await client.listTools()
      return result.tools.map((tool) => tool.name)
    })
  }

  private call(toolName: string | undefined, args: JsonRecord, accessToken: string | null) {
    return this.withClient(accessToken, async (client) => sdkResultPayload(await client.callTool({ name: requiredTool(toolName), arguments: args })))
  }

  authenticate(input: ProviderLoginInput) {
    return this.call(mcpConfig.toolNames.authenticate, { login: input.login, password: input.password }, null)
  }

  reauthorize(input: { refreshToken: string }) {
    return this.call(mcpConfig.toolNames.reauthorize, { refreshToken: input.refreshToken }, null)
  }

}

export const sdkMcpClient = new SdkMcpClient()
