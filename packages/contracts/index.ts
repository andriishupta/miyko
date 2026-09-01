/**
 * Public, serialized business contracts shared by the API and Expo app.
 *
 * These types intentionally do not import Drizzle or expose database-only
 * fields such as password_hash, token_hash or provider token references.
 */

export type UUID = string;
export type ISODateString = string;
export type CurrencyCode = "UAH";

export type AccountStatus = "active" | "suspended" | "deactivated";
export type HouseholdRole = "owner" | "admin" | "member";
export type MembershipStatus = "active" | "removed";
export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked";

export type IntentStatus = "active" | "planned" | "completed" | "cancelled";
export type IntentSource = "text" | "audio";
export type PlanningRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type MealPlanStatus = "draft" | "active" | "completed" | "cancelled";
export type MealPlanItemType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "dessert"
  | "other";

export type ProposalStatus =
  | "draft"
  | "awaiting_changes"
  | "awaiting_owner_approval"
  | "approved"
  | "declined"
  | "applied"
  | "failed";
export type ProposalItemStatus =
  | "proposed"
  | "approved"
  | "declined"
  | "replaced"
  | "edited";
export type ProposalSuggestionType =
  | "add"
  | "replace"
  | "quantity_change"
  | "decline";
export type ProposalDecision = "approve" | "decline" | "replace" | "edit";

export type OrderStatus =
  | "pending"
  | "approved"
  | "syncing"
  | "in_cart"
  | "placed"
  | "completed"
  | "cancelled"
  | "failed";
export type OrderItemStatus =
  | "pending"
  | "approved"
  | "declined"
  | "replaced"
  | "added"
  | "unavailable"
  | "cancelled";
export type DeliveryStatus =
  | "pending"
  | "scheduled"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "failed";
export type SyncStatus = "pending" | "running" | "succeeded" | "failed";
export type NotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";
export type OutboxStatus =
  | "pending"
  | "processing"
  | "published"
  | "retrying"
  | "dead_letter";

export type User = {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  status: AccountStatus;
  lastLoginAt: ISODateString | null;
};

export type AuthUser = Pick<User, "id" | "email" | "displayName">;

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
  householdId: UUID | null;
  expiresAt: ISODateString;
};

