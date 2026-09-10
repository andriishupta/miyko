# MiyKo — household workflows with shared memory

MiyKo is a household control plane around long-running agent workflows. It coordinates members, permissions, approvals and a connected store account without becoming a recipe, product, basket or order database. The same household workflow can also be used by an office team, at a party, on a picnic or during a barbecue trip.

## MVP value

- one household owner connects the Silpo account;
- every member works through the same household connection;
- a text or audio request starts a resumable `step-order` workflow;
- LangGraph keeps the active plan and pauses for later actions;
- Mem0 remembers reusable household and member preferences;
- Silpo MCP owns real products, prices, basket, fulfillment and checkout;
- PostgreSQL stores only identity, permissions, provider binding, workflow references, approvals and outbox delivery state.

## Demo story

```text
coordinator: “Prepare dinner for us”
  → graph imports a summary of the latest 10 Silpo in-store receipts into Mem0 once
  → initial request stays in graph state; the Silpo basket is untouched
partner/editor: “Add beer”
  → request is added directly to the shared plan
child/viewer: “Add ice cream”
  → graph pauses for owner/admin approval
owner/admin approves
  → request joins the plan
owner/admin: “Prepare the basket”
  → graph calls the official Silpo MCP and shows products, prices and total
owner/admin requests a replacement, pickup/delivery mode or delivery slot
  → graph updates the same real basket
owner opens the returned Silpo checkout link and confirms there
```

Notifications are narrated in the hackathon demo but are not implemented in this MVP.

## Boundaries

MiyKo does not store recipes, meal plans, provider products, basket items, receipts or LangGraph checkpoints. Recipes may be generated when a workflow needs them. Provider reads may be cached later, but the provider remains authoritative and every mutation must re-read current state.

Permissions are deny-by-default. The API supplies authenticated household identity and role; Mem0 and the LLM cannot grant access. Owners and admins can approve and mutate the provider basket, editors can add plan requests directly, and viewer requests require approval. The same roles can be used when the household represents an office team, party or temporary group.

For the local demo, `langgraph dev` keeps pause/resume state in its local development storage across requests and ordinary restarts while that storage is preserved. A hosted or production-like Agent Server is needed later for durability across machine loss and deployment replacement. Silpo authentication is OAuth 2.1 Authorization Code + PKCE; MiyKo must never collect the owner's Silpo password.
