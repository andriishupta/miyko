# MiyKo

MiyKo is a mobile household food assistant with memory. It turns a short food intention into a shared meal plan and, when a store provider is connected, a shopping proposal.

The core loop is:

```text
intent → planning → household collaboration → owner approval
       → Silpo basket → feedback → next purchase suggestion
```

MiyKo never creates or changes a real shopping basket without explicit owner approval.

## Product scope

The prototype focuses on:

- individual and shared household spaces;
- owner, admin, editor and viewer roles;
- food intentions and meal planning;
- household preferences, restrictions and purchase history;
- Mem0 long-term memory;
- real Silpo MCP product search and basket updates;
- approval of proposed items;
- feedback and future follow-up notifications.

It does not include payment processing, automatic ordering, other retailers, medical advice, exact pantry tracking or detailed calorie analytics.

## High-level architecture

```text
Expo app (untrusted UI)
          ↓
Hono API (auth, permissions, business state)
   ┌──────┼──────────┬─────────────┐
   ↓      ↓          ↓             ↓
Postgres Mem0  LangGraph Cloud  StoreProvider → Silpo MCP
   ↑
RLS + outbox
```

There is one API application. It contains the business services, a LangGraph Cloud client and an in-process outbox worker. LangGraph Cloud runs and checkpoints workflows; the API stores only business facts and workflow correlation IDs. LangSmith Cloud provides tracing. The provider abstraction stays because it keeps Silpo-specific MCP details outside the core domain.

```text
apps/
  app/          Expo / React Native client
  api/          Hono API, authentication, agent and outbox worker
packages/
  contracts/    Shared Zod schemas and API types
  database/     Drizzle schema, migrations and RLS
```

Detailed desired and current application flows are documented in [docs/architecture.md](docs/architecture.md).

Docker Compose is used only for local PostgreSQL business data. There is no local agent checkpoint store or separate workflow runner.

## Technology

- Mobile: Expo, React Native and TypeScript.
- API: Hono and TypeScript.
- Agent Layer: LangChain/LangGraph orchestration with LangGraph Cloud state and LangSmith Cloud tracing.
- Database: PostgreSQL with mandatory Row-Level Security.
- Long-term memory: Mem0 Cloud.
- Shopping: official Silpo MCP through a server-side MCP client.
- Validation: Zod.
- Notifications: deferred until the core loop is stable.

## Security model

Security is server-side and deny-by-default.

- Only health and the unauthenticated auth bootstrap endpoints (`/auth/login`, `/auth/register`) are public.
- All other API routes require authentication and household-level authorization.
- A client must never choose its own `user_id`, `household_id` or role.
- Every household-owned query is scoped by `household_id` and protected by PostgreSQL RLS.
- A user may belong to multiple households; membership is checked for the requested household on every request.
- Mem0 namespaces are separated by household, member and planning run. Memory retrieval is always scoped to the authorized household.
- Silpo OAuth tokens and all integration secrets remain on the API server.
- Silpo basket mutations require explicit owner approval and a server-side permission check.
- Logs, traces and errors must not expose tokens, credentials or unnecessary receipt data.

## Local mobile testing

The expected development workflow is local-first:

1. Run the API on the development machine.
2. Run Expo and open the mobile app on a simulator or physical phone.
3. For a physical phone, keep the phone and development machine on the same Wi-Fi network.
4. Configure the mobile API URL with the machine's LAN IP, not `localhost`.
5. Use a temporary HTTPS tunnel only if an external OAuth callback or remote device access requires it.

Deployment is optional for the hackathon demo. A hosted API becomes useful only when the phone is outside the local network, an OAuth provider requires a public HTTPS callback, or another person needs to access the demo.

## Local PostgreSQL

Copy `.env.example` to `.env`, then start and migrate the local database:

```sh
cp .env.example .env
set -a; . ./.env; set +a
docker compose up -d postgres
pnpm --filter @miyko/database db:migrate
pnpm --filter api seed:demo
```

The API uses `DATABASE_URL` with the non-owner `api_role`; Drizzle and the demo seed use the admin-only `MIGRATION_DATABASE_URL`. PostgreSQL data is kept in the `miyko_postgres_data` volume.

## Main flow

```text
login/register
  → create household | accept invitation
  → connect provider and bind it to the household
  → outbox: import up to 100 receipts → summarize member memory in Mem0
  → text/audio food intent
  → classify → plan meals → search provider products
  → save local meal plan and optional proposal
  → household edits
  → owner approves
  → update provider basket → save local order/delivery
  → feedback → memory update
```

Provider connection may be skipped during onboarding. Meal planning and household collaboration still work without it; receipt import, product-backed proposals, basket and delivery operations remain unavailable and return explicit provider errors where applicable.

Product requirements and the detailed architecture are documented in [docs/prd.md](docs/prd.md), [docs/idea.md](docs/idea.md) and [docs/architecture.md](docs/architecture.md).

## Repository status

This repository contains the product documentation, Expo app, Hono API, shared contracts and Drizzle database package. The active MVP path and deferred work are tracked in [docs/architecture.md](docs/architecture.md).
