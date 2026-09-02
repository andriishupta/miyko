# MiyKo Architecture

This document describes the intended application flow and the current implementation flow. Product requirements remain in `docs/prd.md`; this document explains how the system is structured and how data moves through it.

## Architectural principles

- The mobile app is an untrusted client.
- The API is the trusted application boundary.
- PostgreSQL is the source of truth for identity, permissions and business records.
- Household is the tenant boundary when data is shared by multiple users.
- Mem0 is long-term context, never an authorization source of truth.
- Store and delivery providers are external integrations, never the source of truth for MiyKo's local history.
- Silpo MCP is the first supported store provider, not a product-wide dependency in the core domain.
- Mock and real integrations are selected explicitly; failures must not silently switch modes.
- Real shopping basket mutations require explicit owner approval.

## Desired system shape

```text
Expo / React Native
  ├── authentication and session state
  ├── Home, household and delivery screens
  ├── audio/chat input
  └── API client
          │
          ▼
Hono API
  ├── security middleware
  ├── authentication and authorization
  ├── feature routes and services
  ├── Agent Layer / LangGraph runner
  ├── outbox and notification scheduling
  └── server-side integrations
       ├── Drizzle → PostgreSQL + RLS
       ├── Mem0 adapter
       └── Store provider adapters
            └── Silpo MCP adapter (first provider)
```

The initial deployment can keep the Agent Layer, MCP adapter and scheduler inside the API application. They should be split into separate services only when a real operational need appears.

## Store provider abstraction

MiyKo is store-provider agnostic. Silpo is the first provider implementation, while the domain model, planning flow, memory and household features must not depend directly on Silpo-specific concepts.

Use a provider port with separate adapters, sometimes described as a ports-and-adapters or capability-based strategy. The core API calls normalized provider capabilities such as:

- connect or sign in to a provider account;
- read receipts and purchase history;
- search products and replacements;
- create or update a basket or order;
- read delivery or fulfillment information.

Not every provider supports every capability. A provider declares its supported capabilities, and an unavailable operation returns an explicit unsupported result. The system must never pretend that a provider completed an operation and must not silently fall back to another provider.

Provider accounts and provider references are stored locally and linked to the authorized user or household. Local orders, deliveries and synchronization records remain MiyKo's source of truth for application state, even when their external references come from a provider.

### Provider data model

The database uses one generic `providers` catalog for stores and delivery services. Each provider has an active/inactive status, a provider kind and a capability list, so Silpo, ATB, Epicentr, Bolt and Uber can be added without changing the core tables.

`user_providers` is the user-level many-to-many connection between a MiyKo user and a provider. It stores the provider subject, login identifier, authentication method, scopes and token/credential references. Raw provider passwords, OAuth tokens and MCP secrets are kept in server-side secret storage and are never exposed through contracts or mobile responses. `connected_provider_accounts` is only the household binding created after a member authorizes a user provider account; it does not duplicate credentials and remains protected by household RLS.

Orders keep the shopping provider, while deliveries can independently point to a delivery provider. A user or household can remain in a no-provider state; provider-dependent capabilities must be unavailable explicitly until a connection exists.

The API now uses a shared `StoreProvider` port with `get`, `authenticate`, `reauthorize`, `getOrders` and `updateBasket` operations. `storeProviderRegistry` resolves adapters by provider slug; Silpo is implemented as a factory-backed adapter that delegates to the MCP service. `StoreProviderService` owns provider catalog lookup, user-account persistence, household binding, token refresh and capability checks, so order approval does not call Silpo or MCP directly.

The API exposes user-level `GET /providers`, `GET /providers/accounts`, `POST /providers/:providerSlug/connect`, `POST /providers/:providerSlug/reauthorize` and `DELETE /providers/:providerSlug`. Household operations use the active RLS-scoped binding through `POST /providers/:providerSlug/bind` and `GET /providers/:providerSlug/orders`. Provider credentials are accepted only by the API, stored in the scaffold's server-side secret store, and represented in PostgreSQL by references.

