import { unauthorized } from '../../lib/errors.js'
import { mockTokens, revokeToken, unrevokeToken, users } from '../../lib/mock-store.js'
import type { User } from '../../lib/types.js'

export class AuthService {
  login(email: string, _password: string) {
    const user = users.find((candidate) => candidate.email === email && candidate.status === 'active')
    if (!user) throw unauthorized()
    const accessToken = Object.entries(mockTokens).find(([, userId]) => userId === user.id)?.[0]
    if (!accessToken) throw unauthorized()
    unrevokeToken(accessToken)
    return { accessToken, user: this.publicUser(user), householdId: user.defaultHouseholdId }
  }

  session(user: User) { return { user: this.publicUser(user), householdId: user.defaultHouseholdId } }
  logout(authorization: string | undefined) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
    if (token) revokeToken(token)
    return { revoked: true }
  }
  publicUser(user: User) { return { id: user.id, email: user.email, name: user.name } }
}

export const authService = new AuthService()
