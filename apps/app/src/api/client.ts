import type {
  ApiResponse,
  CreateProposalRequest,
  CreateHouseholdResponse,
  EditProposalItemRequest,
  HouseholdInvitation,
  InviteMemberRequest,
  LoginResponse,
  ProviderAuthRequest,
  RegisterRequest,
  ReplaceProposalItemRequest,
} from '@miyko/contracts';

import { clearStoredSession, getStoredSession } from '@/api/session-storage';
import type {
  ApiDashboard,
  ApiDelivery,
  ApiDeliveryDetails,
  ApiInvitationCreateResponse,
  ApiHouseholdMember,
  ApiHouseholdSummary,
  ApiOrderProposal,
  ApiOrder,
  ApiProductReplacementsResponse,
  ApiProductResponse,
  ApiProductSearchResponse,
  ApiProviderAccountsResponse,
  ApiProviderConnectionResponse,
  ApiProvider,
  ApiProviderOrdersResponse,
  ApiSettings,
} from '@/api/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; authenticated?: boolean };

async function request<T>(path: string, options: RequestOptions = {}) {
  if (!API_URL) throw new ApiError('API URL is not configured.', 0, 'API_URL_MISSING');

  const session = await getStoredSession();
  const { authenticated, body, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (authenticated !== false && session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (session?.householdId) headers.set('X-Household-Id', session.householdId);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Could not connect to MiyKo API.', 0, 'NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload || 'error' in payload) {
    if (response.status === 401) await clearStoredSession();
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new ApiError(error?.message ?? 'Request could not be processed.', response.status, error?.code);
  }

  return payload.data;
}

export const api = {
  auth: {
    register: (body: RegisterRequest) => request<LoginResponse>('/auth/register', { method: 'POST', authenticated: false, body }),
    login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', authenticated: false, body: { email, password } }),
    session: () => request<Pick<LoginResponse, 'user' | 'householdId'>>('/auth/session'),
    logout: () => request<{ revoked: boolean }>('/auth/logout', { method: 'POST' }),
  },
  dashboard: {
    get: (date?: string) => request<ApiDashboard>(date ? `/dashboard?date=${encodeURIComponent(date)}` : '/dashboard'),
  },
  household: {
    summary: () => request<ApiHouseholdSummary>('/household'),
    members: () => request<ApiHouseholdMember[]>('/household/members'),
    invitations: () => request<ApiInvitation[]>('/household/invitations'),
    invite: (email: string, role: InviteMemberRequest['role'] = 'viewer') => request<ApiInvitationCreateResponse>('/household/invitations', { method: 'POST', body: { email, role } }),
    acceptInvitation: (id: string) => request<HouseholdInvitation>(`/household/invitations/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  },
  invitations: {
    accept: (id: string) => request<HouseholdInvitation>(`/invitations/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  },
  onboarding: {
    createHousehold: (name: string) => request<CreateHouseholdResponse>('/onboarding/households', { method: 'POST', body: { name } }),
  },
  providers: {
    list: () => request<ApiProvider[]>('/providers'),
    accounts: () => request<ApiProviderAccountsResponse>('/providers/accounts'),
    connect: (providerSlug: string, body: ProviderAuthRequest) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/connect`, { method: 'POST', body }),
    reauthorize: (providerSlug: string, body: Partial<ProviderAuthRequest>) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/reauthorize`, { method: 'POST', body }),
    disconnect: (providerSlug: string) => request<{ disconnected: boolean }>(`/providers/${encodeURIComponent(providerSlug)}`, { method: 'DELETE' }),
    bind: (providerSlug: string) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/bind`, { method: 'POST' }),
    orders: (providerSlug: string) => request<ApiProviderOrdersResponse>(`/providers/${encodeURIComponent(providerSlug)}/orders`),
  },
  deliveries: {
    latest: () => request<ApiDelivery | null>('/deliveries/latest'),
    all: () => request<ApiDelivery[]>('/deliveries'),
    details: (id: string) => request<ApiDeliveryDetails>(`/deliveries/${encodeURIComponent(id)}`),
  },
  settings: {
    get: () => request<ApiSettings>('/settings'),
    update: (patch: Partial<ApiSettings>) => request<ApiSettings>('/settings', { method: 'PATCH', body: patch }),
  },
  orders: {
    listOrders: () => request<ApiOrder[]>('/orders'),
    latestOrder: () => request<ApiOrder | null>('/orders/latest'),
    getOrder: (id: string) => request<ApiOrder>(`/orders/${encodeURIComponent(id)}`),
    list: () => request<ApiOrderProposal[]>('/orders/proposals'),
    get: (id: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(id)}`),
    create: (body: CreateProposalRequest, idempotencyKey: string) => request<ApiOrderProposal>('/orders/proposals', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body }),
    editItem: (proposalId: string, itemId: string, body: EditProposalItemRequest, idempotencyKey: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(proposalId)}/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', headers: { 'Idempotency-Key': idempotencyKey }, body }),
    replaceItem: (proposalId: string, itemId: string, body: ReplaceProposalItemRequest, idempotencyKey: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(proposalId)}/items/${encodeURIComponent(itemId)}/replace`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body }),
    removeItem: (proposalId: string, itemId: string, idempotencyKey: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(proposalId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: { 'Idempotency-Key': idempotencyKey } }),
    approve: (id: string, idempotencyKey: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } }),
    decline: (id: string, idempotencyKey: string) => request<ApiOrderProposal>(`/orders/proposals/${encodeURIComponent(id)}/decline`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } }),
  },
  products: {
    search: (query: string, category?: string, limit = 20) => request<ApiProductSearchResponse>(`/products/search?query=${encodeURIComponent(query)}${category ? `&category=${encodeURIComponent(category)}` : ''}&limit=${limit}`),
    details: (id: string) => request<ApiProductResponse>(`/products/${encodeURIComponent(id)}`),
    replacements: (id: string) => request<ApiProductReplacementsResponse>(`/products/${encodeURIComponent(id)}/replacements`),
  },
  audio: {
    process: (body: { fileName: string; mimeType: 'audio/m4a' | 'audio/mpeg' | 'audio/wav' | 'audio/webm'; durationSeconds: number; audioBase64: string }) => request('/audio/process', { method: 'POST', body }),
  },
  memory: {
    read: (query: { memberId?: string; runId?: string } = {}) => {
      const params = new URLSearchParams();
      if (query.memberId) params.set('memberId', query.memberId);
      if (query.runId) params.set('runId', query.runId);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/memory${suffix}`);
    },
    write: (body: unknown) => request('/memory', { method: 'POST', body }),
    feedback: (body: unknown) => request('/memory/feedback', { method: 'POST', body }),
  },
};

export async function refreshSession() {
  const current = await getStoredSession();
  if (!current) return null;
  const response = await api.auth.session();
  const session = { ...current, user: response.user, householdId: response.householdId };
  return session;
}

export async function login(email: string, password: string) {
  const response = await api.auth.login(email, password);
  const session = { accessToken: response.accessToken, user: response.user, householdId: response.householdId };
  return session;
}
