import { mcpService } from '../mcp/mcp.service.js'
import { AppError } from '../../lib/errors.js'
import type { StoreProvider } from './store-provider.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const parseResult = (result: unknown): unknown => {
  if (!isRecord(result)) return result
  if (result.structuredContent !== undefined) return result.structuredContent
  if (!Array.isArray(result.content)) return result
  const text = result.content
    .flatMap((item) => isRecord(item) && item.type === 'text' && typeof item.text === 'string' ? [item.text] : [])
    .join('\n')
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const findValue = (value: unknown, keys: readonly string[], depth = 0): unknown => {
  if (depth > 5) return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, keys, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  for (const key of keys) {
    if (key in value) return value[key]
  }
  for (const child of Object.values(value)) {
    const found = findValue(child, keys, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

const stringValue = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null

const slotFrom = (value: unknown): { start: string; end: string } | null => {
  if (!isRecord(value) || value.available === false) return null
  const start = stringValue(value.start ?? value.from ?? value.timeslotStart ?? value.scheduledFrom)
  const end = stringValue(value.end ?? value.to ?? value.timeslotEnd ?? value.scheduledTo)
  return start && end ? { start, end } : null
}

const findAvailableSlot = (value: unknown, depth = 0): { start: string; end: string } | null => {
  if (depth > 5) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const slot = findAvailableSlot(item, depth + 1)
      if (slot) return slot
    }
    return null
  }
  if (!isRecord(value)) return null
  const direct = slotFrom(value)
  if (direct) return direct
  for (const child of Object.values(value)) {
    const slot = findAvailableSlot(child, depth + 1)
    if (slot) return slot
  }
  return null
}

const required = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined || value === '') throw new AppError('MCP_CONTEXT_UNAVAILABLE', message, 502)
  return value
}

export const silpoProvider: StoreProvider = {
  startAuthorization(state) {
    return mcpService.startAuthorization(state)
  },
  async finishAuthorization(session, callbackParams) {
    const result = await mcpService.finishAuthorization(session, callbackParams)
    return result.tokenSet
  },
  async getRecentOrders(accessToken, limit) {
    const activeCart = parseResult(await mcpService.callTool(accessToken, 'silpo_get_my_shopping_cart'))
    const shoppingCartId = required(stringValue(findValue(activeCart, ['shoppingCartId', 'cartId'])), 'Silpo active shopping cart is required to read store receipts')
    const cart = parseResult(await mcpService.callTool(accessToken, 'silpo_get_shopping_cart_by_id', { shoppingCartId, cartId: shoppingCartId }))
    const branchId = required(stringValue(findValue(cart, ['branchId'])), 'Silpo branch context is required to read store receipts')
    const delivery = findValue(cart, ['delivery'])
    const deliveryType = required(stringValue(findValue(cart, ['deliveryType']) ?? (isRecord(delivery) ? delivery.type ?? delivery.deliveryType : undefined)), 'Silpo delivery context is required to read store receipts')
    const slots = parseResult(await mcpService.callTool(accessToken, 'silpo_get_time_slots', { branchId, deliveryType }))
    const slot = required(findAvailableSlot(slots), 'Silpo available time slot is required to read store receipts')
    return mcpService.callTool(accessToken, 'silpo_get_my_offline_orders', {
      branchId,
      deliveryType,
      timeslotStart: slot.start,
      timeslotEnd: slot.end,
      limit,
    })
  },
}
