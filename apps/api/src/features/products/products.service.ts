import { and, eq, ilike } from 'drizzle-orm'
import { productReplacements, providerProducts } from '@miyko/database/schema'
import type { Product, ProductReplacementsResponse, ProductResponse, ProductSearchResponse, RequestContext } from '@miyko/contracts'
import { z } from 'zod'
import { db } from '../../lib/database.js'
import { notFound } from '../../lib/errors.js'

const productDetailsSchema = z.object({
  brand: z.string().nullable().optional(), category: z.string().nullable().optional(), price: z.number().nonnegative().nullable().optional(), unit: z.string().optional(), available: z.boolean().nullable().optional(), imageUrl: z.string().url().nullable().optional(), currency: z.literal('UAH').optional(),
}).passthrough()

const toProduct = (row: typeof providerProducts.$inferSelect & { provider?: { id: string } | null }): Product => {
  const details = productDetailsSchema.safeParse(row.details ?? {})
  const data = details.success ? details.data : {}
  return { id: row.id, providerId: row.providerId, providerProductId: row.providerProductId, name: row.normalizedName, brand: data.brand ?? null, category: data.category ?? null, price: data.price ?? null, currency: data.currency ?? 'UAH', unit: data.unit ?? 'item', available: data.available ?? true, imageUrl: data.imageUrl ?? null }
}

export class ProductsService {
  async search(_context: RequestContext, query: string, category: string | undefined, limit: number): Promise<ProductSearchResponse> {
    const rows = await db.query.providerProducts.findMany({
      where: query ? ilike(providerProducts.normalizedName, `%${query}%`) : undefined,
      with: { provider: true },
      limit: Math.min(limit * 3, 150),
    })
    const items = rows.map(toProduct).filter((product) => !category || product.category === category).slice(0, limit)
    return { items, source: 'database-catalog' as const }
  }

  async details(_context: RequestContext, productId: string): Promise<ProductResponse> {
    const row = await db.query.providerProducts.findFirst({ where: eq(providerProducts.id, productId), with: { provider: true } })
    if (!row) throw notFound('Product')
    return { product: toProduct(row), source: 'database-catalog' as const }
  }

  async replacements(_context: RequestContext, productId: string): Promise<ProductReplacementsResponse> {
    const source = await db.query.providerProducts.findFirst({ where: eq(providerProducts.id, productId) })
    if (!source) throw notFound('Product')
    const rows = await db.query.productReplacements.findMany({ where: eq(productReplacements.productId, productId), with: { replacementProduct: { with: { provider: true } } } })
    return { productId, items: rows.map((row) => toProduct(row.replacementProduct)), source: 'database-catalog' as const }
  }
}

export const productsService = new ProductsService()
