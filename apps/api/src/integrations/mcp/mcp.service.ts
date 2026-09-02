import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { mcpConfig } from './mcp.config.js'
import { mockMcpClient } from './mcp.mock.js'
import type { McpClient, ProviderAuthResult, ProviderLoginInput } from './mcp.client.js'
import { z } from 'zod'

const productSchema = z.object({
  id: z.string(), name: z.string(), brand: z.string(), category: z.string(), price: z.number().nonnegative(), currency: z.literal('UAH'), unit: z.string(), available: z.boolean(), imageUrl: z.string().nullable(),
}).strict()
const basketResultSchema = z.object({ basketId: z.string(), updated: z.boolean() }).strict()
const deliverySchema = z.object({ id: z.string(), householdId: z.string(), status: z.enum(['planned', 'delivered', 'cancelled']), scheduledFor: z.string(), address: z.string(), total: z.number().nonnegative(), currency: z.literal('UAH'), products: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), price: z.number().nonnegative() }).strict()), linkedEventId: z.string().nullable() }).strict()
const basketSchema = z.object({ householdId: z.string(), items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() }).strict()) }).strict()
const productSearchInputSchema = z.object({ query: z.string().max(100), category: z.string().max(60).optional(), limit: z.number().int().min(1).max(50) }).strict()
const basketUpdateInputSchema = z.object({ householdId: z.string().min(1), proposalId: z.string().min(1), items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50) }).strict()).max(50) }).strict()
const providerLoginInputSchema = z.object({ login: z.string().min(1).max(320), password: z.string().min(1).max(200) }).strict()
const providerReauthorizeInputSchema = z.object({ refreshToken: z.string().min(1) }).strict()
const providerAuthResultSchema = z.object({ providerSubject: z.string().nullable(), accountLogin: z.string().nullable(), accessToken: z.string().min(1), refreshToken: z.string().nullable(), accessTokenExpiresAt: z.string().datetime().nullable(), refreshTokenExpiresAt: z.string().datetime().nullable(), scopes: z.array(z.string()) }).strict()

const withTimeout = async <T>(operation: string, work: () => Promise<T>) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new AppError('MCP_TIMEOUT', `${operation} timed out`, 504)), mcpConfig.requestTimeoutMs)
  })
  try {
    return await Promise.race([work(), timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

const retryOnce = async <T>(operation: string, work: () => Promise<T>) => {
  try { return await withTimeout(operation, work) } catch (error) {
    logger.warn('mcp.operation.retry', { operation, error: error instanceof Error ? error.message : 'unknown' })
    return withTimeout(operation, work)
  }
}

export class McpService {
  constructor(private readonly client: McpClient = mcpConfig.mode === 'mock' ? mockMcpClient : unavailableRealClient()) {}

  async discoverTools() { return retryOnce('tools/list', () => this.client.discoverTools()) }
  async authenticate(input: ProviderLoginInput): Promise<ProviderAuthResult> { const checkedInput = providerLoginInputSchema.parse(input); return providerAuthResultSchema.parse(await retryOnce('provider/authenticate', () => this.client.authenticate(checkedInput))) }
  async reauthorize(input: { refreshToken: string }): Promise<ProviderAuthResult> { const checkedInput = providerReauthorizeInputSchema.parse(input); return providerAuthResultSchema.parse(await retryOnce('provider/reauthorize', () => this.client.reauthorize(checkedInput))) }
  async searchProducts(input: Parameters<McpClient['searchProducts']>[0]) { const checkedInput = productSearchInputSchema.parse(input); return (await retryOnce('products/search', () => this.client.searchProducts(checkedInput))).map((product) => productSchema.parse(product)) }
  async getProduct(productId: string) { const product = await retryOnce('products/details', () => this.client.getProduct(productId)); return product ? productSchema.parse(product) : null }
  async getReplacements(productId: string) { return (await retryOnce('products/replacements', () => this.client.getReplacements(productId))).map((product) => productSchema.parse(product)) }
  async getOrderHistory(input: { householdId: string; accessToken: string }) { return (await retryOnce('orders/history', () => this.client.getOrderHistory(input))).map((delivery) => deliverySchema.parse(delivery)) }
  async getBasket(householdId: string) { return basketSchema.parse(await retryOnce('basket/read', () => this.client.getBasket(householdId))) }

  async updateBasket(input: Parameters<McpClient['updateBasket']>[0], ownerApproved: boolean) {
    if (!ownerApproved) throw new AppError('OWNER_APPROVAL_REQUIRED', 'Owner approval required', 403)
    const checkedInput = basketUpdateInputSchema.parse(input)
    logger.info('mcp.basket_update.mock', { householdId: input.householdId, proposalId: input.proposalId })
    return basketResultSchema.parse(await retryOnce('basket/update', () => this.client.updateBasket(checkedInput)))
  }
}

const unavailableRealClient = (): McpClient => ({
  async discoverTools() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async authenticate() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async reauthorize() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async searchProducts() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async getProduct() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async getReplacements() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async getOrderHistory() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async getBasket() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
  async updateBasket() { throw new AppError('MCP_REAL_DISABLED', 'Real MCP client is not enabled in the mock scaffold', 503) },
})

export const mcpService = new McpService()
