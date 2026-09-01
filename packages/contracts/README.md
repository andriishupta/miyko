# `@miyko/contracts`

This package is the public serialized business boundary shared by the Hono API and Expo app.

```ts
import type { Household, ShoppingProposal, Product } from "@miyko/contracts";
```

Do not import `@miyko/database` from the app. Database rows use `Date` and contain server-only fields; these contracts use API-safe serialized values such as ISO date strings and intentionally omit password hashes, session token hashes and provider credential references.
