import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { AppError } from '../../lib/errors.js'

type ProviderSecret = {
  accessToken: string
  refreshToken: string | null
}

type EncryptedValue = {
  version: 'v1'
  nonce: string
  tag: string
  value: string
}

const algorithm = 'aes-256-gcm'

const encryptionKey = () => {
  const raw = process.env.PROVIDER_SECRETS_ENCRYPTION_KEY
  if (!raw) throw new AppError('PROVIDER_SECRET_KEY_REQUIRED', 'Provider secret encryption is not configured', 503)
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new AppError('PROVIDER_SECRET_KEY_INVALID', 'Provider secret encryption is not configured correctly', 503)
  return key
}

const encode = (value: string): string => {
  const nonce = randomBytes(12)
  const cipher = createCipheriv(algorithm, encryptionKey(), nonce)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return JSON.stringify({
    version: 'v1',
    nonce: nonce.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    value: encrypted.toString('base64url'),
  } satisfies EncryptedValue)
}

const decode = (value: string): string => {
  try {
    const payload = JSON.parse(value) as Partial<EncryptedValue>
    if (payload.version !== 'v1' || !payload.nonce || !payload.tag || !payload.value) throw new Error('invalid payload')
    const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(payload.nonce, 'base64url'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(payload.value, 'base64url')), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('PROVIDER_SECRET_STORAGE_ERROR', 'Provider secret could not be decrypted', 503)
  }
}

export const providerSecretCrypto = {
  put(value: ProviderSecret) {
    return {
      accessTokenReference: encode(value.accessToken),
      refreshTokenReference: value.refreshToken ? encode(value.refreshToken) : null,
    }
  },

  get(accessTokenReference: string | null, refreshTokenReference: string | null) {
    if (!accessTokenReference) return null
    return {
      accessToken: decode(accessTokenReference),
      refreshToken: refreshTokenReference ? decode(refreshTokenReference) : null,
    }
  },

  rotate(value: ProviderSecret) {
    return this.put(value)
  },
}
