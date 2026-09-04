# App/API notes

The app now uses the thin API control plane and shared `@miyko/contracts` types.

- Onboarding creates a household, then its owner connects the Silpo provider once. Members join the existing household binding and do not reconnect Silpo.
- Text and audio requests create a workflow through `POST /workflows` or `POST /audio/process`.
- The app displays workflow references, last-observed status and pending approval categories; LangGraph Cloud and Silpo MCP own messages, recipes, products, images, basket contents, fulfillment and pause/resume state.
- Owner approval or decline is sent through `POST /workflows/:workflowId/actions`. Replacement, fulfillment and delivery-slot actions use the same endpoint.
- `GET /memory` and `POST /memory` use Mem0 Cloud directly; no local memory table exists.
- `GET /memory/status` returns the managed Mem0 provider status directly.
- Workflow actions include the explicit `approvalId` for approve/decline and the app sends an `Idempotency-Key` for every action request.
- Member changes use the shared `provider_action.intent` field; the app never sends MCP tool names or raw tool arguments.

Not part of the current MVP: background workflow-status synchronization, webhooks, local product/order models and notification scheduling. Those should extend the managed workflow boundary instead of adding local domain tables.

Any future read cache should remain bounded and disposable. It can reduce repeated provider reads but cannot replace provider revalidation before an approved mutation.
