# MiyKo architecture

The deployed graph setup and API payload contract are documented in [graph.md](graph.md) and [graph-contract.md](graph-contract.md).

## Ownership rule

MiyKo is a household control plane around managed agent workflows. It does not become a recipe database, product catalog or order-management system.

| Concern | Owner |
| --- | --- |
| Authentication, household membership and roles | MiyKo API + PostgreSQL |
| Provider account connection and encrypted credentials | MiyKo API + PostgreSQL |
| Workflow state, messages, recipe generation, basket and pause/resume | LangGraph Cloud |
| Long-term household/member memory | Mem0 Cloud |
| Products, images, basket mutation, fulfillment and order details | Silpo MCP/provider |
| Retryable delivery of API side effects | MiyKo outbox worker |

PostgreSQL stores only a small control-plane projection: the household, provider binding, deterministic workflow/thread ID, last observed run/status, external basket/order IDs and approval decisions. The projection is not the source of truth for provider or workflow state; LangGraph Cloud and the provider are.

## High-level flow

```text
login/register
  → create or join household
  → connect and bind a store provider
  → create one workflow for the request
  → LangGraph uses Mem0 context and reads current Silpo MCP state
  → graph pauses for a replacement, fulfillment mode, delivery slot or provider action
  → household member requests approval
  → owner approves or declines
  → same LangGraph thread resumes
  → only then does MCP mutate the basket or finish the order
```

The initial request is a normal workflow input. “Add ice cream” is a workflow action, not a local product search. The graph/provider resolves the item and returns the current basket. MiyKo only records that an approval was requested and whether the owner approved it.

A member action is not itself an approval decision. The API forwards the action to the same LangGraph thread; an approval projection is created only when LangGraph returns an interrupt that requires household approval.

## Projection and cache boundary

The API may expose a last-observed projection for fast household screens and may use a short-lived cache for repeated provider reads. Neither becomes a second product, basket or order store. Cached/projection data can be stale and is never used to authorize or execute a provider mutation. The managed workflow re-reads and validates the current MCP/provider state before changing a basket or completing an order.

## API boundaries

The API has five responsibilities:

1. validate the request and authenticate the user;
2. enforce household membership and role permissions;
3. create a deterministic workflow reference;
4. record approval/decline decisions, update the thin projection and enqueue actions;
5. retry delivery of those actions to LangGraph Cloud.

The API does not interpret recipes, normalize provider products, maintain meal plans, copy basket items, import receipts or treat its projection/cache as external truth. Future webhooks/status reads may refresh the thin projection, but that is not part of the MVP.

## Provider boundary

`StoreProvider` is intentionally small: authentication, reauthorization and tool discovery. `StoreProviderService` owns provider lookup, user account persistence, encrypted secrets and household binding. Product search, basket updates and fulfillment are MCP tools invoked from the managed workflow after authorization; they are not API-owned catalog methods.

The provider registry remains useful because it resolves provider-specific authentication/MCP wiring by slug. Adding another store should not change household, workflow or approval tables.

## Durable workflow boundary

`workflows.id` is generated before the first outbox event and is reused as the LangGraph `thread_id`. The API stores `run_id` and the latest status returned after start/resume. `workflow_approvals` stores only:

- which workflow requested an action;
- the external request ID, if the graph supplied one;
- the action category;
- the decision and deciding member.

The outbox is a retry transport, not durable workflow state. The API worker claims events oldest-first through the scoped database claim function, then opens a transaction-local RLS context for the active household member. Events use a lease and capped backoff; a failed provider/graph call remains retryable and never creates a local copy of the external basket. Any local status is only the last observed result.

## Memory boundary

Mem0 Cloud is the long-term memory provider. Namespaces are `household:{householdId}` and `member:{memberId}`. Memory is useful context only; it cannot authenticate, authorize, select a household or approve a provider action.

## Database shape

The baseline contains only:

- `users`, `user_sessions`;
- `households`, `household_members`, `household_invitations`;
- `providers`, `user_providers`, `provider_secrets`, `connected_provider_accounts`, `household_provider_settings`;
- `workflows`, `workflow_approvals`, `outbox_events`, `audit_logs`.

The removed tables are intentional: `food_intents`, `planning_runs`, `meal_plans`, `meal_plan_items`, `provider_products`, product replacements, local proposals/items, local orders/items, deliveries, feedback and provider/memory sync records.
