import { users } from '../src/lib/mock-store.js'

console.log(JSON.stringify({ mode: 'mock', seededUsers: users.map(({ id, email, name }) => ({ id, email, name })) }, null, 2))

