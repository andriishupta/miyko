import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { workflowConfig } from "./config.js";
import { localAgentLogging, workflowLog } from "./observability.js";

type ProviderItem = {
  name: string;
  quantity: string | null;
  price: number | null;
  imageUrl: string | null;
};

export type ProviderResult = {
  summary: string;
  providerBasketId: string | null;
  providerOrderId: string | null;
  items: ProviderItem[];
  total: number | null;
  currency: string | null;
  checkoutUrl: string | null;
};

type RecordValue = Record<string, unknown>;
type AgentMessage = { getType?: () => string; type?: string; name?: string; content?: unknown };

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);

const asMessage = (value: unknown): AgentMessage | null => isRecord(value) ? value as AgentMessage : null;

const contentText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((block) => isRecord(block) && typeof block.text === "string" ? [block.text] : [])
    .join("\n");
};

const parseContent = (content: unknown): unknown => {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
};

const findValue = (value: unknown, keys: readonly string[], depth = 0): unknown => {
  if (depth > 4) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    if (key in value) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findValue(child, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
};

const stringValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};

const numberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const normalizeItems = (value: unknown): ProviderItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    name: stringValue(item.name ?? item.productName ?? item.title ?? findValue(item.product, ["name", "title"])) ?? "Unknown product",
    quantity: stringValue(item.quantity ?? item.count ?? item.amount),
    price: numberValue(item.price ?? item.unitPrice ?? item.sellingPrice ?? item.totalPrice),
    imageUrl: stringValue(item.imageUrl ?? item.image_url ?? item.pictureUrl ?? item.image),
  }));
};

const basketReadbackTools = new Set(["silpo_get_my_shopping_cart", "silpo_get_shopping_cart_by_id"]);

const projectProviderResult = (operation: SilpoOperation, messages: readonly unknown[]): ProviderResult => {
  const typedMessages = messages.map(asMessage).filter((message): message is AgentMessage => message !== null);
  const toolMessages = typedMessages.filter((message) => message.getType?.() === "tool" || message.type === "tool");
  const lastToolMessage = operation === "history"
    ? toolMessages.at(-1)
    : [...toolMessages].reverse().find((message) => message.name && basketReadbackTools.has(message.name)) ?? toolMessages.at(-1);
  if (!lastToolMessage) throw new Error(`Silpo MCP returned no tool result for ${operation}`);

  const payload = parseContent(lastToolMessage.content);
  const summary = typedMessages
    .toReversed()
    .filter((message) => message.getType?.() === "ai" || message.type === "ai")
    .map((message) => contentText(message.content).trim())
    .find(Boolean)
    ?? stringValue(findValue(payload, ["summary", "message", "description"]))
    ?? `Silpo ${operation} completed.`;
  const items = normalizeItems(findValue(payload, ["items", "products", "cartItems", "orderItems", "lines"]));

  return {
    summary,
    providerBasketId: stringValue(findValue(payload, ["providerBasketId", "basketId", "shoppingCartId", "cartId"])),
    providerOrderId: stringValue(findValue(payload, ["providerOrderId", "orderId"])),
    items,
    total: numberValue(findValue(payload, ["total", "totalPrice", "grandTotal", "amount"])),
    currency: stringValue(findValue(payload, ["currency", "currencyCode"])),
    checkoutUrl: stringValue(findValue(payload, ["checkoutUrl", "checkoutLink", "checkout_url"])),
  };
};

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

  const model = new ChatOpenAI({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    useResponsesApi: true,
  });
  const readbackInstruction = operation === "history"
    ? "For history, finish after reading the requested orders."
    : "After any provider mutation, read the current shopping cart before finishing so the final provider result reflects the current basket.";
  const agent = createAgent({
    model,
    tools,
    middleware: [localAgentLogging({ ...context, operation, model: config.openAiModel })],
    systemPrompt: `You operate the official Silpo MCP. Follow each tool schema exactly, never invent provider data, never call a tool outside the supplied allowlist, and finish the requested provider operation. ${readbackInstruction} A checkout link is completion; never claim an order was placed unless the MCP returned an order ID.`,
  });
  const result = await agent.invoke({ messages: [{ role: "user", content: instruction }] });
  const parsed = projectProviderResult(operation, result.messages);
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
