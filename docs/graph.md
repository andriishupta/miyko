# MiyKo `step-order` LangGraph workflow

The runnable graph lives in `apps/workflows` and is registered under the hardcoded slug `step-order`. It runs locally with LangGraph Agent Server for the MVP demo; no LangGraph deployment and no MiyKo-owned checkpointer are required.

## Local services

```text
Expo app → MiyKo API → outbox worker → local Agent Server :2024
                                      ├── OpenAI
                                      ├── Mem0 Cloud
                                      └── official Silpo MCP
```

Use `apps/workflows/.env` for OpenAI and Mem0 configuration. LangSmith Cloud tracing is not required. The API needs `LANGGRAPH_API_URL=http://127.0.0.1:2024`; `LANGGRAPH_API_KEY` is optional and only used later for a hosted deployment. The provider token is resolved from the encrypted household binding and supplied on each run as runtime-only context; it never enters Expo, graph state or Mem0.

Start locally:

```bash
pnpm install
pnpm --filter @miyko/workflows dev
```

LangGraph Agent Server owns checkpoints and interrupt/resume. MiyKo stores only the workflow UUID/thread ID, latest run/status, provider references and approval decisions. `langgraph dev` persists development state to its local directory, so the same thread can continue across API requests and ordinary local restarts as long as that directory is preserved. This is sufficient for the recorded demo, but it is not a production durability guarantee; deploy or use a production-like Agent Server later when the workflow must survive machine loss and deployment replacement.

## Demo flow

```text
owner connects the household Silpo account once through OAuth 2.1 + PKCE
  → start step-order from text/audio
  → graph reads relevant Mem0 context
  → once per household, read the latest 10 online Silpo orders and summarize them into Mem0
  → keep the initial request in LangGraph state; do not change the Silpo basket
  → owner/admin/editor additions go directly into the shared graph plan
  → viewer/child addition interrupts for owner/admin approval
  → approve adds it to the plan; decline removes it
  → owner/admin asks to prepare the basket
  → graph discovers current Silpo tool schemas and mutates the real basket
  → owner/admin may request a replacement, fulfillment mode or delivery slot
  → graph returns names, quantities, prices, total and checkout link
  → owner finishes checkout in Silpo
```

Notifications are outside the current MVP. The pending approval already appears in MiyKo and can be refreshed manually.

## Permissions

- `owner` and `admin`: add requests, approve/decline, prepare or update the provider basket.
- `editor`: add requests directly; provider mutations require owner/admin approval.
- `viewer`: requests require owner/admin approval.

The API supplies the authenticated member ID and role to the graph. Mem0 and client input never grant permissions.

## Silpo boundary

Use only `https://mcp.silpo.ua/mcp`. The graph calls `tools/list`, filters tools by operation and lets the model follow the returned JSON schemas. Initial history import is read-only. Basket preparation and replacement are real MCP writes.

Silpo exposes basket mutation and checkout links but no final place-order tool. The workflow must not report a completed order unless Silpo returns an actual order ID. For the demo, opening the returned checkout link is the final manual step.

OAuth is Authorization Code + PKCE with Dynamic Client Registration. `POST /providers/:providerSlug/oauth/start` returns the provider authorization URL, the public API callback completes the code exchange, and the API stores encrypted credentials behind one household binding. Only the household owner starts this flow. MiyKo login/password remains separate application authentication and is never used as provider credentials.

## Memory boundary

- LangGraph state: active request, household additions, pending request, basket view and current step.
- Mem0 household namespace `household:{householdId}`: reusable order-history summary and household preferences.
- Mem0 member namespace `member:{memberId}`: relevant personal preferences.
- PostgreSQL: no messages, plans, products, basket items or checkpoints.

The first history bootstrap checks Mem0 for the `silpo_order_history` source marker before requesting the latest ten online orders. The imported summary is also available to the first workflow run. Mem0 is context only; it does not authorize actions or replace graph state.

## Local evidence

The workflow emits JSON logs to stdout for OpenAI classification/model calls, Silpo MCP tool discovery, each actual MCP tool call and the resulting basket/order references, item count, total and checkout availability. It never logs access tokens, prompts or raw tool arguments. The React Native workflow view remains the source for visible basket item names and prices. These logs appear in the local workflow terminal and automatically become `docker logs` if the workflow is containerized later.
