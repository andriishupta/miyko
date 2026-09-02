import type { ProviderAuthRequest } from "@miyko/contracts";
import { mcpService } from "../mcp/mcp.service.js";
import type { ProviderTokenSet, StoreProvider } from "./store-provider.types.js";

const toTokenSet = (result: Awaited<ReturnType<typeof mcpService.authenticate>>): ProviderTokenSet => ({
  providerSubject: result.providerSubject,
  accountLogin: result.accountLogin,
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  accessTokenExpiresAt: result.accessTokenExpiresAt ? new Date(result.accessTokenExpiresAt) : null,
  refreshTokenExpiresAt: result.refreshTokenExpiresAt ? new Date(result.refreshTokenExpiresAt) : null,
  scopes: result.scopes,
});

export const silpoProvider: StoreProvider = {
  discoverTools: () => mcpService.discoverTools(),
  async authenticate(input: ProviderAuthRequest) {
    return toTokenSet(await mcpService.authenticate(input));
  },
  async reauthorize(input: { refreshToken: string }) {
    return toTokenSet(await mcpService.reauthorize(input));
  },
};
