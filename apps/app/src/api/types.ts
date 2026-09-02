import type {
  ApiResponse,
  AudioProcessResponse,
  DashboardResponse,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdSummary,
  InvitationCreateResponse,
  LoginResponse,
  Provider,
  ProviderAccountsResponse,
  ProviderConnectionResponse,
  RegisterRequest,
  Workflow,
} from "@miyko/contracts";

export type AppSession = Pick<LoginResponse, "accessToken" | "user" | "householdId">;
export type ApiDashboard = DashboardResponse;
export type ApiHouseholdSummary = HouseholdSummary;
export type ApiHouseholdMember = HouseholdMember;
export type ApiInvitation = HouseholdInvitation;
export type ApiInvitationCreateResponse = InvitationCreateResponse;
export type ApiProvider = Provider;
export type ApiProviderAccountsResponse = ProviderAccountsResponse;
export type ApiProviderConnectionResponse = ProviderConnectionResponse;
export type ApiAudioProcessResponse = AudioProcessResponse;
export type ApiWorkflow = Workflow;
export type ApiResponseShape<T> = ApiResponse<T>;
export type ApiRegisterRequest = RegisterRequest;
