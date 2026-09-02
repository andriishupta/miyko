import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'
import { createClient } from '@miyko/database/client'

// The API owns one server-side Drizzle client. Do not expose sql or close to feature code.
const client = createClient()
const rootDb = client.db
type RuntimeDatabase = typeof rootDb

const databaseStorage = new AsyncLocalStorage<RuntimeDatabase>()

// Feature code keeps using the shared db import, while authenticated requests
// transparently resolve it to their transaction-local connection.
export const db = new Proxy(rootDb, {
  get(target, property) {
    const scopedDb = databaseStorage.getStore() ?? target
    return Reflect.get(scopedDb, property, scopedDb)
  },
}) as RuntimeDatabase

/** Run an authenticated request with the RLS identity bound to its transaction. */
export const withRlsContext = async <T>(userId: string, callback: () => Promise<T>): Promise<T> =>
  rootDb.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    return databaseStorage.run(transaction as unknown as RuntimeDatabase, callback)
  })