## Desired mobile flow

### Authentication and onboarding

1. The app opens on Login.
2. The API authenticates an existing user and returns an opaque session token.
3. The app stores the session token in platform secure storage.
4. The onboarding asks the user to create a household or join one through an invitation.
5. After household membership exists, the user can connect and sign in to a store provider through the server-side integration; Silpo is the first supported option.
6. The user selects an active household when they belong to more than one.
7. The app replaces the Login route with the authenticated application area.

The product does not require public sign-up in the first demo. A controlled seed or administrative flow can create users, while the future onboarding flow supports `Create household` and `Join household`.

The intended onboarding sequence is:

```text
MiyKo login → Create household | Join household → Store provider sign-in/connect (Silpo first) → application
```

Provider connection is the second onboarding step because household membership is required before household-scoped provider binding. It supports a deliberate `Skip for now` state: planning and household collaboration may work without a provider, while receipt import, initial memory enrichment and delivery/basket features remain unavailable or pending until a provider is connected. Provider OAuth tokens stay on the API server and are never returned to Expo.

### Initial user memory

Every newly created user must trigger an asynchronous memory initialization flow. The user creation transaction writes a `user.memory_initialization_requested` outbox event; it must not synchronously call Silpo MCP or block login.

The API worker consumes this event and, once the user has an authorized store provider connection, requests the latest 100 receipts through that provider. For the first integration, this means reading receipts through Silpo MCP. The worker validates and normalizes the provider response, extracts stable food preferences, restrictions, recurring purchases and other useful signals, and writes a summarized long-term memory to Mem0.

Memory initialization must be idempotent and scoped to the authorized user and household. Raw receipts, credentials and tokens must not be stored in Mem0 or logs. If the user has no household or connected provider account yet, the event remains pending with an explicit status and is retried after onboarding or provider connection; it must not bypass the `Create household` / `Join household` requirement.

The app may expose initialization status as a non-blocking screen or indicator. It must not present generated preferences as confirmed facts until they are available and, where needed, confirmed by the user.

### Main application area

The authenticated area uses native platform navigation where possible:

- Home: food plan, calendar events, audio/chat entry and upcoming deliveries.
- Household: household summary, members, permissions and invitation flow.
- Settings: account and household preferences, opened from the Home header.
- Deliveries: all deliveries and delivery details.
- Chat/audio: a future conversational input flow connected to intent processing.

High-level areas are navigation destinations. Details such as Invite Member, Settings, Delivery Details and Chat are pushed sub-routes that return with the native back action or gesture.

## Desired end-to-end food flow

```text
User text or audio
        ↓
Create food intent
        ↓
Load authenticated household context
        ↓
Retrieve relevant household/member/run memory
        ↓
Read local history and provider history when needed
        ↓
Plan meals, servings and required products
        ↓
Search current provider products and replacements
        ↓
Create a local shopping proposal
        ↓
Collect household suggestions and changes
        ↓
Wait for explicit owner approval
        ↓
Update the provider basket
        ↓
Persist local order and synchronization state
        ↓
Emit outbox events
        ↓
Collect feedback and update memory
        ↓
Schedule a follow-up suggestion
```

The workflow should pause at approval and resume from a durable LangGraph checkpoint. It must never infer approval from a client-side status or from a previous proposal version.

## Desired API flow

Every request passes through the applicable shared boundary before feature logic:

```text
request
  → security headers / CORS / request context
  → authentication
  → tenant and permission authorization
  → input validation
  → feature service
  → database or external adapter
  → public contract serializer
  → safe response
```

Public endpoints must be explicitly documented. Sensitive and tenant-owned routes are protected by default. Feature routes remain thin; services own business rules, and integrations own external protocol details.

## Desired authentication and RLS flow

Authentication has a bootstrap phase and an authenticated phase.

### Bootstrap phase

Before the user is known, the API must be able to:

- look up a user for login by normalized email;
- verify the password against the stored password hash;
- find a session by a hash of the presented token;
- create or revoke a session through a controlled server-side operation.

