import {
  StreamableHTTPClientTransport,
  auth,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from '@modelcontextprotocol/client'
import { AppError } from '../../lib/errors.js'
import { mcpConfig } from './mcp.config.js'
import type { McpClient, McpOAuthSession } from './mcp.client.js'

class SessionOAuthProvider implements OAuthClientProvider {
  authorizationUrl?: string

  constructor(
    private readonly session: McpOAuthSession,
    readonly redirectUrl: string,
  ) {}

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'MiyKo',
      software_id: 'miyko',
      software_version: '1.0.0',
    }
  }

  state() { return this.session.state }
  clientInformation() { return this.session.clientInformation }
  saveClientInformation(value: StoredOAuthClientInformation) { this.session.clientInformation = value }
  tokens() { return this.session.tokens }
  saveTokens(value: StoredOAuthTokens) { this.session.tokens = value }
  redirectToAuthorization(url: URL) { this.authorizationUrl = url.toString() }
  saveCodeVerifier(value: string) { this.session.codeVerifier = value }
  codeVerifier() {
    if (!this.session.codeVerifier) throw new AppError('PROVIDER_OAUTH_INVALID', 'Provider authorization session is invalid', 400)
    return this.session.codeVerifier
  }
}

export class SdkMcpClient implements McpClient {
  async startAuthorization(input: { state: string; redirectUri: string }) {
    const config = mcpConfig()
    const session: McpOAuthSession = { state: input.state }
    const provider = new SessionOAuthProvider(session, input.redirectUri)
    const result = await auth(provider, { serverUrl: config.serverUrl })
    if (result !== 'REDIRECT' || !provider.authorizationUrl) {
      throw new AppError('PROVIDER_OAUTH_INVALID', 'Provider did not start browser authorization', 502)
    }
    return { authorizationUrl: provider.authorizationUrl, session }
  }

  async finishAuthorization(session: McpOAuthSession, callbackParams: URLSearchParams, redirectUri: string) {
    if (callbackParams.get('state') !== session.state) {
      throw new AppError('PROVIDER_OAUTH_INVALID', 'Provider authorization state is invalid', 400)
    }
    if (callbackParams.has('error')) {
      throw new AppError('PROVIDER_OAUTH_DENIED', 'Provider authorization was declined', 400)
    }

    const provider = new SessionOAuthProvider(session, redirectUri)
    const transport = new StreamableHTTPClientTransport(new URL(mcpConfig().serverUrl), { authProvider: provider })
    await transport.finishAuth(callbackParams)
    const tokens = provider.tokens()
    if (!tokens) throw new AppError('PROVIDER_OAUTH_INVALID', 'Provider did not return OAuth tokens', 502)
    return { tokens, session }
  }
}

export const sdkMcpClient = new SdkMcpClient()
