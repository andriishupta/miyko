# MiyKo `step-order` LangGraph workflow

The runnable graph lives in `apps/workflows` and is registered under the hardcoded slug `step-order`. It runs locally with LangGraph Agent Server for the MVP demo; no LangGraph deployment and no MiyKo-owned checkpointer are required.

The product concept remains household for the MVP. A household can also be temporary in practice, such as a party, picnic or office event; these examples use the same graph and contract.

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
pnpm --filter workflows dev
```

LangGraph Agent Server owns checkpoints and interrupt/resume. MiyKo stores only the workflow UUID/thread ID, latest run/status, provider references and approval decisions. `langgraph dev` persists development state to its local directory, so the same thread can continue across API requests and ordinary local restarts as long as that directory is preserved. This is sufficient for the recorded demo, but it is not a production durability guarantee; deploy or use a production-like Agent Server later when the workflow must survive machine loss and deployment replacement.

## Demo flow

```text
owner connects the household Silpo account once through OAuth 2.1 + PKCE
  → owner loads the latest 10 Silpo in-store receipts into Mem0
  → start one step-order from the chat entry and open its workflow view
  → graph reads relevant Mem0 context
  → keep the initial request in LangGraph state; do not change the Silpo basket
  → owner/admin/editor additions go directly into the shared graph plan
  → viewer/household member addition interrupts for owner/admin approval
  → approve adds it to the plan; decline removes it
  → the MVP defaults to pickup, while delivery and delivery-slot selection are supported
  → owner/admin chooses `Prepare order`
  → graph discovers current Silpo tool schemas, creates or reuses the pickup basket and adds the confirmed products
  → owner/admin chooses `Confirm basket` to add/update the confirmed products, read back the current basket and finish MiyKo's workflow
  → owner/admin may request a replacement, pickup or delivery mode, and a delivery slot
  → graph returns names, quantities, prices, total and checkout link
  → owner finishes checkout in Silpo
```

The chat entry is only a workflow starter. After the first request it routes to the created workflow and does not create another workflow from the same composer; members add, replace and approve requests inside that workflow.

Notifications are outside the current MVP. The pending approval already appears in MiyKo and can be refreshed manually.

## Permissions

- `owner` and `admin`: add requests, approve/decline, prepare or update the provider basket.
- `editor`: add requests directly; provider mutations require owner/admin approval.
- `viewer`: requests require owner/admin approval.

The API supplies the authenticated member ID and role to the graph. Mem0 and client input never grant permissions.

## Silpo boundary

Use only `https://mcp.silpo.ua/mcp`. The graph calls `tools/list`, filters tools by operation and lets the model follow the returned JSON schemas. Initial history import is read-only. Basket preparation and replacement are real MCP writes.

Silpo exposes basket mutation and checkout links but no final place-order tool. `Prepare order` creates or updates the real pickup cart. `Confirm basket` performs the final provider-cart sync, reads it back and completes MiyKo's workflow; it does not place the final provider order. A checkout link is only a readback of the current cart, not an order confirmation. The workflow must not report a completed provider order unless Silpo returns an actual order ID. For the demo, opening the returned checkout link is the final manual step. Pickup uses `SelfPickup` and a future provider-available pickup slot. The initial in-store receipt import reads the active cart and a current available time slot before calling `silpo_get_my_offline_orders`, because that tool requires branch and delivery context.

The MCP agent does not require a second LLM structured-output call. It completes the provider operation conversationally; `runSilpo` projects the latest relevant MCP tool result into the small basket/history view needed by LangGraph and the UI.

OAuth is Authorization Code + PKCE with Dynamic Client Registration. `POST /providers/:providerSlug/oauth/start` returns the provider authorization URL, the public API callback completes the code exchange, and the API stores encrypted credentials behind one household binding. Only the household owner starts this flow. MiyKo login/password remains separate application authentication and is never used as provider credentials.

## Memory boundary

- LangGraph state: active request, household additions, pending request, basket view and current step.
- Mem0 household namespace `household:{householdId}`: reusable order-history summary and household preferences.
- Mem0 member namespace `member:{memberId}`: relevant personal preferences.
- PostgreSQL: no messages, plans, products, basket items or checkpoints.

The owner must preload the `silpo_order_history` memory from provider management before starting the first workflow. The **Personalize from recent receipts** action calls the read-only history tool and creates or refreshes that household memory; no local database marker is needed. Every workflow reads the existing household and member memories during initialization. The graph does not silently fetch history when the memory is missing: initialization stops and asks the owner to preload it. Mem0 is context only; it does not authorize actions or replace graph state.

## Local evidence

The workflow emits JSON logs to stdout for OpenAI classification/model calls, Silpo MCP tool discovery, each actual MCP tool call and the resulting basket/order references, item count, total and checkout availability. It never logs access tokens, prompts or raw tool arguments. The React Native workflow view remains the source for visible basket item names and prices. These logs appear in the local workflow terminal and automatically become `docker logs` if the workflow is containerized later.
