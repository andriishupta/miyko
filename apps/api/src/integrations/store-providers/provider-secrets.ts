import { randomBytes } from 'node:crypto'

type ProviderSecret = {
  accessToken: string
  refreshToken: string | null
}

const secrets = new Map<string, ProviderSecret>()

const reference = () => `provider-secret:${randomBytes(24).toString('hex')}`

export const providerSecretStore = {
  put(value: ProviderSecret) {
    const accessTokenReference = reference()
    const refreshTokenReference = value.refreshToken ? reference() : null
    secrets.set(accessTokenReference, value)
    if (refreshTokenReference) secrets.set(refreshTokenReference, value)
    return { accessTokenReference, refreshTokenReference }
  },

  get(accessTokenReference: string | null, refreshTokenReference: string | null) {
    const value = accessTokenReference ? secrets.get(accessTokenReference) : undefined
    if (!value) return null
    return {
      accessToken: value.accessToken,
      refreshToken: refreshTokenReference ? secrets.get(refreshTokenReference)?.refreshToken ?? null : value.refreshToken,
    }
  },
}
