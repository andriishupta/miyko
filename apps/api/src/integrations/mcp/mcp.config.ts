export const mcpConfig = {
  serverUrl: process.env.SILPO_MCP_URL,
  command: process.env.SILPO_MCP_COMMAND,
  args: process.env.SILPO_MCP_ARGS?.split(/\s+/).filter(Boolean) ?? [],
  envKeys: process.env.SILPO_MCP_ENV_KEYS?.split(',').map((item) => item.trim()).filter(Boolean) ?? [],
  toolNames: {
    authenticate: process.env.SILPO_MCP_AUTHENTICATE_TOOL,
    reauthorize: process.env.SILPO_MCP_REAUTHORIZE_TOOL,
    searchProducts: process.env.SILPO_MCP_SEARCH_PRODUCTS_TOOL,
    getOrderHistory: process.env.SILPO_MCP_ORDER_HISTORY_TOOL,
    updateBasket: process.env.SILPO_MCP_UPDATE_BASKET_TOOL,
  },
  requestTimeoutMs: Number(process.env.MCP_TIMEOUT_MS ?? 8_000),
}
