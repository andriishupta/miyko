import type {
  AuthSession,
  DashboardResponse,
  Delivery,
  DeliveryDetailsResponse,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdRole,
  HouseholdSummary,
  InvitationCreateResponse,
  LoginResponse,
  Product,
  ProductReplacementsResponse,
  ProductResponse,
  ProductSearchResponse,
  Order,
  ShoppingProposal,
  Provider,
  ProviderAccountsResponse,
  ProviderConnectionResponse,
  ProviderOrdersResponse,
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

export type ApiSettings = {
  notificationsEnabled: boolean;
  preferredPlanningDays: number;
  language: 'uk' | 'en';
};

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
