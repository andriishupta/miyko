# MiyKo API scaffold

Hono API for the mobile prototype. Relational reads and writes use the existing server-only `@miyko/database` Drizzle client and `@miyko/contracts` is the API/mobile boundary. Audio, Mem0 and Silpo MCP remain adapter-backed; the default `MCP_MODE=mock` uses deterministic mock operations.

## Run

```sh
pnpm install
pnpm --filter api dev
```

Requires server-side `DATABASE_URL` pointing to the non-owner `api_role`. Authenticated requests set transaction-local `app.user_id` before RLS-protected queries. Drizzle migrations and the demo seed use the separate admin-only `MIGRATION_DATABASE_URL`.

Demo login:

`POST /auth/login` with one of `owner@miyko.local`, `admin@miyko.local`, `editor@miyko.local` or `viewer@miyko.local`. Seed the controlled development data with `pnpm --filter api seed:demo`; override `DEMO_PASSWORD` when needed.

`POST /auth/register` is intentionally available before household selection so onboarding can create the user first. `/auth/login`, `/auth/session` and `/auth/logout` also do not require a household context. After authentication, `POST /onboarding/households` creates an owner membership; `POST /invitations/:id/accept` joins an existing household.

Use `X-Household-Id: <household UUID>` to select the household. The server validates that the authenticated user is an active member; it never trusts a client role or user ID.

## Main routes

- `GET /health` — public availability check.
- `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` — authentication and onboarding bootstrap.
- `POST /onboarding/households` — create a household for an authenticated user without requiring an existing membership.
- `GET /dashboard`, `/products/search`, `/products/:id`, `/products/:id/replacements`.
- `GET /providers`, `GET /providers/accounts`, `POST /providers/:providerSlug/connect`, `POST /providers/:providerSlug/reauthorize`, `DELETE /providers/:providerSlug`.
- Household-scoped `POST /providers/:providerSlug/bind` and `GET /providers/:providerSlug/orders`; these require `X-Household-Id` and an active user provider binding.
- `GET /household`, `/household/members`, `/household/invitations`; owner/admin invitation creation; `POST /invitations/:id/accept` for an authenticated invitee.
- `GET /deliveries/latest`, `/deliveries`, `/deliveries/:id`.
- `GET /orders/latest`, `/orders`, `/orders/:id`; `GET /orders/proposals`, `POST /orders/proposals`, proposal item edit/replace/remove for owner/admin/editor, owner-only approve/decline.
- `GET/PATCH /settings`, `POST /audio/process`, `GET/POST /memory`, `POST /memory/feedback`.

Approval requires `Idempotency-Key`. The service re-checks current household membership and owner permission, updates the proposal and outbox transactionally through Drizzle, then calls the selected provider adapter with the connected user's server-side token. A successful mock basket update creates the relational `orders` and `order_items` records. Missing or expired provider credentials return explicit errors; one reauthorization attempt is prepared in the adapter path.

Settings are intentionally a process-local fallback because the current database schema has no settings table; all other available relational resources use the existing Drizzle client.
