import type { StoredOAuthClientInformation, StoredOAuthTokens } from '@modelcontextprotocol/client'
import { z } from 'zod'

export type McpOAuthSession = {
  state: string
  codeVerifier?: string
  clientInformation?: StoredOAuthClientInformation
  tokens?: StoredOAuthTokens
}

export interface McpClient {
  startAuthorization(input: { state: string; redirectUri: string }): Promise<{ authorizationUrl: string; session: McpOAuthSession }>
  finishAuthorization(session: McpOAuthSession, callbackParams: URLSearchParams, redirectUri: string): Promise<{ tokens: StoredOAuthTokens; session: McpOAuthSession }>
}

const clientInformationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  client_id_issued_at: z.number().optional(),
  client_secret_expires_at: z.number().optional(),
  issuer: z.string().optional(),
}).passthrough()

const tokensSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  issuer: z.string().optional(),
}).passthrough()

const sessionSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().optional(),
  clientInformation: clientInformationSchema.optional(),
  tokens: tokensSchema.optional(),
}).strict()

export const serializeOAuthSession = (session: McpOAuthSession) => JSON.stringify(session)

export const parseOAuthSession = (value: string): McpOAuthSession => sessionSchema.parse(JSON.parse(value) as unknown)
