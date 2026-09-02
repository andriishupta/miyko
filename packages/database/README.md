# `@miyko/database`

This package contains the PostgreSQL Drizzle schema, relations and migration configuration for MiyKo. It is server-only: the Expo app must never receive `DATABASE_URL`, provider tokens or database credentials.

Authentication uses email/password plus opaque bearer sessions. The API generates a cryptographically random token, stores only its hash in `user_sessions`, and sends the raw token to the mobile client once. The client stores it in SecureStore. Sessions expire and can be revoked; JWTs and refresh-token rotation are intentionally out of scope for the hackathon scaffold.

The API database connection uses the `api_role` role. The official Postgres init script creates it once for a fresh local volume; `drizzle/0001_api_role.sql` grants runtime privileges and installs auth lookup helpers, while `drizzle/0002_auth_session_onboarding.sql` installs session creation and removes the retired decision flag. It has no superuser, database-creation, role-creation or `BYPASSRLS` privileges and is not the owner of the tables. Its password must be provisioned outside migrations through a deployment secret.

## Request context for RLS

The schema-defined policies use these trusted PostgreSQL helper functions:

- `miyko_current_user_id()` returns the authenticated MiyKo user UUID;
- `miyko_is_household_member(household_id uuid)` checks active membership;
- `miyko_can_bootstrap_household(household_id uuid)` gates the initial owner membership;

The API must set the request identity inside a transaction from server-validated authentication, for example with `set_config('app.user_id', $userId, true)`. A client-provided household ID is not an authentication context.

RLS is intentionally high-level: every household-owned table requires active membership for reads and writes, while users and sessions are limited to the current user. The API still enforces resource ownership, role permissions, soft deletion, valid status transitions and owner approval in service methods; RLS is the tenant-isolation backstop. The membership/bootstrap and auth lookup functions use `SECURITY DEFINER` with a fixed `search_path`; the only runtime role is the dedicated `api_role`.

Global authentication and provider catalog tables are not household-owned. `users`, `user_sessions` and `user_providers` are protected by user-scoped RLS policies. Email/password lookup, user creation and session creation use narrowly scoped `SECURITY DEFINER` functions before `app.user_id` exists; session creation validates an active user and returns only the generated session ID. The API then sets `app.user_id` in a transaction and re-checks user/session rows through ordinary RLS queries before continuing. Never expose token hashes or provider credential references through a normal API response. Provider access and MCP/OAuth credentials are represented by server-side references in `user_providers`; `connected_provider_accounts` only binds a user provider account to a household and stores no credentials. All user-visible household tables carry a non-null `household_id` and have RLS enabled. Migration privileges and administrative access remain outside this package.

The `providers` catalog is intentionally generic: `kind` distinguishes `store` and `delivery`, `status` controls whether a provider can be selected, and `capabilities` describes the normalized operations supported by its adapter. The TypeScript export currently keeps the compatibility name `shoppingProviders` while mapping to the `providers` table.

Onboarding deliberately does not require a household: `/auth/register`, `/auth/login`, `/auth/session` and `/auth/logout` are available before household selection. The user can then create or join a household; the `users` table is not blocked by a household-level policy.

## Schema workflow

```text
Docker init (`api_role`) → src/schema.ts → 0000_Initial.sql → 0001_api_role.sql → 0002_auth_session_onboarding.sql → 0003_provider_accounts.sql → PostgreSQL
```

For local development, copy the root `.env.example` to `.env`, start only PostgreSQL with `docker compose up -d postgres`, then run `pnpm --filter @miyko/database db:migrate` and `pnpm --filter api seed:demo`. Drizzle uses `MIGRATION_DATABASE_URL`; the running API uses the RLS-constrained `DATABASE_URL`. The persistent Docker volume keeps the local database between restarts; the init script runs only when that volume is initialized.
