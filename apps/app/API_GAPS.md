# App/API notes

The app now uses the thin API control plane and shared `@miyko/contracts` types.

- Onboarding creates or joins a household, then connects and binds the Silpo provider.
- Text and audio requests create a workflow through `POST /workflows` or `POST /audio/process`.
- The app displays workflow references, last-observed status and pending approval categories; LangGraph Cloud and Silpo MCP own messages, recipes, products, images, basket contents, fulfillment and pause/resume state.
- Owner approval or decline is sent through `POST /workflows/:workflowId/actions`. Replacement, fulfillment and delivery-slot actions use the same endpoint.
- `GET /memory` and `POST /memory` use Mem0 Cloud directly; no local memory table exists.

Not part of the current MVP: background workflow-status synchronization, webhooks, local product/order models and notification scheduling. Those should extend the managed workflow boundary instead of adding local domain tables.

Any future read cache should remain bounded and disposable. It can reduce repeated provider reads but cannot replace provider revalidation before an approved mutation.
