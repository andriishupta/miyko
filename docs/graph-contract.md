# MiyKo graph contract

This is the integration contract between the MiyKo API and the deployed LangGraph assistants. The graph owns durable state; the API owns identity, permissions, approval records, outbox delivery and a thin last-observed projection.

## Graphs

| Graph | Purpose | Provider writes |
| --- | --- | --- |
| `workflow` | Primary provider-backed request workflow | Allowed only after owner approval |

The API chooses the assistant/deployment through configuration, not by accepting a graph name from the mobile client.

## Start input

The API sends one start input to the selected assistant:

```ts
type GraphStartInput = {
  operation: "workflow.start";
  workflowId: string;
  householdId: string;
  memberId: string;
  providerSlug?: string;
  source: "text" | "audio";
  eventId: string;
  text: string;
  memory: {
    householdNamespace: string;
    memberNamespace: string;
  };
};
```

`workflowId` is the MiyKo UUID and the LangGraph `thread_id`. `eventId` is the outbox event ID used for run idempotency and tracing. The graph must treat it as a correlation ID, not as user content.
`providerSlug` identifies the provider already connected to the household. The graph must use that household binding and owner-authorized provider access; it must not ask the requesting member for provider credentials.
`memory.householdNamespace` and `memory.memberNamespace` are the managed Mem0 identifiers. Use them for memory reads and writes; do not create a local memory namespace or database record.

## Resume input

Every action resumes the existing thread:

```ts
type GraphResume = {
  eventId: string;
  action:
    | { type: "provider_action"; requestId?: string; intent: string }
    | { type: "fulfillment_selected"; mode: "pickup" | "delivery" }
    | { type: "delivery_slot_selected"; scheduledFrom: string; scheduledTo: string }
    | { type: "approve"; approvalId: string }
    | { type: "decline"; approvalId: string };
};
```

The API validates this input before it reaches LangGraph. The graph must still validate that the action is legal for its current paused state. A client never sends MCP tool names or raw tool arguments.

## Interrupt output

When the graph needs an external decision, emit a JSON-serializable interrupt:

```ts
type GraphInterrupt = {
  action: "provider_action" | "fulfillment" | "delivery_slot";
  externalRequestId?: string;
  reason: string;
  details?: Record<string, unknown>;
};
```

The current API adapter recognizes `action`, `type` or `category` as the action category and `externalRequestId`, `requestId` or interrupt ID as the external request reference. Prefer the canonical `action` and `externalRequestId` fields so the adapter does not need compatibility parsing forever.

The API creates a `workflow_approvals` row from this interrupt. A member request itself is not an approval decision. The owner decision is sent later with the persisted MiyKo `approvalId`.

## Returned reference/projection

After every run, the graph boundary should expose:

```ts
type GraphReference = {
  status: "pending" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  runId: string;
  threadId: string;
  interrupt?: GraphInterrupt;
  providerBasketId?: string | null;
  providerOrderId?: string | null;
  fulfillmentMode?: "pickup" | "delivery" | null;
  scheduledFrom?: string | null;
  scheduledTo?: string | null;
};
```

The API projects these values into `workflows` when the graph returns them, but they remain last-observed values. Current provider basket/order/fulfillment state must be read from Silpo MCP by the graph.

## Node boundaries

Keep the primary graph understandable and mostly linear:

```text
load_request
  → load_memory
  → read_provider_context
  → prepare_request
  → resolve_provider_items
  → choose_replacement_or_fulfillment
  → request_approval (interrupt)
  → apply_provider_action
  → confirm_provider_state
  → learn_from_confirmed_result
  → complete
```

Do not split this into separate meal-plan, product-catalog, order and delivery graphs. Replacement, pickup/delivery and delivery slot are branches in the same workflow.

## Approval rules

- Read-only MCP tools may run before approval.
- Every real basket/order/fulfillment mutation requires an interrupt and owner approval.
- `approve` resumes only the matching pending interrupt.
- `decline` must not call a write tool.
- The graph must re-read provider state after a long pause and before a write.
- An approval stored by MiyKo is authorization metadata, not the provider's order status.

## Mem0 contract

Use managed Mem0 entities:

```text
household:<householdId>
member:<memberId>
```

Read relevant memories near the beginning of the workflow. Write only confirmed durable preferences or post-purchase feedback near the end. Include `workflowId` and `eventId` metadata for deduplication. Never use Mem0 to decide household membership, role, owner approval or provider credentials.

Recommended memory record shape:

```json
{
  "fact": "The household prefers dessert for weekend dinners",
  "scope": "household",
  "source": "confirmed_feedback",
  "workflowId": "<workflow-id>",
  "eventId": "<event-id>"
}
```

## Status semantics

The API maps managed graph responses into its status enum:

```text
success → succeeded
error/timeout → failed
interrupted → interrupted
pending/running/succeeded/failed/cancelled → unchanged
```

An interrupted workflow is not failed. It is waiting for the next household action. A failed MCP call should remain retryable through the MiyKo outbox unless the graph has explicitly reached a terminal failure.

## Current MiyKo integration points

The API adapter currently:

- creates/reuses a thread using the MiyKo workflow UUID;
- starts a run with `workflow.start` input;
- resumes using a LangGraph command containing the action;
- uses `eventId` metadata to avoid duplicate runs;
- observes the run/thread and parses an interrupt;
- updates the thin workflow projection and approval metadata.

When the deployed graph is available, the remaining adapter alignment is limited to the actual deployed interrupt/result field names and provider reference mapping. Do not add local graph state to close that gap.

## Versioning rule

Treat state keys, node names and interrupt shapes as a compatibility surface. Existing paused threads must be able to resume after a deployment revision. Add optional fields before making a field required; keep old interrupt shapes readable during the MVP migration window.

## Official references

- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph interrupts and `Command(resume=...)`](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph threads](https://docs.langchain.com/langsmith/use-threads)
- [LangGraph JavaScript SDK](https://reference.langchain.com/javascript/langchain-langgraph-sdk)
- [Mem0 add memory](https://docs.mem0.ai/core-concepts/memory-operations/add)
- [Mem0 search memories](https://docs.mem0.ai/api-reference/memory/search-memories)
