import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
}

export const verifyPassword = (password: string, stored: string) => {
  const [algorithm, salt, expected] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) return false
  const actual = scryptSync(password, salt, 64).toString('hex')
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
