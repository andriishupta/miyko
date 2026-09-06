import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";
import { z } from "zod";
import { workflowConfig } from "./config.js";
import { localAgentLogging, workflowLog } from "./observability.js";

const providerResultSchema = z.object({
  summary: z.string(),
  providerBasketId: z.string().nullable(),
  providerOrderId: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), quantity: z.string().nullable(), price: z.number().nullable(), imageUrl: z.string().url().nullable() })),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  checkoutUrl: z.string().url().nullable(),
});

export type ProviderResult = z.infer<typeof providerResultSchema>;

const toolNames = {
  history: ["silpo_get_my_online_orders"],
  basket: ["silpo_get_my_shopping_cart", "silpo_get_my_delivery_addresses", "silpo_find_address", "silpo_get_available_delivery_types", "silpo_list_branches", "silpo_get_time_slots", "silpo_create_shopping_cart", "silpo_get_shopping_cart_by_id", "silpo_find_products_batch", "silpo_add_or_update_cart_products"],
  replacement: ["silpo_get_my_shopping_cart", "silpo_get_shopping_cart_by_id", "silpo_get_time_slots", "silpo_get_products", "silpo_get_promotions", "silpo_get_similar_products", "silpo_get_replacements", "silpo_add_or_update_cart_products", "silpo_remove_cart_products"],
  fulfillment: ["silpo_get_my_shopping_cart", "silpo_get_shopping_cart_by_id", "silpo_get_my_delivery_addresses", "silpo_find_address", "silpo_get_available_delivery_types", "silpo_list_branches", "silpo_get_time_slots", "silpo_update_shopping_cart"],
  checkout: ["silpo_get_my_shopping_cart", "silpo_get_shopping_cart_by_id", "silpo_get_time_slots"],
} as const;

export type SilpoOperation = keyof typeof toolNames;
type OperationContext = { workflowId: string; eventId: string };

export const runSilpo = async (operation: SilpoOperation, instruction: string, accessToken: string, context: OperationContext): Promise<ProviderResult> => {
  const config = workflowConfig();
  const mcp = new MultiServerMCPClient({
    silpo: {
      transport: "http",
      url: config.silpoMcpUrl,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const allowed = new Set<string>(toolNames[operation]);
  const tools = (await mcp.getTools()).filter((tool) => allowed.has(tool.name));
  const missing = toolNames[operation].filter((name) => !tools.some((tool) => tool.name === name));
  if (missing.length) throw new Error(`Silpo MCP is missing required tools: ${missing.join(", ")}`);
  workflowLog("silpo.mcp.tools.ready", { ...context, operation, toolCount: tools.length });

  const agent = createAgent({
    model: `openai:${config.openAiModel}`,
    tools,
    middleware: [localAgentLogging({ ...context, operation, model: config.openAiModel })],
    responseFormat: providerResultSchema,
    systemPrompt: "You operate the official Silpo MCP. Follow each tool schema exactly, never invent provider data, never call a tool outside the supplied allowlist, and return a concise Ukrainian summary. A checkout link is completion; never claim an order was placed unless the MCP returned an order ID.",
  });
  const result = await agent.invoke({ messages: [{ role: "user", content: instruction }] });
  const parsed = providerResultSchema.parse(result.structuredResponse);
  workflowLog("silpo.operation.completed", {
    ...context,
    operation,
    itemCount: parsed.items.length,
    providerBasketId: parsed.providerBasketId,
    providerOrderId: parsed.providerOrderId,
    total: parsed.total,
    currency: parsed.currency,
    checkoutAvailable: Boolean(parsed.checkoutUrl),
  });
  return parsed;
};
