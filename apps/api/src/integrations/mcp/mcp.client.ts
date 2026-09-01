import type { Delivery, Product } from '../../lib/types.js'

export type ProductSearchInput = { query: string; category?: string; limit: number }
export type BasketUpdateInput = { householdId: string; proposalId: string; items: Array<{ productId: string; quantity: number }> }

export interface McpClient {
  discoverTools(): Promise<string[]>
  searchProducts(input: ProductSearchInput): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  getReplacements(productId: string): Promise<Product[]>
  getOrderHistory(householdId: string): Promise<Delivery[]>
  getBasket(householdId: string): Promise<{ householdId: string; items: Array<{ productId: string; quantity: number }> }>
  updateBasket(input: BasketUpdateInput): Promise<{ basketId: string; updated: boolean }>
}

