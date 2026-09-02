import type { ApiResponse, CreateHouseholdResponse, HouseholdInvitation, InviteMemberRequest, LoginResponse, MemoryWriteRequest, ProviderAuthRequest, RegisterRequest, WorkflowActionRequest } from "@miyko/contracts";
import { clearStoredSession, getStoredSession } from "@/api/session-storage";
import type { ApiAudioProcessResponse, ApiDashboard, ApiHouseholdMember, ApiHouseholdSummary, ApiInvitation, ApiInvitationCreateResponse, ApiProvider, ApiProviderAccountsResponse, ApiProviderConnectionResponse, ApiWorkflow } from "@/api/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); this.name = "ApiError"; }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; authenticated?: boolean };

async function request<T>(path: string, options: RequestOptions = {}) {
  if (!API_URL) throw new ApiError("API URL is not configured.", 0, "API_URL_MISSING");
  const session = await getStoredSession();
  const { authenticated, body, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (authenticated !== false && session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (session?.householdId) headers.set("X-Household-Id", session.householdId);
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new ApiError("Could not connect to MiyKo API.", 0, "NETWORK_ERROR"); }
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload || "error" in payload) {
    if (response.status === 401) await clearStoredSession();
    const error = payload && "error" in payload ? payload.error : undefined;
    throw new ApiError(error?.message ?? "Request could not be processed.", response.status, error?.code);
  }
  return payload.data;
}

export const api = {
  auth: {
    register: (body: RegisterRequest) => request<LoginResponse>("/auth/register", { method: "POST", authenticated: false, body }),
    login: (email: string, password: string) => request<LoginResponse>("/auth/login", { method: "POST", authenticated: false, body: { email, password } }),
    session: () => request<Pick<LoginResponse, "user" | "householdId">>("/auth/session"),
    logout: () => request<{ revoked: boolean }>("/auth/logout", { method: "POST" }),
  },
  dashboard: { get: () => request<ApiDashboard>("/dashboard") },
  household: {
    summary: () => request<ApiHouseholdSummary>("/household"),
    members: () => request<ApiHouseholdMember[]>("/household/members"),
    invitations: () => request<ApiInvitation[]>("/household/invitations"),
    invite: (email: string, role: InviteMemberRequest["role"] = "viewer") => request<ApiInvitationCreateResponse>("/household/invitations", { method: "POST", body: { email, role } }),
    acceptInvitation: (id: string) => request<HouseholdInvitation>(`/household/invitations/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  },
  invitations: { accept: (id: string) => request<HouseholdInvitation>(`/invitations/${encodeURIComponent(id)}/accept`, { method: "POST" }) },
  onboarding: { createHousehold: (name: string) => request<CreateHouseholdResponse>("/onboarding/households", { method: "POST", body: { name } }) },
  providers: {
    list: () => request<ApiProvider[]>("/providers"),
    accounts: () => request<ApiProviderAccountsResponse>("/providers/accounts"),
    connect: (providerSlug: string, body: ProviderAuthRequest) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/connect`, { method: "POST", body }),
    reauthorize: (providerSlug: string, body: Partial<ProviderAuthRequest>) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/reauthorize`, { method: "POST", body }),
    disconnect: (providerSlug: string) => request<{ disconnected: boolean }>(`/providers/${encodeURIComponent(providerSlug)}`, { method: "DELETE" }),
    bind: (providerSlug: string) => request<ApiProviderConnectionResponse>(`/providers/${encodeURIComponent(providerSlug)}/bind`, { method: "POST" }),
  },
  workflows: {
    list: () => request<ApiWorkflow[]>("/workflows"),
    get: (id: string) => request<{ workflow: ApiWorkflow }>(`/workflows/${encodeURIComponent(id)}`),
    create: (text: string, source: "text" | "audio" = "text") => request<{ workflow: ApiWorkflow }>("/workflows", { method: "POST", body: { text, source } }),
    action: (id: string, body: WorkflowActionRequest) => request<{ workflow: ApiWorkflow }>(`/workflows/${encodeURIComponent(id)}/actions`, { method: "POST", body }),
  },
  audio: {
    process: (body: { fileName: string; mimeType: "audio/m4a" | "audio/mpeg" | "audio/wav" | "audio/webm"; durationSeconds: number; audioBase64: string }) => request<ApiAudioProcessResponse>("/audio/process", { method: "POST", body }),
  },
  memory: {
    status: () => request<{ provider: string; managed: boolean }>("/memory/status"),
    read: (query: string, memberId?: string) => request<unknown>(`/memory?query=${encodeURIComponent(query)}${memberId ? `&memberId=${encodeURIComponent(memberId)}` : ""}`),
    write: (body: MemoryWriteRequest) => request("/memory", { method: "POST", body }),
  },
};

export async function refreshSession() {
  const current = await getStoredSession();
  if (!current) return null;
  const response = await api.auth.session();
  return { ...current, user: response.user, householdId: response.householdId };
}

export async function login(email: string, password: string) {
  const response = await api.auth.login(email, password);
  return { accessToken: response.accessToken, user: response.user, householdId: response.householdId };
}
