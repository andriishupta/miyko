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

/** Authentication and tool discovery only. LangGraph/MCP owns basket and product data. */
export interface StoreProvider {
  discoverTools(): Promise<string[]>;
  authenticate(input: ProviderAuthRequest): Promise<ProviderTokenSet>;
  reauthorize(input: { refreshToken: string }): Promise<ProviderTokenSet>;
}
