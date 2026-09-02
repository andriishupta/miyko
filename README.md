# MiyKo

MiyKo is a mobile household food agent with memory and a shopping autopilot. It turns a short food intention into a shared meal plan and a proposed Silpo basket, remembers what the household likes and buys, and uses feedback to improve the next shopping cycle.

The core loop is:

```text
intent → planning → household collaboration → owner approval
       → Silpo basket → feedback → next purchase suggestion
```

MiyKo never creates or changes a real shopping basket without explicit owner approval.

## Product scope

The prototype focuses on:

- individual and shared household spaces;
- owner, admin, editor and viewer roles with per-member decision capability;
- food intentions and meal planning;
- household preferences, restrictions and purchase history;
- Mem0 long-term memory;
- real Silpo MCP product search and basket updates;
- approval of proposed items;
- feedback and simulated follow-up notifications.

It does not include payment processing, automatic ordering, other retailers, medical advice, exact pantry tracking or detailed calorie analytics.

## Architecture

```text
Expo / React Native
          ↓
      Hono API
   ┌──────┼────────┬─────────────┐
   ↓      ↓        ↓                  ↓
Postgres Mem0  LangSmith Agent Server  Silpo MCP
   ↓
RLS-protected household data
```

The initial implementation should remain simple:

```text
apps/
  mobile/       Expo / React Native client
  api/          Hono API, authentication, agent and scheduler
packages/
  contracts/    Shared Zod schemas and API types
  config/       Shared project configuration
```

Detailed desired and current application flows are documented in [docs/architecture.md](docs/architecture.md).

Docker Compose is used only for local PostgreSQL persistence; there is still no separate agent/worker application during the prototype. The API can contain the workflow runner and scheduler until scale or deployment needs justify splitting them.

## Technology direction

- Mobile: Expo, React Native and TypeScript.
- API: Hono and TypeScript.
- Workflow: LangGraph behind the Agent Layer interface; checkpoint storage is selected by the runtime, with no mock or fallback mode.
- Database: PostgreSQL with mandatory Row-Level Security.
- Long-term memory: Mem0 Cloud.
- Shopping: official Silpo MCP through a server-side MCP client.
- Validation: Zod.
- Notifications: Expo Notifications with server-side scheduling.
- Observability: LangSmith during workflow development.

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

## Development approach

Work in small vertical slices that prove the product loop:

1. create a household and authenticate;
2. add a food intention;
3. load household memory and propose a plan;
4. search Silpo products;
5. collect member changes;
6. approve or reject as the owner;
7. update the Silpo basket;
8. record feedback and schedule a follow-up.

Keep the implementation understandable and avoid building features outside the MVP. Product requirements and the end-to-end demo scenario are documented in [docs/prd.md](docs/prd.md); the product concept is in [docs/idea.md](docs/idea.md).

## Repository status

This repository contains the product documentation, Expo app, Hono API, shared contracts and Drizzle database package. The system is still in active scaffold development; current gaps and deferred decisions are tracked in [docs/architecture.md](docs/architecture.md).
