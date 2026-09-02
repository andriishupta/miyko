# MiyKo API

Hono API for the mobile prototype. Tenant data uses the server-only Drizzle client and PostgreSQL RLS. The API has no mock MCP, Mem0, transcription or provider-secret fallback.

## Run

```sh
pnpm install
pnpm --filter api dev
```

`DATABASE_URL` must use the non-owner `api_role`. `MIGRATION_DATABASE_URL` is reserved for migrations and the demo seed. Authenticated requests set transaction-local `app.user_id` before RLS-protected queries.

## Required environment

- `DATABASE_URL`, `CORS_ORIGINS`, optional `PORT` and `REQUEST_TIMEOUT_MS`. `CORS_ORIGINS` is a comma-separated explicit allowlist.
- `PROVIDER_SECRETS_ENCRYPTION_KEY`: base64 or 64-character hex encoding of exactly 32 bytes. Missing or invalid configuration is an explicit API error.
- One MCP transport: `SILPO_MCP_URL` or `SILPO_MCP_COMMAND`; use `SILPO_MCP_ARGS` for stdio arguments, `SILPO_MCP_ENV_KEYS` for the explicit comma-separated environment allowlist, and `MCP_TIMEOUT_MS` optionally.
- MCP tool mappings: `SILPO_MCP_AUTHENTICATE_TOOL`, `SILPO_MCP_REAUTHORIZE_TOOL`, `SILPO_MCP_SEARCH_PRODUCTS_TOOL`, `SILPO_MCP_GET_PRODUCT_TOOL`, `SILPO_MCP_GET_REPLACEMENTS_TOOL`, `SILPO_MCP_ORDER_HISTORY_TOOL`, `SILPO_MCP_GET_BASKET_TOOL`, `SILPO_MCP_UPDATE_BASKET_TOOL`.
- `MEM0_API_KEY` for server-only Mem0 access.
- `OPENAI_API_KEY` and `OPENAI_MODEL` for LangGraph agent runs. Transcription uses `TRANSCRIPTION_API_KEY` or `OPENAI_API_KEY`, with optional `TRANSCRIPTION_API_URL`, `TRANSCRIPTION_MODEL` and `AUDIO_MAX_BYTES`.

No `MCP_MODE` is supported. MCP uses the official SDK transport, `tools/list`, and `tools/call`; every external response is validated with Zod. Silpo is the first adapter, while the core API uses generic provider slugs and capabilities.

## Routes

- Public: `GET /health`, `POST /auth/login` and `POST /auth/register`.
- Authenticated bootstrap: `GET /auth/session`, `POST /auth/logout`, `POST /onboarding/households` and `POST /invitations/:id/accept`.
- Provider account: `GET /providers`, `GET /providers/accounts`, `GET /providers/:providerSlug/tools`, `POST /providers/:providerSlug/connect`, `POST /providers/:providerSlug/reauthorize`, `DELETE /providers/:providerSlug`.
- Household provider: `POST /providers/:providerSlug/bind`, `POST /providers/:providerSlug/sync`, `GET /providers/:providerSlug/sync-status`, `GET /providers/:providerSlug/orders`.
- Household resources: dashboard, products, household, orders/proposals, deliveries, audio and memory routes. They require a valid session, `X-Household-Id`, active membership and role authorization. Settings are local UI preferences in the MVP and have no API endpoint.

Provider capabilities are operation names such as `products.search`, `products.replacements`, `receipts.read`, `orders.history`, `basket.update` and `deliveries.read`. Unsupported capabilities return `PROVIDER_CAPABILITY_UNSUPPORTED`. Provider access/refresh tokens are encrypted ciphertext in server-side storage, never returned to the client or written to logs. Reauthorization refreshes or replaces credentials; disconnect revokes the account and removes stored references.

## Outbox worker

The API starts an in-process worker after an authenticated household context is established. It can later be moved to a separate process without changing events. Claims use row locks and leases (`claimedAt`, `claimedBy`, `claimExpiresAt`). Events move through `processing`, `retrying`, `published` or `dead_letter`; attempts and safe last-error codes are persisted. Retries use capped exponential backoff. Unknown event types are never published and go directly to `dead_letter`.

Handlers exist for `provider.sync_requested`, `user.memory_initialization_requested`, `feedback.created`, `proposal.created`, `proposal.approved`, `proposal.declined` and `delivery.sync_requested`. Household creation and new invitation acceptance enqueue member memory initialization. First provider binding and stale provider state enqueue an idempotent provider sync. Provider sync imports validated orders/receipts and deliveries, stores provider references and updates sync/error state.

Memory initialization syncs up to 100 local receipts, runs the LangGraph workflow, writes a summary to the member namespace in Mem0 and stores only sync metadata in PostgreSQL. Household, member and planning-run namespaces remain separate. Agent workflows persist LangGraph thread/run IDs in `planning_runs` and are exposed through the function-based Agent Layer interface. The current LangGraph implementation uses `MemorySaver` as its selected checkpoint implementation; it is not a mock or fallback. LangSmith Deployment/Agent Server may host the same boundary with managed persistence and task execution, but MiyKo does not create checkpoint tables. Agents cannot mutate a basket. Basket changes remain behind owner approval in the order service.

Audio is size/type/duration limited, sent to the configured transcription provider, passed to the food-intent LangGraph workflow and persisted as a `food_intents` row. Raw audio is not stored and full transcripts are not logged.

## Demo seed

Use `pnpm --filter api seed:demo` with `MIGRATION_DATABASE_URL` and `DEMO_PASSWORD`. The seed includes demo households, memberships, products, meal plans, orders and deliveries, but no fake provider credentials; provider login must happen through the API.
