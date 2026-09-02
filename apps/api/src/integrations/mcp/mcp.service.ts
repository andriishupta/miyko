import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { mcpConfig } from './mcp.config.js'
import { sdkMcpClient } from './mcp.sdk.client.js'
import type { McpClient, McpOrderRecord, McpProduct, ProductSearchInput, ProviderLoginInput } from './mcp.client.js'

const productSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), brand: z.string().nullable(), category: z.string().min(1), price: z.number().nonnegative(), currency: z.literal('UAH'), unit: z.string().min(1), available: z.boolean(), imageUrl: z.string().url().nullable(),
}).strict()

const providerAuthResultSchema = z.object({
  providerSubject: z.string().nullable(), accountLogin: z.string().nullable(), accessToken: z.string().min(1), refreshToken: z.string().nullable(), accessTokenExpiresAt: z.string().datetime().nullable(), refreshTokenExpiresAt: z.string().datetime().nullable(), scopes: z.array(z.string().min(1)),
}).strict()

const orderItemSchema = z.object({
  providerProductId: z.string().min(1), name: z.string().min(1), quantity: z.number().positive(), unit: z.string().min(1), unitPrice: z.number().nonnegative().nullable(), totalPrice: z.number().nonnegative().nullable(),
}).strict()

const orderRecordSchema = z.object({
  externalOrderId: z.string().min(1), status: z.string().min(1), total: z.number().nonnegative(), currency: z.literal('UAH'), placedAt: z.string().datetime().nullable(), items: z.array(orderItemSchema), delivery: z.object({ externalDeliveryId: z.string().min(1), status: z.enum(['pending', 'scheduled', 'in_transit', 'delivered', 'cancelled', 'failed']), scheduledFrom: z.string().datetime().nullable(), scheduledTo: z.string().datetime().nullable() }).strict().nullable(),
}).strict()

const basketSchema = z.object({ householdId: z.string().min(1), items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }).strict()) }).strict()
const basketResultSchema = z.object({ basketId: z.string().min(1), updated: z.boolean() }).strict()
const productSearchInputSchema = z.object({ query: z.string().max(100), category: z.string().max(60).optional(), limit: z.number().int().min(1).max(50), accessToken: z.string().min(1) }).strict()
const basketUpdateInputSchema = z.object({ householdId: z.string().min(1), proposalId: z.string().min(1), items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50) }).strict()).max(50), accessToken: z.string().min(1) }).strict()
const providerLoginInputSchema = z.object({ login: z.string().min(1).max(320), password: z.string().min(1).max(200) }).strict()
const providerReauthorizeInputSchema = z.object({ refreshToken: z.string().min(1) }).strict()

const parseExternal = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new AppError('MCP_INVALID_RESPONSE', 'MCP returned an invalid response', 502)
  return parsed.data
}

const collectionSchema = <T extends z.ZodTypeAny>(item: T) => z.union([
  z.array(item),
  z.object({ items: z.array(item) }).strict().transform((value) => value.items),
])

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

  async searchProducts(input: ProductSearchInput): Promise<McpProduct[]> {
    const checkedInput = parseExternal(productSearchInputSchema, input)
    return parseExternal(collectionSchema(productSchema), await readWithRetry('products/search', () => this.client.searchProducts(checkedInput)))
  }

  async getProduct(input: { productId: string; accessToken: string }) {
    const product = await readWithRetry('products/details', () => this.client.getProduct(input))
    return parseExternal(productSchema.nullable(), product)
  }

  async getReplacements(input: { productId: string; accessToken: string }) {
    return parseExternal(collectionSchema(productSchema), await readWithRetry('products/replacements', () => this.client.getReplacements(input)))
  }

  async getOrderHistory(input: { householdId: string; accessToken: string }): Promise<McpOrderRecord[]> {
    return parseExternal(collectionSchema(orderRecordSchema), await readWithRetry('orders/history', () => this.client.getOrderHistory(input)))
  }

  async getBasket(input: { householdId: string; accessToken: string }) {
    return parseExternal(basketSchema, await readWithRetry('basket/read', () => this.client.getBasket(input)))
  }

  async updateBasket(input: Parameters<McpClient['updateBasket']>[0], ownerApproved: boolean) {
    if (!ownerApproved) throw new AppError('OWNER_APPROVAL_REQUIRED', 'Owner approval required', 403)
    const checkedInput = parseExternal(basketUpdateInputSchema, input)
    return parseExternal(basketResultSchema, await withTimeout('basket/update', () => this.client.updateBasket(checkedInput)))
  }
}

export const mcpService = new McpService()