export type Household = {
  id: UUID;
  name: string;
  ownerId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type HouseholdMember = {
  id: UUID;
  householdId: UUID;
  userId: UUID;
  role: HouseholdRole;
  canMakeDecisions: boolean;
  status: MembershipStatus;
  joinedAt: ISODateString;
  removedAt: ISODateString | null;
  user?: AuthUser;
};

export type Membership = Pick<
  HouseholdMember,
  "id" | "householdId" | "userId" | "role" | "canMakeDecisions" | "status"
>;

export type HouseholdInvitation = {
  id: UUID;
  householdId: UUID;
  inviterId: UUID;
  inviteeUserId: UUID | null;
  inviteeEmail: string | null;
  role: Exclude<HouseholdRole, "owner">;
  canMakeDecisions: boolean;
  status: InvitationStatus;
  expiresAt: ISODateString;
  acceptedAt: ISODateString | null;
};

export type FoodIntent = {
  id: UUID;
  householdId: UUID;
  submittedByMemberId: UUID;
  text: string;
  status: IntentStatus;
  desiredDate: ISODateString | null;
  desiredDateEnd: ISODateString | null;
  source: IntentSource;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PlanningRun = {
  id: UUID;
  householdId: UUID;
  startedByMemberId: UUID;
  langgraphThreadId: string | null;
  langgraphRunId: string | null;
  status: PlanningRunStatus;
  startedAt: ISODateString | null;
  pausedAt: ISODateString | null;
  completedAt: ISODateString | null;
};

export type MealPlan = {
  id: UUID;
  householdId: UUID;
  planningRunId: UUID | null;
  createdByMemberId: UUID;
  name: string | null;
  notes: string | null;
  status: MealPlanStatus;
  items: MealPlanItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type MealPlanItem = {
  id: UUID;
  householdId: UUID;
  mealPlanId: UUID;
  intentId: UUID | null;
  type: MealPlanItemType;
  title: string;
  notes: string | null;
  servings: number;
  plannedFor: ISODateString;
};

export type Product = {
  id: UUID;
  providerId: UUID;
  providerProductId: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  currency: CurrencyCode;
  unit: string;
  available: boolean | null;
  imageUrl: string | null;
};

export type ProposalItem = {
  id: UUID;
  proposalId: UUID;
  productId: UUID;
  replacementForProductId: UUID | null;
  productName: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number | null;
  estimatedTotalPrice: number | null;
  currency: CurrencyCode;
  status: ProposalItemStatus;
  finalDecisionByMemberId: UUID | null;
  finalDecisionAt: ISODateString | null;
};

export type ShoppingProposal = {
  id: UUID;
  householdId: UUID;
  planningRunId: UUID | null;
  mealPlanId: UUID | null;
  createdByMemberId: UUID;
  revision: number;
  status: ProposalStatus;
  approvedByMemberId: UUID | null;
  approvedAt: ISODateString | null;
  declinedByMemberId: UUID | null;
  declinedAt: ISODateString | null;
  items: ProposalItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ProposalComment = {
  id: UUID;
  householdId: UUID;
  proposalId: UUID;
  proposalItemId: UUID | null;
  memberId: UUID;
  body: string;
  createdAt: ISODateString;
};

export type ProposalSuggestion = {
  id: UUID;
  householdId: UUID;
  proposalId: UUID;
  proposalItemId: UUID | null;
  memberId: UUID;
  type: ProposalSuggestionType;
  suggestedProductId: UUID | null;
  suggestedQuantity: number | null;
  suggestedUnit: string | null;
  note: string | null;
  createdAt: ISODateString;
};

export type ProposalItemDecision = {
  id: UUID;
  householdId: UUID;
  proposalItemId: UUID;
  memberId: UUID;
  decision: ProposalDecision;
  replacementProductId: UUID | null;
  quantity: number | null;
  unit: string | null;
  comment: string | null;
  createdAt: ISODateString;
};

export type OrderItem = {
  id: UUID;
  orderId: UUID;
  productId: UUID | null;
  providerProductId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  currency: CurrencyCode;
  status: OrderItemStatus;
};

export type Order = {
  id: UUID;
  householdId: UUID;
  providerId: UUID;
  connectedAccountId: UUID | null;
  proposalId: UUID | null;
  providerOrderId: string | null;
  providerBasketId: string | null;
  status: OrderStatus;
  totalAmount: number | null;
  currency: CurrencyCode;
  purchasedAt: ISODateString | null;
  lastProviderSyncAt: ISODateString | null;
  syncStatus: SyncStatus;
  items: OrderItem[];
};

export type Delivery = {
  id: UUID;
  householdId: UUID;
  orderId: UUID;
  mealPlanItemId: UUID | null;
  providerDeliveryId: string | null;
  scheduledFrom: ISODateString | null;
  scheduledTo: ISODateString | null;
  addressReference: string | null;
  status: DeliveryStatus;
};

export type Feedback = {
  id: UUID;
  householdId: UUID;
  memberId: UUID;
  mealPlanItemId: UUID | null;
  orderId: UUID | null;
  kind: "quantity" | "leftover" | "liked" | "repeat" | "general";
  subject: string | null;
  value: Record<string, unknown>;
  observedAt: ISODateString;
  createdAt: ISODateString;
};

export type MemoryReference = {
  id: UUID;
  householdId: UUID;
  memberId: UUID | null;
  planningRunId: UUID | null;
  scope: "household" | "member" | "planning_run";
  namespace: string;
  externalMemoryId: string | null;
  lastSyncedAt: ISODateString | null;
};

export type NotificationJob = {
  id: UUID;
  householdId: UUID;
  recipientMemberId: UUID;
  sourceEventId: UUID | null;
  orderId: UUID | null;
  scheduledAt: ISODateString;
  nextCheckAt: ISODateString | null;
  estimatedDurationDays: number | null;
  title: string;
  body: string;
  status: NotificationStatus;
  attempts: number;
  sentAt: ISODateString | null;
};

export type OutboxEvent = {
  id: UUID;
  householdId: UUID;
  aggregateType: string;
  aggregateId: UUID;
  eventType: string;
  version: number;
  status: OutboxStatus;
  attempts: number;
  processedAt: ISODateString | null;
  lastError: string | null;
  createdAt: ISODateString;
};

export type LoginResponse = AuthSession;
export type HouseholdSummary = Household & {
  currentMember: Membership;
};

export type RequestContext = {
  requestId: string;
  user: AuthUser;
  household: Household;
  membership: Membership;
};

export type CreateHouseholdRequest = { name: string };
export type InviteMemberRequest = {
  email: string;
  role: Exclude<HouseholdRole, "owner">;
  canMakeDecisions?: boolean;
};
export type CreateFoodIntentRequest = {
  text: string;
  desiredDate?: ISODateString | null;
  desiredDateEnd?: ISODateString | null;
  source?: IntentSource;
};
export type CreateProposalRequest = {
  title: string;
  intent?: string | null;
  items: Array<{ productId: UUID; quantity: number; unit?: string }>;
};
export type EditProposalItemRequest = { quantity: number; unit?: string };
export type ReplaceProposalItemRequest = {
  productId: UUID;
  quantity?: number;
  unit?: string;
};
export type ProductSearchRequest = {
  query: string;
  category?: string;
  limit?: number;
};
export type BasketUpdateRequest = {
  householdId: UUID;
  proposalId: UUID;
  items: Array<{ productId: UUID; quantity: number }>;
};
export type BasketUpdateResponse = { basketId: string; updated: boolean };
export type FeedbackRequest = {
  mealPlanItemId?: UUID | null;
  orderId?: UUID | null;
  kind: Feedback["kind"];
  subject?: string | null;
  value: Record<string, unknown>;
};

export type ApiError = {
  code: string;
  message: string;
  requestId?: string;
};

export type ApiResponse<T> = { data: T } | { error: ApiError };
