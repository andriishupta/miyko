export type McpMode = 'mock' | 'real'

export const mcpConfig = {
  mode: (process.env.MCP_MODE ?? 'mock') as McpMode,
  serverUrl: process.env.SILPO_MCP_URL ?? null,
  transport: process.env.SILPO_MCP_TRANSPORT ?? 'stdio',
  requestTimeoutMs: Number(process.env.MCP_TIMEOUT_MS ?? 8_000),
}

