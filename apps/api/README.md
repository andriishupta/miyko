# MiyKo API scaffold

Mock-only Hono API for the mobile prototype. It has no database, real authentication provider, Mem0 connection, speech provider or Silpo MCP connection. The default `MCP_MODE=mock` uses deterministic in-memory adapters.

## Run

```sh
pnpm --filter api dev
```

Demo tokens:

- `Bearer mock-owner-token` — Andrii, owner
- `Bearer mock-member-token` — Maria, adult member
- `Bearer mock-child-token` — child profile

Use `X-Household-Id: household-petrenko` to select the household. The server validates that the authenticated mock user is a member; it never trusts a client role or user ID.

## Main routes

- `GET /health` — public availability check.
- `POST /auth/login` — existing-user mock login; there is no sign-up route.
- `GET /dashboard`, `/products/search`, `/products/:id`, `/products/:id/replacements`.
- `GET /household`, `/household/members`, `/household/invitations`; owner-only invitation creation; `POST /invitations/:id/accept` for an authenticated invitee.
- `GET /deliveries/latest`, `/deliveries`, `/deliveries/:id`.
- `GET /orders/proposals`, `POST /orders/proposals`, proposal item edit/replace/remove, owner-only approve/decline.
- `GET/PATCH /settings`, `POST /audio/process`, `GET/POST /memory`, `POST /memory/feedback`.

Approval requires `Idempotency-Key`. The service re-checks current household membership and owner role immediately before the mock basket adapter call. The adapter interface keeps read operations separate from basket mutation so the real Silpo client can be added later after `tools/list` discovery.
