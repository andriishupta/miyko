import { startServer } from './server.js'

startServer((info) => {
  console.log(`MiyKo API is running on http://localhost:${info.port}`)
})
