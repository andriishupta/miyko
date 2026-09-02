# MiyKo primary LangGraph workflow

Status: primary production graph for the MVP.

This graph is deployed to LangSmith/LangGraph Cloud. MiyKo API creates the household workflow reference, starts a thread, forwards actions and stores only the last-observed projection. The graph owns the long-running state, checkpoints, conversation, recipe generation, MCP calls and pause/resume.

## Deployment target

Create a separate LangGraph application for the graph. It can live in its own repository or directory; it must not add a checkpointer or workflow-state tables to MiyKo PostgreSQL.

The deployment must expose one primary graph, for example:

```text
workflow
```

The deployed assistant/graph ID is configured in the API as `LANGGRAPH_ASSISTANT_ID`. The API also needs:

```text
LANGGRAPH_API_URL
LANGGRAPH_ASSISTANT_ID
LANGGRAPH_API_KEY
```

The deployment operator may use LangSmith deployment credentials separately. Never put LangSmith, LangGraph or Mem0 secrets in the Expo app.

## Deployment steps

1. Create the LangSmith Cloud workspace and deployment.
2. Create a LangGraph app with a `langgraph.json` configuration that registers `workflow` and points to the compiled graph entry point.
3. Add the graph runtime dependencies: LangGraph, LangChain model integration, MCP adapter and Mem0 client.
4. Configure deployment secrets:
   - the model/provider key used by the graph;
   - Silpo MCP endpoint and authentication configuration;
   - `MEM0_API_KEY`;
   - LangSmith tracing configuration and project name.
5. Deploy from the LangSmith UI/GitHub integration or with `langgraph deploy`.
6. Copy the deployment URL and assistant ID into the API environment as `LANGGRAPH_API_URL` and `LANGGRAPH_ASSISTANT_ID`.
7. Keep the API's `LANGGRAPH_API_KEY` server-side. The mobile app calls MiyKo API, never LangGraph directly.

LangGraph Cloud/Agent Server provides the persistence required for interrupts and long-running threads. The graph must be invoked with a stable thread ID; MiyKo uses its workflow UUID as that ID.

## Graph state

Keep the graph state small and JSON-serializable. It is durable LangGraph state, not a PostgreSQL model.

```text
workflowId
householdId
memberId
providerSlug
source
conversation/messages
request
recipeDraft
providerContext
fulfillmentChoice
deliverySlot
pendingApproval
providerBasketId
providerOrderId
status
```

Do not store provider credentials, raw access tokens or unnecessary personal data in state. Do not put a full local product catalog or a copied basket in state; keep only the current data needed for the active run and references returned by MCP.

## Primary workflow

```text
workflow.start
  → validate request and household/provider context
  → retrieve relevant Mem0 context
  → read Silpo MCP history and current basket
  → generate recipe/meal suggestion with the LLM
  → resolve required products through Silpo MCP
  → handle replacement and fulfillment choices
  → interrupt before every provider mutation
  → owner approve/decline
  → resume the same thread
  → re-read current MCP state
  → update basket or complete order through MCP
  → read the resulting provider references/status
  → write confirmed learning to Mem0
  → return final projection
```

### 1. Start

The API starts the graph with an input equivalent to:

```json
{
  "operation": "workflow.start",
  "workflowId": "<miyko-workflow-uuid>",
  "householdId": "<household-uuid>",
  "memberId": "<requesting-member-uuid>",
  "providerSlug": "silpo",
  "source": "text",
  "eventId": "<outbox-event-uuid>",
  "text": "Dinner for two tonight with a dessert"
}
```

The graph must not create a new thread for a retry. It must use the existing thread ID supplied by the API and make start side effects idempotent by `eventId`.

### 2. Read context

Retrieve household/member preferences from Mem0 once at the planning stage. Read provider history, current basket, availability and fulfillment options from Silpo MCP. These reads may be cached later, but the graph must revalidate current provider state immediately before a mutation.

### 3. Recipe and products

The LLM or Silpo assistant may generate a recipe. Product search, product details, images, replacements and basket contents come from Silpo MCP. The graph may present a proposed result, but MiyKo does not persist a recipe, product row or basket item.

### 4. Interrupts

Use a dynamic LangGraph `interrupt()` for human decisions. The interrupt value must be JSON-serializable and contain enough safe information for MiyKo to create an approval projection:

