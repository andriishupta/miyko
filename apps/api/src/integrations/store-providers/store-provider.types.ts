import type { ProviderAuthRequest } from "@miyko/contracts";

export type ProviderTokenSet = {
  providerSubject: string | null;
  accountLogin: string | null;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scopes: string[];
};

/** Provider authorization only. LangGraph/MCP owns tool discovery, basket and product data. */
export interface StoreProvider {
  authenticate(input: ProviderAuthRequest): Promise<ProviderTokenSet>;
  reauthorize(input: { refreshToken: string }): Promise<ProviderTokenSet>;
}
