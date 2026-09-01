export type Role = 'owner' | 'adult_member' | 'child'
export type UserStatus = 'active' | 'invited'
export type ProposalStatus = 'draft' | 'review' | 'approved' | 'declined' | 'basket_updated'

export type User = {
  id: string
  email: string
  name: string
  status: UserStatus
  defaultHouseholdId: string
}

export type Membership = {
  userId: string
  householdId: string
  role: Role
}

export type Household = {
  id: string
  name: string
  timezone: string
  ownerId: string
}

export type RequestContext = {
  requestId: string
  user: User
  household: Household
  membership: Membership
}

export type Product = {
  id: string
  name: string
  brand: string
  category: string
  price: number
  currency: 'UAH'
  unit: string
  available: boolean
  imageUrl: string | null
}

export type Delivery = {
  id: string
  householdId: string
  status: 'planned' | 'delivered' | 'cancelled'
  scheduledFor: string
  address: string
  total: number
  currency: 'UAH'
  products: Array<{ productId: string; quantity: number; price: number }>
  linkedEventId: string | null
}

export type ProposalItem = {
  id: string
  productId: string
  quantity: number
  price: number
  status: 'proposed' | 'approved' | 'declined' | 'replaced'
}

export type OrderProposal = {
  id: string
  householdId: string
  createdBy: string
  title: string
  status: ProposalStatus
  items: ProposalItem[]
  intent: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type Memory = {
  id: string
  householdId: string
  memberId: string | null
  runId: string | null
  text: string
  source: 'seed' | 'feedback' | 'audio' | 'order'
  confirmed: boolean
  createdAt: string
}

export type OutboxEvent = {
  id: string
  householdId: string
  type: 'order.created' | 'feedback.created' | 'planning.completed'
  aggregateId: string
  status: 'pending' | 'processed' | 'failed'
  attempts: number
  lastError: string | null
  processedAt: string | null
  createdAt: string
}

