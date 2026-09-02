# `@miyko/contracts`

This package is the public serialized business boundary shared by the Hono API and Expo app.

```ts
import type { Household, ShoppingProposal, Product } from "@miyko/contracts";
import { providerSchema } from "@miyko/contracts";
```

Do not import `@miyko/database` from the app. Database rows use `Date` and contain server-only fields; these contracts use API-safe serialized values such as ISO date strings and intentionally omit password hashes, session token hashes and provider credential references.

Provider, memory-initialization, provider-sync, audio, planning and outbox payload validation schemas are exported from `@miyko/contracts` (or `@miyko/contracts/schemas`). Agent-internal request/response shapes stay inside the API Agent Layer.