These operations must use narrowly scoped `SECURITY DEFINER` database functions or an equivalent controlled path. They must not expose an anonymous API route or bypass RLS broadly.

### Authenticated phase

1. The API validates the session and obtains the user ID.
2. The API sets the transaction-local PostgreSQL identity context from server-validated data.
3. RLS policies enforce row visibility at the database boundary.
4. Services additionally scope queries and check permissions.
5. The request transaction ends and the identity context disappears.

The runtime API connection uses the least-privilege `api_role`. Migration or administrative credentials are separate and are never shipped to the mobile app.

## Desired data ownership

### Global records

These are not household-owned but still require protected access:

- users;
- password hashes and sessions;
- provider catalog records shared across households where appropriate;
- user-level provider connections, with secret references kept server-side.

### Household-owned records

These must carry an explicit tenant scope and use RLS:

- memberships and invitations;
- food intents and meal plans;
- proposals and proposal decisions;
- connected provider accounts;
- orders, order items and deliveries;
- feedback and notification jobs;
- memory synchronization metadata;
- outbox and audit records.

A user can belong to multiple households. Decision capability belongs to the membership in a particular household, not permanently to the user account.

## Desired memory flow

```text
household memory  → shared preferences and restrictions
member memory     → personal preferences
planning-run memory → temporary context for one workflow
```

Every memory read or write is scoped by the authorized household. Memory updates happen after a domain event such as feedback, completed order processing or an accepted audio intent. Mem0 retrieval cannot grant access, approve a basket or select a household.

## Desired outbox flow

1. A business transaction writes its relational change.
2. The same transaction writes an `outbox_events` row.
3. A worker claims pending events with retry/idempotency protection.
4. Consumers update memory, notifications, synchronization state or workflow state.
5. The event is marked published or moved to a controlled dead-letter state.

Outbox payloads must be minimal, tenant-scoped and free of secrets. A provider failure must not erase the local proposal or order history.

### Initial memory worker

For the prototype, the worker can run as an in-process API worker with a polling or explicit `runOnce` entry point. The durable source of work remains `outbox_events`; a separate worker service can be introduced later without changing the event contract. Retries, idempotency keys, failure status and safe redacted logging are required before this flow is treated as complete.

## Current implementation flow

The current codebase is a scaffold with several real boundaries already wired:

### Mobile

- `apps/app/src/app/_layout.tsx` wraps the app with `AuthProvider`, Expo Router `ThemeProvider`, `PaperProvider` and a root `Stack`.
- `apps/app/src/app/index.tsx` is Login. It calls `POST /auth/login`, stores the opaque session in Expo SecureStore and replaces the route with `/home` after success.
- `apps/app/src/app/(app)/_layout.tsx` redirects unauthenticated users to Login and renders the native tab navigator for authenticated users.
- Current tabs are Home and Household.
- Home calls the API for dashboard and delivery data, displays a calendar-like date selector, a Record Audio button, chat entry, household summary and delivery cards.
- Settings, Store Providers, Chat, Deliveries, Delivery Details and Invite Member are implemented as pushed routes. Provider connection uses the shared contracts and binds the user account to the active household after authentication.
- The mobile app currently expects `EXPO_PUBLIC_API_URL`; it does not use a local mock data store anymore.

### API

- `apps/api/src/app.ts` applies shared security/request middleware, exposes `/health`, mounts auth routes and protects the feature API.
- Feature directories exist for auth, dashboard, products, households, providers, orders, deliveries, settings, audio, memory and outbox.
- Hono secure headers, CORS, body limits, request context, logging, authentication, household context, validation and rate limiting are present.
- Authentication uses email/password plus opaque bearer sessions.
- Most feature services use the server-side Drizzle client and PostgreSQL records.
- MCP is adapter-backed and defaults to a mock client. The real client currently returns an explicit disabled error.
- Store providers use a generic API port and registry; Silpo passes the authenticated provider token to the MCP adapter, retries one reauthorization on an expired-token response, and returns explicit missing-connection or reauthorization errors.
- Order proposal creation and approval persist local records and outbox events; approval uses the active household provider binding and can create local order records after the provider basket update.
- Audio accepts a validated mock request and returns a mock planning response. The mobile Record Audio action is not connected to native recording yet.
- Settings currently use a process-local fallback because there is no settings table in the database schema.

