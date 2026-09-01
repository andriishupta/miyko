import { notFound } from '../../lib/errors.js'
import { mcpService } from '../../integrations/mcp/mcp.service.js'
import type { RequestContext } from '../../lib/types.js'

export class ProductsService {
  async search(_context: RequestContext, query: string, category: string | undefined, limit: number) {
    return { items: await mcpService.searchProducts({ query, category, limit }), source: 'mock-mcp' as const }
  }

  async details(_context: RequestContext, productId: string) {
    const product = await mcpService.getProduct(productId)
    if (!product) throw notFound('Product')
    return { product, source: 'mock-mcp' as const }
  }

  async replacements(_context: RequestContext, productId: string) {
    const product = await mcpService.getProduct(productId)
    if (!product) throw notFound('Product')
    return { productId, items: await mcpService.getReplacements(productId), source: 'mock-mcp' as const }
  }
}

export const productsService = new ProductsService()

