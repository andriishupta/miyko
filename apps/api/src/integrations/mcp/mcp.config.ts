import { AppError } from '../../lib/errors.js'

const requiredUrl = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new AppError('MCP_CONFIGURATION_REQUIRED', `${name} is required`, 503)
  try {
    return new URL(value).toString()
  } catch {
    throw new AppError('MCP_CONFIGURATION_INVALID', `${name} must be a valid URL`, 503)
  }
}

export const mcpConfig = () => ({
  serverUrl: requiredUrl('SILPO_MCP_URL'),
  oauthRedirectUri: requiredUrl('SILPO_OAUTH_REDIRECT_URI'),
  appRedirectUri: requiredUrl('PROVIDER_OAUTH_APP_REDIRECT_URI'),
  requestTimeoutMs: Number(process.env.MCP_TIMEOUT_MS ?? 8_000),
})
