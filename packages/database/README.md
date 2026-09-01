# `@miyko/database`

This package contains the PostgreSQL Drizzle schema, relations and migration configuration for MiyKo. It is server-only: the Expo app must never receive `DATABASE_URL`, provider tokens or database credentials.

Authentication uses email/password plus opaque bearer sessions. The API generates a cryptographically random token, stores only its hash in `user_sessions`, and sends the raw token to the mobile client once. The client stores it in SecureStore. Sessions expire and can be revoked; JWTs and refresh-token rotation are intentionally out of scope for the hackathon scaffold.

## Request context for RLS

The schema-defined policies use these trusted PostgreSQL helper functions:

- `miyko_current_user_id()` returns the authenticated MiyKo user UUID;
- `miyko_is_household_member(household_id uuid)` checks active membership;
- `miyko_can_bootstrap_household(household_id uuid)` gates the initial owner membership;

The API must set the request identity inside a transaction from server-validated authentication, for example with `set_config('app.user_id', $userId, true)`. A client-provided household ID is not an authentication context.

RLS is intentionally high-level: every household-owned table requires active membership for reads and writes, while users and sessions are limited to the current user. The API still enforces resource ownership, role permissions, soft deletion, valid status transitions and owner approval in service methods; RLS is the tenant-isolation backstop. The helper functions are emitted into the initial migration as `SECURITY DEFINER` functions with a fixed `search_path`; the package does not create or manage PostgreSQL roles.

Global authentication and provider catalog tables are not household-owned. `users` and `user_sessions` are protected by user-scoped RLS policies. Email/password lookup, user creation and the first session insert are authentication bootstrap operations and must use a controlled server-side auth query/function before `app.user_id` exists; never expose token hashes through a normal API response. All user-visible household tables carry a non-null `household_id` and have RLS enabled. Migration/bootstrap roles are intentionally not created by this package.

## Schema workflow

```text
src/schema.ts → 0000_initial.sql → PostgreSQL
```

`db:generate`, `db:migrate` and `db:studio` are available for a later database-enabled workflow. This scaffold does not include a database connection, migration output or real provider data.
