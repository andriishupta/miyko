import type { Context } from 'hono'
import type { AuthUser, RequestContext } from '@miyko/contracts'

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
    requestId: string
    requestContext: RequestContext
  }
}

export type AppContext = Context
