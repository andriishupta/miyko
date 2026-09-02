# MiyKo API

Hono API for authentication, household access, provider connections and the thin control plane around managed workflows. Workflow memory and checkpoints stay in managed services.

## Runtime boundary

- PostgreSQL/Drizzle stores identity, household membership, provider credentials, thin workflow projections, approval decisions, audit data and the retryable outbox transport.
- LangGraph Cloud owns workflow state, checkpoints, messages, generated recipes, basket contents and pause/resume.
- Mem0 Cloud owns long-term household/member memory.
- Silpo MCP owns the current provider products, images, basket operations, fulfillment and order details. The API never builds a local product catalog or authoritative order state.

`DATABASE_URL` must use the non-owner `api_role`. `MIGRATION_DATABASE_URL` is reserved for the single baseline migration and administrative seed work. Authenticated requests set transaction-local `app.user_id` before RLS-protected queries.

## Required environment

- `DATABASE_URL`, `CORS_ORIGINS`, optional `PORT` and `REQUEST_TIMEOUT_MS`.
- `PROVIDER_SECRETS_ENCRYPTION_KEY` for server-side encrypted provider secrets.
- `SILPO_MCP_URL` or `SILPO_MCP_COMMAND` plus the explicit MCP tool configuration.
- `MEM0_API_KEY` for Mem0 Cloud.
- `LANGGRAPH_API_URL`, `LANGGRAPH_ASSISTANT_ID` and `LANGGRAPH_API_KEY` for LangGraph Cloud; LangSmith tracing is configured in the managed graph deployment.
- `TRANSCRIPTION_API_KEY` or `OPENAI_API_KEY` for audio requests.

Missing required configuration fails explicitly. No environment-based mock or fallback is selected silently.

## Routes

- Public/auth bootstrap: `/health`, `/auth/*`, `/onboarding/households`, `/invitations/*`.
- Provider connection: `/providers`, `/providers/accounts`, `/:providerSlug/tools`, `connect`, `reauthorize`, `bind` and disconnect. Product, basket, order and fulfillment tools are not exposed as API routes; the managed LangGraph workflow owns those calls.
- Managed workflow: `GET/POST /workflows`, `GET /workflows/:workflowId` and `POST /workflows/:workflowId/actions`.
- Supporting surfaces: `/dashboard`, `/household`, `/audio/process` and `/memory`.

Starting a workflow creates one deterministic UUID. The same UUID is used as the LangGraph thread ID. The database stores only that external reference and the latest observed run/status. Member actions are delivered to the graph through the outbox; an approval projection is created only when LangGraph returns an interrupt that requires approval. Owner approval is required before provider-mutating actions.

## Flow

```text
login/register → create or join household → connect/bind Silpo
  → create one workflow for the request
  → LangGraph + Mem0 + Silpo MCP
  → interrupt for replacement / fulfillment / delivery slot / approval
  → owner approves or declines
  → resume the same LangGraph thread
  → provider MCP updates basket or completes order
```

The in-process outbox worker polls every five seconds and claims the oldest available event through `public.miyko_claim_outbox_events(worker_id, limit, lease_ms)`. That narrowly scoped `SECURITY DEFINER` function is callable by `api_role`, uses `FOR UPDATE SKIP LOCKED`, sets a lease and returns an active household member identity with the event row. The API then opens a transaction-local `app.user_id` context for the handler; it never uses a migration owner or a `BYPASSRLS` connection. Missing worker database support is an explicit startup/runtime error, not a fallback.

Events are idempotent at the outbox boundary: workflow start uses the deterministic workflow/thread UUID, actions require `Idempotency-Key`, and graph runs are looked up by the source event ID before a new run is created. Claims move through `processing`, `retrying`, `published` or `dead_letter` with attempts, safe last-error codes, a lease and capped exponential backoff. Unknown event types are dead-lettered. The worker can later be moved into a separate process without changing the event handler boundary.

The API may later add a bounded TTL cache for repeated provider reads. Cached values and the workflow projection are informational and must be refreshed/revalidated by the managed workflow before a basket or order mutation.

## Database

The Drizzle schema is deliberately limited to auth, households, provider connections, thin workflow references/projections, approvals, outbox and audit logs. There are no `food_intents`, `meal_plans`, `provider_products`, local recipes, local orders, local deliveries or memory synchronization tables. The migration directory contains one clean `0000_initial.sql`; it is not executed by the application.