```json
{
  "action": "provider_action",
  "externalRequestId": "<stable-graph-request-id>",
  "reason": "Add the requested dessert to the provider basket",
  "details": {
    "summary": "Add ice cream",
    "mutation": "basket_update"
  }
}
```

Supported `action` categories are `provider_action`, `fulfillment` and `delivery_slot`.

Never call an MCP mutation before the relevant approval interrupt. Read-only MCP calls may happen before the interrupt.

### 5. Resume

The API resumes the same thread with a command equivalent to:

```json
{
  "resume": {
    "eventId": "<outbox-event-uuid>",
    "action": {
      "type": "approve",
      "approvalId": "<miyko-approval-uuid>"
    }
  }
}
```

The graph must validate that the resume action matches the currently pending interrupt. `approvalId` is MiyKo's authorization reference; it is not a replacement for the graph interrupt/request ID. A decline must route to a safe terminal or waiting state without calling a mutating tool.

### 6. Provider mutation and final state

After approval, re-read the current basket, product availability and fulfillment state through MCP. Then perform the approved MCP action. If the provider changes the basket or order while the workflow was paused, recalculate or ask for a new approval instead of applying stale assumptions.

Return a structured result containing, when available:

```json
{
  "status": "succeeded",
  "providerBasketId": "<provider-basket-id>",
  "providerOrderId": "<provider-order-id>",
  "fulfillmentMode": "pickup",
  "scheduledFrom": null,
  "scheduledTo": null
}
```

The API may project these references/statuses into `workflows`. The provider remains the source of truth for basket, fulfillment and order details.

## Mem0: how the graph learns

Mem0 Cloud is long-term memory, not graph checkpoint state and not authorization storage.

Use stable entity IDs:

```text
household:<householdId>
member:<memberId>
```

Retrieve memory by the relevant household/member entity filter. Save only useful, durable facts:

- confirmed likes, dislikes and dietary restrictions;
- household portions and shopping cadence;
- explicit replacement preferences;
- confirmed feedback after a completed basket/order;
- recurring meal preferences stated by a member.

Do not save every message, full MCP responses, access tokens, credentials, raw basket snapshots or unconfirmed guesses. A child request such as “add ice cream” is workflow context; it is not automatically a long-term preference.

Write memory only after a confirmed user statement, owner-approved action or completed feedback step. Include `workflowId`/`eventId` metadata so a retried LangGraph node does not create duplicate learning. Put external writes in an idempotent task/node because a resumed graph may re-execute code before an interrupt.

The graph may use the Mem0 SDK or REST API. The deployment secret stays in LangGraph Cloud. The existing MiyKo `/memory` API remains a controlled household/member access surface; it does not replace graph memory or store records in PostgreSQL.

## MCP tool policy

Group Silpo MCP tools into:

```text
read: history, profile, product search/details, availability, basket, fulfillment slots
write: add/remove/update basket, submit/confirm order, change delivery/fulfillment
```

The graph may call `read` tools automatically. Every `write` tool must be behind the approval interrupt, and the tool call must be generated/validated by the graph rather than accepted as an arbitrary client command.

## LangSmith tracing

Trace every workflow using the MiyKo workflow UUID as the thread/session metadata. Add safe metadata such as `workflowId`, `householdId`, `providerSlug` and `source`; never log provider credentials or sensitive raw payloads. Use LangSmith traces to inspect the node where the graph paused and the MCP call that followed approval.

## Compatibility rule

Paused threads depend on the deployed graph's state keys and node boundaries. Do not rename/remove nodes or make previously optional state required while paused MVP threads exist. Deploy graph revisions deliberately and inspect paused threads in LangSmith before changing the workflow shape.

## Official references

- [Deploy on LangSmith Cloud](https://docs.langchain.com/langsmith/deploy-to-cloud)
- [Application structure and `langgraph.json`](https://docs.langchain.com/langsmith/application-structure)
- [LangGraph persistence and threads](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph interrupts and resume](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangChain MCP tools](https://docs.langchain.com/oss/python/langchain/mcp)
- [Mem0 Platform overview](https://docs.mem0.ai/platform/overview)
- [Mem0 add memory](https://docs.mem0.ai/core-concepts/memory-operations/add)
- [Mem0 search memories](https://docs.mem0.ai/api-reference/memory/search-memories)
