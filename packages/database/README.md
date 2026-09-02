# `@miyko/database`

Server-only Drizzle schema for MiyKo. The Expo app must never receive `DATABASE_URL`, session token hashes, provider credentials or encrypted secret values.

The database is a control-plane store, not a food domain store. It contains:

- users, sessions, households, members and invitations;
- generic providers, encrypted provider secrets and household bindings;
- `workflows`, which hold only the LangGraph thread/run, last-observed status and external basket/order references;
- `workflow_approvals`, which hold only request/decision metadata;
- outbox retry transport and audit logs.

Recipes, products, images, basket contents, current order state, delivery slots and workflow checkpoints belong to LangGraph Cloud or Silpo MCP. The API keeps only references, last-observed projection data and approval metadata needed for access control and workflow actions. These local values are not authoritative external state and are not a product/order cache.

## RLS

All household-owned tables require active membership through `miyko_is_household_member`. Users and sessions are scoped to the current authenticated user. Authentication and onboarding helpers are narrowly scoped `SECURITY DEFINER` functions with a fixed search path. The API sets `app.user_id` inside its request transaction after validating the bearer session.

Provider credentials are encrypted server-side and referenced only by the API. The runtime role is a non-owner `api_role` without `BYPASSRLS`; migrations use the separate administrative connection.

## Schema workflow

```text
Docker init (api_role) → src/schema.ts → drizzle/0000_initial.sql → PostgreSQL
```

The migration directory intentionally contains one baseline migration. It must be applied explicitly by the deployment/operator and is never run by API startup.
