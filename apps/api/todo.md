# TODO

## API scaffold principles

- [x] Use the existing Drizzle database for relational API resources; keep only external integrations mock-backed.
- [x] Organize the API by feature rather than by technical layer alone.
- [x] Keep route handlers thin; place business logic in feature services and integration logic in dedicated clients.
- [x] Keep authentication, authorization, validation, error handling and observability as shared infrastructure.
- [x] Keep registration available so a user can exist before choosing `Create household` or `Join household` during onboarding.
- [x] Add clear mock adapters so real database and external integrations can replace them without changing route contracts.

## Suggested feature-based structure

- [x] Create feature directories for authentication, dashboard, products, deliveries/orders, household management, providers, settings, audio and memory/feedback.
- [x] Create shared `middleware` and `lib` areas for security, request context, configuration, logging, errors and clients.
- [x] Keep each feature close to its route, schema, service, mock data and types.

Example target structure:

```text
src/
  app.ts
  server.ts
  middleware/
    auth.ts
    security.ts
    request-context.ts
    error-handler.ts
  features/
    auth/
      auth.routes.ts
      auth.service.ts
      auth.schemas.ts
    dashboard/
      dashboard.routes.ts
      dashboard.service.ts
      dashboard.schemas.ts
    products/
    deliveries/
    households/
    settings/
    audio/
    memory/
  integrations/
    mcp/
      mcp.client.ts
      mcp.config.ts
      mcp.mock.ts
  lib/
    config.ts
    logger.ts
    errors.ts
```

## Security and middleware

- [ ] Add a security middleware layer to every request.
- [ ] Add secure HTTP headers with a Hono-compatible Helmet implementation or an equivalent maintained middleware.
- [ ] Configure CORS with an explicit allowlist for the local Expo app and known production origins.
- [ ] Do not allow `*` origins with credentials.
- [x] Add authentication middleware to every route except explicitly documented auth bootstrap routes and health.
- [ ] Add authorization checks after authentication for every household-scoped resource.
- [ ] Build trusted request context from the authenticated user and selected household; never trust client-provided roles or tenant identity.
- [ ] Add request ID and structured logging middleware.
- [ ] Redact access tokens, cookies, OAuth credentials, audio payloads and receipt data from logs.
- [ ] Add consistent error handling without exposing stack traces or infrastructure details.
- [ ] Validate body, query, params and headers with Zod schemas.
- [ ] Add request size limits, especially for audio and file-related endpoints.
- [ ] Add rate limiting for authentication, audio processing and expensive agent operations.
- [ ] Add timeout and cancellation handling for external MCP and model calls.
- [ ] Add replay/idempotency protection for order creation, approval and basket mutations.
- [ ] Keep secrets in server environment configuration only.
- [ ] Add a public health endpoint that exposes availability only and no secrets or tenant data.
- [ ] Ensure every non-health endpoint returns unauthorized when authentication is missing or invalid.

## Authentication

- [ ] Add a login route for existing users.
- [x] Keep account creation separate from household onboarding.
- [ ] Add session or access-token validation middleware.
- [ ] Add a controlled user-seeding script for development and demo users.
- [ ] Add logout/session-revocation behavior when the authentication approach is selected.
- [x] Add role and household membership checks for owner, admin, editor and viewer permissions.
- [ ] Ensure login responses never include Silpo OAuth tokens or internal credentials.

## Dashboard API

- [ ] Add an authenticated dashboard route consumed by the Home screen.
- [ ] Return mock upcoming food events such as breakfast and dinner.
- [ ] Return mock calendar/planning data.
- [ ] Return linked or standalone mock deliveries.
- [ ] Return the latest household summary and useful Home screen information.
- [ ] Return the current audio/chat entry state if needed by the mobile scaffold.
- [ ] Keep the dashboard response stable and shaped for the mobile screen rather than exposing unrelated database tables.

## Products API

- [ ] Add an authenticated product search route.
- [ ] Add product details and replacement routes.
- [ ] Validate product IDs, quantities, prices and availability returned by the MCP adapter.
- [ ] Use mock products until the real Silpo MCP client is enabled.
- [ ] Keep product routes read-only unless an explicit basket mutation route is used.

## Deliveries and orders API

- [ ] Add an authenticated route for the latest orders/deliveries.
- [ ] Add an authenticated route for all deliveries.
- [ ] Add an authenticated route for delivery details, including products and linked meal/event.
- [ ] Add an authenticated route for creating an order or basket proposal.
- [ ] Distinguish a proposed order from a real Silpo basket mutation.
- [ ] Add order review/status routes before approval.
- [ ] Add owner-only approve and decline routes.
- [ ] Add routes for editing, replacing and removing proposed items.
- [ ] Require a fresh server-side owner authorization check before any real basket update.
- [ ] Add idempotency keys and explicit state transitions for create, review, approve, decline and update operations.
- [x] Read order and delivery responses from the existing Drizzle database; keep only the external basket adapter mocked.

## Household and settings API