### Database

- `packages/database/src/schema.ts` contains Drizzle tables, relations, enums, constraints and RLS policies.
- Generated migrations exist under `packages/database/drizzle`.
- The schema includes users, sessions, households, memberships, invitations, intents, planning runs, meal plans, feedback, memory sync records, generic providers, user provider connections, household provider bindings, products, proposals, orders, deliveries, idempotency, outbox, notifications and audit logs.
- `packages/database/src/client.ts` creates the server-side Drizzle client from `DATABASE_URL`.
- The API currently creates this client during module loading, so a valid database URL is required even though MCP and some adapters are mock-backed.
- `api_role` is created once by the local PostgreSQL init script; migrations only grant runtime access and install controlled helpers.
- The demo seed covers users, memberships, the provider catalog, products, plans, proposals, orders and deliveries. It intentionally does not seed fake provider credentials; a provider connection is created through the API login endpoint. It also does not emit or complete initial memory initialization events.

## Current gaps and decisions to resolve

- [x] Implement the controlled `SECURITY DEFINER` bootstrap path for login and session lookup under RLS.
- [x] Set the PostgreSQL request identity context inside API transactions before tenant queries.
- [x] Keep `api_role` separate from migration credentials and without `BYPASSRLS`.
- [x] Provide a complete demo seed: users, households, memberships, provider catalog, products, plans, proposals, orders and deliveries.
- [ ] Decide whether the scaffold remains database-backed locally or gains an explicit API-wide mock mode. `mockOnly: true` currently does not remove the database requirement.
- [x] Keep onboarding usable for users with no active household: create or join must happen before household routes are usable.
- [x] Add API support for the two-stage onboarding flow: `Create household` or `Join household`, then server-side store-provider sign-in/connect.
- [x] Define the API no-provider state: provider-dependent operations return explicit connection or reauthorization errors.
- [x] Define the generic provider catalog, user provider connections and household account bindings in the database schema.
- [x] Keep the core API provider-agnostic and introduce the shared provider port plus adapters before adding a second store integration.
- [ ] Replace the scaffold's in-memory provider secret store with encrypted durable server-side secret storage.
- [ ] Add the first real Agent Layer workflow with LangGraph checkpoints.
- [ ] Emit `user.memory_initialization_requested` when a user is created and process it through the API outbox worker.
- [ ] Implement the latest-100-receipts Silpo MCP read, normalization, analysis and idempotent Mem0 long-term memory write.
- [ ] Add a non-blocking API/mobile status for memory initialization and define retry behavior when household or Silpo access is not ready.
- [ ] Connect memory post-processing through outbox events and a Mem0 adapter.
- [ ] Discover the real Silpo MCP tools through `tools/list` before implementing provider-specific calls.
- [ ] Connect native audio recording in the app to the protected audio API route.
- [ ] Add the missing proposal/order UI needed to demonstrate owner review and approval from the mobile app.
- [ ] Replace the settings process-local fallback with a deliberate persisted settings design.
- [ ] Add notifications and accelerated follow-up scheduling for the demo.

## Recommended implementation order

1. Replace the scaffold provider secret store with encrypted durable storage.
2. Resolve the database bootstrap, API role and RLS authentication path in the owner-run environment.
3. Implement the outbox event and API worker for initial user memory with mock MCP/Mem0 adapters.
4. Implement the minimal LangGraph workflow with mock MCP and mock memory adapters.
5. Add proposal review and owner approval in the mobile UI.
6. Discover the real Silpo MCP tools and connect read operations, then provider basket mutation behind approval.
7. Add Mem0 post-processing, outbox consumers, feedback and follow-up notifications.
8. Finish security hardening and owner-run manual verification of tenancy and permission boundaries.
