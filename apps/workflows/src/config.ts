const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const workflowConfig = () => ({
  openAiApiKey: required("OPENAI_API_KEY"),
  openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
  mem0ApiKey: required("MEM0_API_KEY"),
  silpoMcpUrl: process.env.SILPO_MCP_URL?.trim() || "https://mcp.silpo.ua/mcp",
});
