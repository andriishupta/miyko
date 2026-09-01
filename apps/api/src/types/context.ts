import type { Context } from 'hono'
import type { RequestContext, User } from '../lib/types.js'

declare module 'hono' {
  interface ContextVariableMap {
    user: User
    requestId: string
    requestContext: RequestContext
  }
}

export type AppContext = Context

