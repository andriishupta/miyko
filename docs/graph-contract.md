# MiyKo graph contract

## Registry

| Workflow kind / graph slug | Purpose |
| --- | --- |
| `step-order` | Multi-member household plan that becomes a real provider basket |

The slug is code, not an environment variable. Add future workflows to the shared contract enum and API registry.

## Start input

```ts
type StepOrderInput = {
  operation: "workflow.start";
  workflowId: string;
  workflowKind: "step-order";
  householdId: string;
  memberId: string;
  memberRole: "owner" | "admin" | "editor" | "viewer";
  text: string;
  providerSlug: string;
  source: "text" | "audio";
  eventId: string;
  memory: { householdNamespace: string; memberNamespace: string };
};
```

`workflowId` is also the LangGraph `thread_id`. The API creates it before publishing `workflow.started`.

## Runtime context

Every start and resume includes `{ providerAccessToken: string }` as LangGraph runtime context. The API resolves it from the active household binding immediately before creating the run. It is deliberately absent from start input, thread metadata, graph state, Mem0 and public contracts.

## Resume input

The graph waits with a non-approval `workflow_action` interrupt. The API resumes the same thread with trusted actor data:

```ts
type ResumeInput = {
  eventId: string;
  actor: { memberId: string; role: "owner" | "admin" | "editor" | "viewer" };
  action:
    | { type: "provider_action"; requestId?: string; intent: string }
    | { type: "fulfillment_selected"; mode: "pickup" | "delivery" }
    | { type: "delivery_slot_selected"; scheduledFrom: string; scheduledTo: string }
    | { type: "approve"; approvalId: string }
    | { type: "decline"; approvalId: string };
};
```

Natural-language `provider_action` is classified as `add_request`, `prepare_basket`, `replace_product` or `checkout`. `checkout` reads the current basket and returns Silpo checkout links; it does not invent a place-order operation.

## Approval interrupt

```ts
type ApprovalInterrupt = {
  action: "provider_action" | "fulfillment" | "delivery_slot";
  requestId: string;
  summary: string;
};
```

The API projects this interrupt into `workflow_approvals`. A routine `workflow_action` interrupt only means the graph is waiting and does not create an approval.

## Projection

The graph may return `providerBasketId`, `providerOrderId`, `fulfillmentMode`, `scheduledFrom` and `scheduledTo`. MiyKo stores only those thin references. Product rows, prices, totals and checkout links remain graph/provider state and must be exposed through a sanitized live graph-state read rather than copied into PostgreSQL.

## Idempotency and safety

- Every API action has an outbox event ID and idempotency key.
- The worker reuses the workflow UUID as the thread ID and does not create duplicate threads.
- The graph performs MCP writes only after role authorization or a resumed owner/admin approval.
- Provider credentials are supplied per run as runtime context and are never returned in graph output.
- Side effects happen after interrupts because LangGraph restarts an interrupted node on resume.
- Mem0 namespaces are context boundaries, not security boundaries.