- [ ] Add authenticated household summary and member list routes.
- [x] Add owner/admin/editor/viewer permission handling.
- [x] Add an authenticated invite-member route.
- [ ] Add invite status and acceptance behavior when authentication is available.
- [ ] Add a settings route for the current user and household.
- [x] Keep household data on the existing PostgreSQL schema; settings remain process-local until a settings table exists.

## Audio processing API

- [ ] Add an authenticated audio-processing route for the future Record Audio action.
- [ ] Run the full authentication, authorization, validation, rate-limit and request-size middleware chain before processing audio.
- [ ] Support a mock audio response without storing or sending real audio externally.
- [ ] Define the future transcription, intent extraction and response-processing contract.
- [ ] Return a planning intent or chat response in a mobile-friendly shape.
- [ ] Add explicit handling for unsupported audio format, duration and size.
- [ ] Do not log raw audio or sensitive transcriptions.
- [ ] Add timeout and failure states for future speech-to-text/model providers.

## MCP client scaffold

- [x] Create an MCP client interface without connecting to the real Silpo MCP server.
- [x] Create a mock MCP client implementing product search, product details, replacements, order history, basket read and basket update contracts.
- [ ] Create a separate MCP configuration file for server URL, transport and feature flags.
- [x] Keep MCP credentials and OAuth handling server-side.
- [ ] Add a discovery step based on `tools/list` before implementing real tool calls.
- [x] Validate every MCP request and response at the integration boundary.
- [x] Separate read-only MCP operations from basket-changing operations.
- [x] Require owner approval in the API before calling any basket-changing MCP operation.
- [x] Add MCP timeout, retry, error mapping and audit logging rules.
- [x] Add a generic store-provider port, registry, Silpo adapter, provider login and reauthorization endpoints.
- [ ] Make it possible to switch between mock and real MCP clients through server configuration, not mobile input.

## Memory and feedback

- [ ] Add mock memory read and write services for the initial scaffold.
- [ ] Scope shared memory by `household_id`.
- [ ] Scope personal memory by `member_id`.
- [ ] Scope temporary planning memory by `run_id`.
- [ ] Never use memory retrieval as an authentication or authorization decision.
- [ ] Add a memory creation/update flow after an order, audio response or feedback event is processed.
- [ ] Keep important inferred restrictions confirmable and editable.
- [ ] Minimize sensitive receipt and audio data sent to a future Mem0 integration.

## Outbox and asynchronous processing

- [ ] Design an outbox event model for durable post-processing.
- [ ] Create outbox events when an order, feedback entry or relevant planning result is committed.
- [ ] Process outbox events asynchronously to update long-term memory and schedule follow-ups.
- [ ] Make outbox handlers idempotent and retryable.
- [ ] Record processing status, attempts, last error and processed timestamp.
- [ ] Ensure an outbox event cannot cross household boundaries.
- [ ] Keep the initial outbox implementation mock/in-memory or adapter-based until the real database exists.

## Database assumptions for later implementation

- [ ] Use PostgreSQL as the source of truth for users, households, memberships, invitations, sessions, proposals, approvals, orders, deliveries, notifications and outbox events.
- [ ] Require `household_id` on household-owned records.
- [ ] Enable PostgreSQL RLS for all tenant-owned tables.
- [ ] Apply explicit household scoping in services in addition to RLS.
- [ ] Set trusted database request context from server authentication inside a transaction.
- [ ] Never use client-provided household IDs as the only authorization mechanism.
- [ ] Keep Mem0 as a context store, not a permissions or transaction database.

## Mock versus real assumptions

### Mock in the scaffold

- [ ] Authentication responses and seeded user identities.
- [ ] Dashboard, event, household, member, settings, product, delivery and order data.
- [ ] Audio upload/transcription/intent extraction response.
- [ ] MCP discovery and tool responses.
- [ ] Memory retrieval and memory writes.
- [ ] Outbox persistence and asynchronous workers.
- [ ] Notifications and scheduled follow-ups.

### Real later

- [ ] MiyKo authentication and session storage.
- [ ] PostgreSQL with RLS and migrations.
- [ ] Silpo OAuth and official MCP connection.
- [ ] Real product search, order history and basket updates.
- [ ] LangGraph checkpoints and workflow resume.
- [ ] Mem0 Cloud memory operations.
- [ ] Speech-to-text and agent response processing.
- [ ] Durable outbox processing and notification scheduling.

## Completion criteria for the API scaffold

- [ ] The feature-based folders and route/service/schema boundaries exist.
- [ ] All non-health routes are protected by the planned middleware chain.
- [ ] Routes return mock data with stable contracts for the mobile scaffold.
- [ ] Order approval and MCP mutation boundaries are represented explicitly.
- [ ] Audio processing passes through the same security boundary as other protected routes.
- [ ] Memory and outbox responsibilities are documented without requiring a real database.
- [ ] The scaffold can later replace each mock adapter with a real implementation without changing mobile-facing route contracts.
