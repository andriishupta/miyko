import { startServer } from './server.js'

startServer((info) => {
  console.log(`MiyKo API scaffold is running on http://localhost:${info.port}`)
})
