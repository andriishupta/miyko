import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './lib/config.js'

export const startServer = () => serve({ fetch: app.fetch, port: config.port })

