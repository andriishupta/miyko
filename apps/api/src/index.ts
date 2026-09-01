import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './lib/config.js'

serve({
  fetch: app.fetch,
  port: config.port,
}, (info) => {
  console.log(`MiyKo mock API is running on http://localhost:${info.port}`)
})
