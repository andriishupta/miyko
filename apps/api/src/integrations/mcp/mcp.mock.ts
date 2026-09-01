import { deliveries, products } from '../../lib/mock-store.js'
import type { McpClient, BasketUpdateInput, ProductSearchInput } from './mcp.client.js'

export class MockMcpClient implements McpClient {
  async discoverTools() { return ['products/search', 'products/details', 'products/replacements', 'orders/history', 'basket/read', 'basket/update'] }

  async searchProducts({ query, category, limit }: ProductSearchInput) {
    const normalized = query.toLowerCase()
    return products.filter((product) => (product.name.toLowerCase().includes(normalized) || product.category === category || !query) && product.available).slice(0, limit)
  }

  async getProduct(productId: string) { return products.find((product) => product.id === productId) ?? null }

  async getReplacements(productId: string) {
    const product = products.find((item) => item.id === productId)
    return product ? products.filter((item) => item.id !== productId && item.category === product.category).slice(0, 3) : []
  }

  async getOrderHistory(householdId: string) { return deliveries.filter((delivery) => delivery.householdId === householdId) }

  async getBasket(householdId: string) { return { householdId, items: [] } }

  async updateBasket(_input: BasketUpdateInput) { return { basketId: 'mock-basket-1', updated: true } }
}

export const mockMcpClient = new MockMcpClient()

