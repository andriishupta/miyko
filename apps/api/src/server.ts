import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './lib/config.js'
import { outboxWorker } from './features/outbox/outbox.worker.js'

export const startServer = (onListen?: Parameters<typeof serve>[1]) => {
  outboxWorker.start()
  return serve({ fetch: app.fetch, hostname: config.host, port: config.port }, onListen)
}
