/** Public API contracts. LangGraph/MCP payloads stay outside this package. */
export type UUID = string;
export type ISODateString = string;

export type AccountStatus = "active" | "suspended" | "deactivated";
export type ProviderStatus = "active" | "inactive";
export type ProviderCapability = string;
export type ProviderAccountStatus = "active" | "expired" | "revoked" | "reconnect_required";
export type HouseholdRole = "owner" | "admin" | "editor" | "viewer";
export type MembershipStatus = "active" | "removed";
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";
export type WorkflowStatus = "pending" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
export type WorkflowProvider = "langgraph";
export const WORKFLOW_KIND = { stepOrder: "step-order" } as const;
export type WorkflowKind = typeof WORKFLOW_KIND[keyof typeof WORKFLOW_KIND];
export type WorkflowApprovalAction = "provider_action" | "fulfillment" | "delivery_slot";
export type ApprovalStatus = "pending" | "approved" | "declined";
export type OutboxStatus = "pending" | "processing" | "published" | "retrying" | "dead_letter";

export type User = {
  id: UUID;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string | null;
  status: AccountStatus;
  lastLoginAt: ISODateString | null;
};
export type AuthUser = Pick<User, "id" | "email" | "displayName">;

export type Provider = {
  id: UUID;
  name: string;
  slug: string;
  status: ProviderStatus;
  capabilities: ProviderCapability[];
};
export type ProviderOAuthStartResponse = { authorizationUrl: string; returnUrl: string };
export type HouseholdProviderConnection = {
  id: UUID;
  providerId: UUID;
  status: ProviderAccountStatus;
  authorizedByMemberId: UUID;
  provider: Provider;
};
export type ProviderConnectionsResponse = { items: HouseholdProviderConnection[] };

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { email: string; password: string; firstName: string; lastName: string; displayName?: string | null };
export type AuthSession = { accessToken: string; user: AuthUser; householdId: UUID | null; expiresAt: ISODateString };
export type LoginResponse = AuthSession;

export type Household = { id: UUID; name: string; ownerId: UUID; createdAt: ISODateString; updatedAt: ISODateString };
export type HouseholdMember = { id: UUID; householdId: UUID; userId: UUID; role: HouseholdRole; status: MembershipStatus; joinedAt: ISODateString; removedAt: ISODateString | null; user?: AuthUser };
export type Membership = Pick<HouseholdMember, "id" | "householdId" | "userId" | "role" | "status">;
export type HouseholdInvitation = { id: UUID; householdId: UUID; inviterId: UUID; inviteeUserId: UUID | null; inviteeEmail: string | null; role: Exclude<HouseholdRole, "owner">; status: InvitationStatus; expiresAt: ISODateString; acceptedAt: ISODateString | null };
export type HouseholdSummary = Household & { currentMember: Membership };

export type WorkflowReference = { provider: WorkflowProvider; threadId: string; runId: string | null; status: WorkflowStatus };
export type WorkflowApproval = {
  id: UUID;
  workflowId: UUID;
  requestedByMemberId: UUID;
  externalRequestId: string | null;
  action: WorkflowApprovalAction;
  status: ApprovalStatus;
  decidedByMemberId: UUID | null;
  decidedAt: ISODateString | null;
  createdAt: ISODateString;
};
export type Workflow = {
  id: UUID;
  householdId: UUID;
  startedByMemberId: UUID;
  providerId: UUID;
  workflowKind: WorkflowKind;
  status: WorkflowStatus;
  workflowProvider: WorkflowProvider;
  threadId: string;
  runId: string | null;
  providerBasketId: string | null;
  providerOrderId: string | null;
  fulfillmentMode: "pickup" | "delivery" | null;
  scheduledFrom: ISODateString | null;
  scheduledTo: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  approvals: WorkflowApproval[];
};
export type WorkflowProviderAction = { type: "provider_action"; requestId?: string; intent: string };
export type WorkflowAction =
  | WorkflowProviderAction
  | { type: "fulfillment_selected"; mode: "pickup" | "delivery" }
  | { type: "delivery_slot_selected"; scheduledFrom: ISODateString; scheduledTo: ISODateString }
  | { type: "approve"; approvalId: UUID }
  | { type: "decline"; approvalId: UUID };
export type CreateWorkflowRequest = { text: string; providerSlug?: string; workflowKind?: WorkflowKind; source?: "text" | "audio" };
export type WorkflowActionRequest = WorkflowAction;
export type WorkflowResponse = { workflow: Workflow };
export type WorkflowViewItem = { name: string; quantity: string | null; price: number | null; imageUrl: string | null };
export type WorkflowView = {
  phase: "collecting" | "approval_required" | "basket_ready" | "ready_for_checkout" | "completed";
  summary: string;
  plannedRequests: Array<{ memberId: UUID; text: string }>;
  items: WorkflowViewItem[];
  total: number | null;
  currency: string | null;
  checkoutUrl: string | null;
};
export type WorkflowViewResponse = { view: WorkflowView };

export type OutboxEvent = { id: UUID; householdId: UUID; aggregateType: string; aggregateId: UUID; eventType: string; version: number; status: OutboxStatus; attempts: number; processedAt: ISODateString | null; lastError: string | null; createdAt: ISODateString };

export type AudioProcessResponse = { requestId: string; status: "accepted"; transcript: string; workflow: Workflow };
export type MemoryReference = { namespace: string; externalMemoryId: string };
export type MemoryWriteRequest = { text: string; memberId?: UUID | null; source: "feedback" | "audio" | "order" | "conversation"; confirmed?: boolean };

export type DashboardResponse = {
  household: Household;
  activeWorkflows: Workflow[];
  householdSummary: { memberCount: number; connectedProviders: number; pendingApprovals: number };
  input: { audioEnabled: boolean; chatEnabled: boolean };
};

export type RequestContext = { requestId: string; user: AuthUser; household: Household; membership: Membership };
export type CreateHouseholdRequest = { name: string };
export type CreateHouseholdResponse = { household: Household; membership: Membership };
export type InviteMemberRequest = { email: string; role: Exclude<HouseholdRole, "owner"> };
export type InvitationCreateResponse = { invitation: HouseholdInvitation; token: string };
export type ApiError = { code: string; message: string; requestId?: string };
export type ApiResponse<T> = { data: T } | { error: ApiError };
