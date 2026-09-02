import type { Delivery, Household, Membership, Memory, OrderProposal, OutboxEvent, Product, User } from './types.js'

export const users: User[] = [
  { id: 'user-andrii', email: 'andrii@miyko.local', name: 'Andrii', status: 'active', defaultHouseholdId: 'household-petrenko' },
  { id: 'user-maria', email: 'maria@miyko.local', name: 'Maria', status: 'active', defaultHouseholdId: 'household-petrenko' },
  { id: 'user-child', email: 'child@miyko.local', name: 'Child profile', status: 'active', defaultHouseholdId: 'household-petrenko' },
]

export const mockTokens: Record<string, string> = {
  'mock-owner-token': 'user-andrii',
  'mock-member-token': 'user-maria',
  'mock-child-token': 'user-child',
}
const revokedTokens = new Set<string>()

export const households: Household[] = [
  { id: 'household-petrenko', name: 'Petrenko household', timezone: 'Europe/Kyiv', ownerId: 'user-andrii' },
]

export const memberships: Membership[] = [
  { userId: 'user-andrii', householdId: 'household-petrenko', role: 'owner' },
  { userId: 'user-maria', householdId: 'household-petrenko', role: 'editor' },
  { userId: 'user-child', householdId: 'household-petrenko', role: 'viewer' },
]

export const products: Product[] = [
  { id: 'product-eggs-10', name: 'Яйця курячі 10 шт', brand: 'Ясенсвіт', category: 'dairy-eggs', price: 74.9, currency: 'UAH', unit: 'упаковка', available: true, imageUrl: null },
  { id: 'product-pasta-500', name: 'Паста спагеті 500 г', brand: 'Barilla', category: 'pasta', price: 89.9, currency: 'UAH', unit: 'пачка', available: true, imageUrl: null },
  { id: 'product-bacon-150', name: 'Бекон нарізка 150 г', brand: 'Premiya', category: 'meat', price: 119.0, currency: 'UAH', unit: 'упаковка', available: true, imageUrl: null },
  { id: 'product-parmesan-200', name: 'Сир пармезан 200 г', brand: 'Prego', category: 'dairy', price: 169.0, currency: 'UAH', unit: 'упаковка', available: true, imageUrl: null },
  { id: 'product-dessert-fruit', name: 'Фрукти сезонні', brand: 'Silpo', category: 'dessert', price: 129.0, currency: 'UAH', unit: 'кг', available: true, imageUrl: null },
  { id: 'product-chips', name: 'Чипси картопляні', brand: 'Chipster', category: 'snacks', price: 69.9, currency: 'UAH', unit: 'пачка', available: true, imageUrl: null },
]

export const deliveries: Delivery[] = [
  { id: 'delivery-demo-1', householdId: 'household-petrenko', status: 'delivered', scheduledFor: '2026-08-30T18:00:00.000Z', address: 'Київ, демо-адреса', total: 671.7, currency: 'UAH', linkedEventId: 'event-dinner-1', products: [{ productId: 'product-eggs-10', quantity: 1, price: 74.9 }, { productId: 'product-pasta-500', quantity: 2, price: 89.9 }, { productId: 'product-bacon-150', quantity: 1, price: 119 }, { productId: 'product-parmesan-200', quantity: 1, price: 169 }, { productId: 'product-dessert-fruit', quantity: 1, price: 129 }] },
]

export const proposals: OrderProposal[] = [
  { id: 'proposal-carbonara', householdId: 'household-petrenko', createdBy: 'user-andrii', title: 'Карбонара на два дні', status: 'review', intent: 'Хочу карбонару на два дні', version: 1, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', items: [{ id: 'item-eggs', productId: 'product-eggs-10', quantity: 1, price: 74.9, status: 'proposed' }, { id: 'item-pasta', productId: 'product-pasta-500', quantity: 2, price: 89.9, status: 'proposed' }, { id: 'item-bacon', productId: 'product-bacon-150', quantity: 2, price: 119, status: 'proposed' }, { id: 'item-parmesan', productId: 'product-parmesan-200', quantity: 1, price: 169, status: 'proposed' }] },
]

export const memories: Memory[] = [
  { id: 'memory-1', householdId: 'household-petrenko', memberId: null, runId: null, text: 'Household usually plans meals for two or three days.', source: 'seed', confirmed: true, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'memory-2', householdId: 'household-petrenko', memberId: 'user-child', runId: null, text: 'Child dislikes spicy products.', source: 'seed', confirmed: true, createdAt: '2026-08-01T10:00:00.000Z' },
]

export const outbox: OutboxEvent[] = []

export const findUserByToken = (token: string) => revokedTokens.has(token) ? undefined : users.find((user) => user.id === mockTokens[token])
export const revokeToken = (token: string) => revokedTokens.add(token)
export const unrevokeToken = (token: string) => revokedTokens.delete(token)
export const findUser = (id: string) => users.find((user) => user.id === id)
export const findHousehold = (id: string) => households.find((household) => household.id === id)
export const findMembership = (userId: string, householdId: string) => memberships.find((membership) => membership.userId === userId && membership.householdId === householdId)
