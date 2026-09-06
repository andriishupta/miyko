# MiyKo API

Hono API for authentication, household access, provider connections and the thin control plane around managed workflows. Workflow memory and checkpoints stay in managed services.

## Runtime boundary

- PostgreSQL/Drizzle stores identity, household membership, provider credentials, thin workflow projections, approval decisions, audit data and the retryable outbox transport.
- LangGraph Agent Server owns workflow state, checkpoints, messages, generated recipes, basket contents and pause/resume.
- Mem0 Cloud owns long-term household/member memory.
- Silpo MCP owns the current provider products, images, basket operations, fulfillment and order details. The API never builds a local product catalog or authoritative order state.

`DATABASE_URL` must use the non-owner `api_role`. `MIGRATION_DATABASE_URL` is reserved for the single baseline migration and administrative seed work. Authenticated requests set transaction-local `app.user_id` before RLS-protected queries.

## Required environment

- `DATABASE_URL`, `CORS_ORIGINS`, optional `PORT` and `REQUEST_TIMEOUT_MS`.
- `PROVIDER_SECRETS_ENCRYPTION_KEY` for server-side encrypted provider secrets.
- `SILPO_MCP_URL`, `SILPO_OAUTH_REDIRECT_URI` and `PROVIDER_OAUTH_APP_REDIRECT_URI` for browser OAuth 2.1 + PKCE and the return to Expo. Authentication is not an MCP tool.
- `MEM0_API_KEY` for Mem0 Cloud.
- `LANGGRAPH_API_URL` for local or hosted Agent Server; `LANGGRAPH_API_KEY` is optional locally. The MVP graph kind `step-order` maps to the same hardcoded graph slug.
- `TRANSCRIPTION_API_KEY` or `OPENAI_API_KEY` for audio requests.

Missing required configuration fails explicitly. No environment-based mock or fallback is selected silently.

For an iOS/Android simulator on the same development machine, the example localhost callback can be used when reachable. For a physical phone, set `HOST=0.0.0.0` so the API listens on the LAN interface. The phone cannot reach the API through the development machine's `127.0.0.1`; use a provider-registered LAN or HTTPS tunnel callback and the same exact value in `SILPO_OAUTH_REDIRECT_URI`.

## Demo household seed

The local demo uses one pre-created household with three members. The seed uses the administrative `MIGRATION_DATABASE_URL`, so it must be run only after the baseline schema is applied:

```bash
pnpm --filter api seed:demo
```

If `DEMO_PASSWORD` is not set, the local-only default is `miyko-demo-password`. The seed prints the exact credentials and household ID as JSON. The accounts are:

- `owner@miyko.local` — `owner`; connects Silpo and approves provider actions.
- `admin@miyko.local` — `admin`; can approve and perform provider actions.
- `user@miyko.local` — `viewer`; joins the household already and requests additions that require approval.

The seed does not connect Silpo or create a provider token. After logging in as owner, open provider management and complete Silpo OAuth in the browser. The other two users use the same seeded household and do not connect Silpo separately. The script is idempotent for the seeded IDs; use a fresh local database if an earlier seed created the old editor/viewer demo accounts.

## Routes

- Public/auth bootstrap: `/health`, `/auth/*`, `/onboarding/households`, `/invitations/*`.
- Provider discovery and household connection projection: `/providers`, `/providers/connections`, `POST /providers/:providerSlug/oauth/start`, public `GET /providers/oauth/callback` and disconnect. The household owner authorizes a provider once in the provider browser; members use the household binding without reconnecting. Provider credentials are encrypted server-side and supplied to LangGraph only as run context. Tool discovery, product, basket, order and fulfillment calls belong to the LangGraph/MCP workflow and are not exposed as mobile API routes.
- Managed workflow: `GET/POST /workflows`, `GET /workflows/:workflowId`, live `GET /workflows/:workflowId/view` and `POST /workflows/:workflowId/actions`.
- Supporting surfaces: `/dashboard`, `/household`, `/audio/process` and `/memory`.

Starting a workflow creates one deterministic UUID and persists its typed workflow kind. The same UUID is used as the LangGraph thread ID, and every retry/resume resolves the graph from that persisted kind. The database stores only that external reference and the latest observed run/status. Member actions are delivered to the graph through the outbox; an approval projection is created only when LangGraph returns an interrupt that requires approval. An authenticated owner/admin command or approval is required before provider-mutating actions.

## Flow

```text
login/register → create or join household → household owner connects Silpo once
  → create one workflow for the request
  → LangGraph + Mem0 + Silpo MCP
  → interrupt for replacement / fulfillment / delivery slot / approval
  → owner/admin approves or declines
  → resume the same LangGraph thread
  → provider MCP updates the basket and returns the Silpo checkout link
```

The in-process outbox worker polls every five seconds and claims the oldest available event through `public.miyko_claim_outbox_events(worker_id, limit, lease_ms)`. That narrowly scoped `SECURITY DEFINER` function is callable by `api_role`, uses `FOR UPDATE SKIP LOCKED`, sets a lease and returns an active household member identity with the event row. The API then opens a transaction-local `app.user_id` context for the handler; it never uses a migration owner or a `BYPASSRLS` connection. Missing worker database support is an explicit startup/runtime error, not a fallback.

Events are idempotent at the outbox boundary: workflow start uses the deterministic workflow/thread UUID, actions require `Idempotency-Key`, and graph runs are looked up by the source event ID before a new run is created. Claims move through `processing`, `retrying`, `published` or `dead_letter` with attempts, safe last-error codes, a lease and capped exponential backoff. Unknown event types are dead-lettered. The worker can later be moved into a separate process without changing the event handler boundary.

The API may later add a bounded TTL cache for repeated provider reads. Cached values and the workflow projection are informational and must be refreshed/revalidated by the managed workflow before a basket or order mutation.

## Database

The Drizzle schema is deliberately limited to auth, households, provider connections, thin workflow references/projections, approvals, outbox and audit logs. There are no `food_intents`, `meal_plans`, `provider_products`, local recipes, local orders, local deliveries or memory synchronization tables. The migration directory contains one clean `0000_initial.sql`; it is not executed by the application.
