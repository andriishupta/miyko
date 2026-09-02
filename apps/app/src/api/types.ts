import type {
  AuthSession,
  AudioProcessResponse,
  DashboardResponse,
  Delivery,
  DeliveryDetailsResponse,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdRole,
  HouseholdSummary,
  InvitationCreateResponse,
  LoginResponse,
  MemoryInitializationStatusResponse,
  Product,
  ProductReplacementsResponse,
  ProductResponse,
  ProductSearchResponse,
  Order,
  FoodIntent,
  PlanningRun,
  ShoppingProposal,
  Provider,
  ProviderAccountsResponse,
  ProviderConnectionResponse,
  ProviderOrdersResponse,
  ProviderSyncResponse,
  UserProviderAccount,
} from '@miyko/contracts';

export type ApiRole = HouseholdRole;

export type AppSession = Pick<AuthSession, 'accessToken' | 'user' | 'householdId'>;

export type ApiLoginResponse = LoginResponse;

export type ApiDashboard = DashboardResponse;

export type ApiDeliverySummary = NonNullable<DashboardResponse['latestDelivery']>;

export type ApiDelivery = Delivery;
export type ApiDeliveryDetails = DeliveryDetailsResponse;

export type ApiHouseholdSummary = HouseholdSummary;

export type ApiHouseholdMember = HouseholdMember;

export type ApiInvitation = HouseholdInvitation;
export type ApiInvitationCreateResponse = InvitationCreateResponse;

export type ApiProduct = Product;
export type ApiProductSearchResponse = ProductSearchResponse;
export type ApiProductResponse = ProductResponse;
export type ApiProductReplacementsResponse = ProductReplacementsResponse;

export type ApiOrderProposal = ShoppingProposal;
export type ApiOrder = Order;

export type ApiProvider = Provider;
export type ApiUserProviderAccount = UserProviderAccount;
export type ApiProviderAccountsResponse = ProviderAccountsResponse;
export type ApiProviderConnectionResponse = ProviderConnectionResponse;
export type ApiProviderOrdersResponse = ProviderOrdersResponse;

export type ApiAudioProcessResponse = AudioProcessResponse;

/** Temporary app boundary for the planned intent endpoint. */
export type ApiIntentProcessResponse = {
  intent: FoodIntent;
  planning?: PlanningRun | null;
  proposal?: ApiOrderProposal | null;
  response?: { type: string; message: string } | null;
};

export type ApiMemoryInitializationStatus = MemoryInitializationStatusResponse;

export type ApiProviderSyncResponse = ProviderSyncResponse;

export type ApiPlanningRunResponse = PlanningRun;
