# AGENTS.md

## Project purpose

MiyKo is a mobile household food agent. It remembers food intentions, preferences, restrictions, previous purchases and feedback; coordinates household members; proposes grocery baskets; and updates a real Silpo basket only after explicit owner approval.

The product is a hackathon prototype. Prefer a small, understandable implementation that demonstrates one complete food loop over broad infrastructure or premature abstractions.

## Product boundaries

- Mobile client: Expo / React Native with TypeScript.
- API: Hono / TypeScript.
- Agent workflow: LangGraph.js.
- Database: PostgreSQL with Row-Level Security (RLS).
- Long-term memory: Mem0, never the source of truth for authorization or permissions.
- Shopping integration: official Silpo MCP.
- Notifications: Expo Notifications and a server-side scheduler.
- No Docker Compose is required for the current development workflow.
- Never place Silpo credentials, OAuth tokens, database secrets or model keys in the mobile app.

## How to work in this repository

1. Read `README.md`, `docs/idea.md` and `docs/prd.md` before making architectural changes.
2. Keep changes focused on the requested outcome. Do not create extra applications, services or abstractions without a concrete use case.
3. Follow an Agile loop: define a small vertical slice, implement it, let the owner run the requested manual verification, collect feedback, then refine.
4. Keep product decisions and security assumptions documented when they affect multiple applications.
5. Do not run tests, builds, formatters or other checks automatically unless the user asks for them. When useful, provide the exact command for the user to run.
6. Do not silently change product scope, authentication behavior, database tenancy rules or external integration behavior.
7. Preserve unrelated user changes. Avoid destructive Git or filesystem operations.

## Suggested repository shape

```text
apps/
  mobile/          # Expo / React Native application
  api/             # Hono API, agent workflow and scheduler
packages/
  contracts/       # Shared Zod schemas and API types
  config/          # Shared TypeScript and tooling configuration
docs/              # Product and architecture documentation
```

Keep the agent runner, MCP client and scheduler inside the API application until the prototype proves that a separate service is necessary.

## Security rules

Security is deny-by-default and enforced on the server.

- Only the health endpoint may be unauthenticated. Every other API route requires a valid MiyKo session or access token.
- Authenticate the user before loading any tenant data. Do not rely on a client-provided `user_id`, `household_id`, role or permission.
- Authorize every request against current household membership and role. Authentication alone is not authorization.
- Apply authorization again inside service methods for sensitive reads and every mutation; route middleware is not the only security boundary.
- Validate all request bodies, query parameters and external tool responses with Zod or an equivalent strict schema.
- Reject unknown or unsafe input where practical. Use explicit allowlists for actions, roles, status transitions and MCP operations.
- Require explicit owner approval before any operation that changes a real Silpo basket. Proposal creation and read-only product searches may happen before approval.
- Keep OAuth access and refresh tokens server-side, encrypted at rest, scoped to the connected household member and never returned to Expo.
- Store only the minimum receipt and preference data needed for the product. Do not put secrets or raw sensitive payloads into Mem0, logs or error messages.
- Redact tokens, authorization headers, private personal data and full receipt payloads from logs and traces.
- Use short, generic error responses at the API boundary. Keep internal details in protected server logs.
- Configure CORS for known development or production origins. Do not use an unrestricted production wildcard.
- Protect mutations against replay and accidental duplication where the operation can affect a real basket.

## Multi-tenant data isolation

The tenant boundary is the household. A user may belong to more than one household, so `user_id` alone is never sufficient to authorize a household resource.

- Every household-owned table must carry a non-null `household_id` or be reachable through a relation that is unambiguously scoped to one.
- PostgreSQL RLS is mandatory for tenant-owned data. Policies must verify the authenticated application identity and household membership.
- Application queries must include the household scope even when RLS exists. RLS is a safety net, not a reason to omit explicit scoping.
- Set database request context from trusted server authentication inside a transaction. Never accept arbitrary tenant context from the mobile client.
- Keep migrations, narrowly controlled service operations and administrative tooling separate from normal user requests. Any RLS bypass must be deliberate, audited and never exposed as a user endpoint.
- Test or manually verify cross-household access denial for reads, updates, deletes, invitations, plans, receipts and connected Silpo accounts before calling a tenancy feature complete.
- Do not expose sequential identifiers as the only protection. Use authorization checks regardless of whether IDs are UUIDs.

## Memory isolation

Mem0 is long-term context, not an authorization database.

- Shared memories use a household-scoped namespace.
- Personal memories use a member-scoped namespace and may be retrieved only for an authorized member or an authorized household workflow.
- Planning-session memories use a run-scoped namespace and must not become shared household memory without an explicit server-side decision.
- Every retrieval and write must carry the authorized `household_id`; never search global memory for convenience.
- Never use Mem0 to decide whether a user can access a household, approve a basket or perform an MCP mutation.
- Minimize sensitive data sent to Mem0 and make important inferred restrictions editable or confirmable by the user.

## API conventions

- Keep endpoints small, explicit and resource-oriented.
- Use a consistent response and error shape.
- Separate authentication, authorization, validation, domain logic and external integrations.
- Treat external MCP responses as untrusted input and revalidate product IDs, prices, quantities and basket state before mutations.
- Read operations may run automatically. Real basket mutations require a fresh, server-validated owner approval for the intended proposal.
- Do not add debug, impersonation or unauthenticated data endpoints to make local development easier.
- Health checks may report process/dependency availability only; they must not expose secrets, user data or detailed infrastructure configuration.

## Expo / mobile conventions

- Keep the mobile app simple: screens, navigation, API client, auth state and user-facing error/loading states should be easy to follow.
- The mobile app is an untrusted client. It must not contain authorization decisions, Silpo tokens, database credentials or agent secrets.
- Do not hardcode `localhost` for a physical phone. During local testing, the phone and development machine normally need to be on the same Wi-Fi, and the API must be reachable through the machine's LAN address.
- Bind the local API to a deliberate development interface and avoid exposing it to the public internet. Use a temporary HTTPS tunnel only when OAuth callbacks or remote access require it.
- Keep permission-sensitive actions visually explicit: proposal, edit, owner approval and basket update are different states.
- Never claim that food has definitely run out when the system only has an estimate; phrase follow-up notifications as questions.

## Database and domain rules

- PostgreSQL is the source of truth for users, households, memberships, invitations, connected accounts, planning sessions, approvals and notification jobs.
- Use explicit state transitions for proposals, approvals and basket updates. Do not infer authorization from a status stored only on the client.
- Use transactions for approval plus the corresponding basket mutation metadata.
- Store timestamps in UTC and keep estimated consumption separate from observed feedback.
- Avoid exact pantry-inventory claims unless the user confirms them.

## Definition of done for a feature

A feature is ready for owner verification when:

- its tenant and role boundaries are explicit;
- unauthenticated access is rejected except for health;
- inputs and external responses are validated;
- secrets and sensitive data stay server-side;
- the mobile flow clearly represents loading, failure and approval states;
- the owner has a simple manual verification command or flow to run when needed.

