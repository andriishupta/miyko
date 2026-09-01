# TODO

## Database scope and assumptions

- [ ] Keep the database package as a Drizzle schema and migration package.
- [ ] Use one existing PostgreSQL user for the prototype; do not create or manage PostgreSQL roles/users in this project yet.
- [ ] Keep the initial schema implementation separate from API route implementation.
- [ ] Use PostgreSQL as the source of truth for identity, household membership, permissions, plans, proposals, orders, deliveries, feedback, notifications and outbox events.
- [ ] Keep Mem0 as an external context store, not as a replacement for relational records or authorization.
- [ ] Keep Silpo as the first provider, but model provider references so another shopping provider can be added later.
- [ ] Keep all schema work migration-based and reversible where practical.

## Drizzle package setup

- [ ] Add a Drizzle configuration file with schema path, migrations directory and database URL configuration.
- [ ] Add a database client module that reads the connection string from server-only environment configuration.
- [ ] Add a single schema entry point that exports all table definitions and relations.
- [ ] Add explicit database scripts for schema generation, migration and local inspection.
- [ ] Add a safe environment example without real credentials.
- [ ] Keep generated migration files committed; do not ignore Drizzle migrations or schema metadata required for reproducible migrations.
- [ ] Add shared enums and timestamp helpers where they reduce schema duplication.
- [ ] Add indexes and foreign keys intentionally based on API access patterns.
- [ ] Add unique constraints and check constraints for identity, membership, statuses and provider identifiers.

## Users and authentication data

- [ ] Create `public.users` as the global user record table.
- [ ] Add a stable UUID primary key.
- [ ] Add unique normalized email.
- [ ] Add `password_hash`; never store a plaintext password.
- [ ] Add first name, last name and optional display name.
- [ ] Add account status, created timestamp, updated timestamp and last-login timestamp.
- [ ] Keep account type independent from household membership; do not model a permanent `child` or `adult` user type.
- [x] Add session records for the selected email/password plus opaque bearer-session authentication approach.
- [ ] Keep password hashes and authentication records out of API responses, logs, Mem0 and client payloads.

## Households and membership

- [ ] Create `households` with a UUID primary key, name, owner reference and timestamps.
- [ ] Create `household_members` as the many-to-many relation between users and households.
- [ ] Support one user belonging to multiple households.
- [ ] Add membership status and joined/removed timestamps.
- [ ] Add household roles such as owner, admin and member.
- [ ] Store `can_make_decisions` on the household membership, not on the global user.
- [ ] Allow the same user to have different decision permissions in different households.
- [ ] Allow a former child profile to become decision-capable without migrating the user account.
- [ ] Allow any eligible user to create or join a new household later.
- [ ] Enforce one active owner per household and define owner-transfer behavior.
- [ ] Add an invitation table with household, inviter, invitee identity, role, decision permission, token hash, status and expiration.
- [ ] Make invitation acceptance create or activate a household membership only after server-side validation.
- [ ] Add indexes for active membership lookup by user and household.

## Row-Level Security and multi-tenancy

- [ ] Treat `household_id` as the primary tenant boundary.
- [ ] Add a non-null `household_id` to every household-owned table where practical.
- [x] Enable PostgreSQL RLS on all household-owned tables through schema-defined policies.
- [x] Add high-level policies for select, insert, update and delete based on authenticated user identity and active household membership.
- [x] Define how trusted API request context is passed into PostgreSQL inside a transaction.
- [ ] Never derive RLS context from an untrusted client-provided household ID alone.
- [x] Ensure users can access only memberships and records for households they belong to.
- [ ] Ensure owner/admin/member permissions are enforced in addition to tenant isolation.
- [x] Keep global `users` records protected; `public` is the PostgreSQL schema name, not public unauthenticated access.
- [x] Document the narrow exceptions for migrations and controlled administrative operations.
- [ ] Add cross-household denial cases to the database verification plan before production use.

## Food intentions, plans and household memory metadata

- [ ] Create `food_intents` for natural-language requests such as planned meals, breakfasts or products to remember.
- [ ] Link intents to the household and submitting member.
- [ ] Store intent text, normalized status, desired date/range and source such as text or audio.
- [ ] Create `meal_plans` for plans generated from one or more intents.
- [ ] Create `meal_plan_items` for meals such as breakfast, dinner and dessert.
- [ ] Store servings, planned date, notes and plan status.
- [ ] Add planning-run metadata including LangGraph thread/run identifiers when the workflow is introduced.
- [ ] Create a relational feedback table for observed results such as sufficient quantity, leftovers, liked items and items to repeat.
- [ ] Keep Mem0 namespace identifiers or synchronization metadata only where needed; do not copy Mem0 into the relational schema unnecessarily.
- [ ] Scope shared memory metadata by household, personal memory metadata by member and temporary planning context by run.

## Products and provider mapping

- [ ] Create a local product/provider mapping table for products seen through Silpo MCP.
- [ ] Store provider name, provider product ID, normalized product name, current known details and last-seen timestamp.
- [ ] Keep provider data cacheable and refreshable; do not assume cached price or availability is current.
- [ ] Add product replacement/similarity references only if they are needed by the proposal flow.
- [ ] Keep provider product IDs distinct from internal product IDs.
- [ ] Add indexes for provider and provider product ID lookup.

## Shopping proposals and approvals

- [ ] Create `shopping_proposals` for an agent-generated basket before it affects a real Silpo basket.
- [ ] Link each proposal to a household, planning run, creator and optional meal plan.
- [ ] Add explicit proposal states such as draft, awaiting changes, awaiting owner approval, approved, declined, applied and failed.
- [ ] Create `shopping_proposal_items` with product, quantity, unit, replacement information, estimated price and item status.
- [ ] Store member suggestions, comments and item-level decisions separately from the final owner decision.
- [ ] Record who approved, declined, replaced or edited each item and when.
- [ ] Ensure approval is tied to a specific proposal version or revision.
- [ ] Keep a declined or replaced item from being silently reintroduced into a later mutation.

## Orders, deliveries and synchronization

- [ ] Create `orders` as MiyKo-owned records mapped to external provider orders or baskets.
- [ ] Store household, provider, connected account, internal status, provider order ID, totals when known and timestamps.
- [ ] Keep proposed baskets separate from real provider orders.
- [ ] Create `order_items` with internal product mapping, provider product ID snapshot, name snapshot, quantity, price snapshot and status.
- [ ] Create `deliveries` for delivery-specific information such as scheduled window, status, address reference and provider delivery ID.
- [ ] Link deliveries to orders and optionally to a meal-plan item or food event.
- [ ] Support standalone deliveries that are not linked to a meal.
- [ ] Store the last provider synchronization timestamp and synchronization status.
- [ ] Create order/delivery status history or sync-event records to diagnose divergence between MiyKo and Silpo.
- [ ] Preserve snapshots needed to render past orders even if provider product data changes.
- [ ] Define reconciliation behavior when Silpo and local order state disagree.
- [ ] Allow the UI to show local data while marking stale or unsynchronized provider state clearly.
- [ ] Add idempotency keys for order creation, approval application and provider synchronization.

## Connected shopping accounts

- [ ] Create `connected_provider_accounts` for household-linked Silpo accounts.
- [ ] Associate each connection with the household member who authorized it.
- [ ] Store provider, encrypted access/refresh token references, scopes, status and expiration metadata.
- [ ] Keep raw credentials out of normal query results, logs, Mem0 and mobile responses.
- [ ] Store which connected account is selected for a household's final basket, without assuming every member has a provider account.
- [ ] Add revocation and reconnect states.

## Outbox pattern

- [ ] Create an `outbox_events` table in the same database transaction as the business change that produces the event.
- [ ] Add event ID, household ID, aggregate type, aggregate ID, event type, version, payload, status, attempts, timestamps and last error.
- [ ] Keep event payloads minimal and free of secrets.
- [ ] Add unique/idempotency protection for events that must be emitted once per aggregate transition.
- [ ] Define events for order approval, order update, feedback creation, delivery synchronization, memory update and follow-up scheduling.
- [ ] Process outbox events asynchronously from the API or a later worker.
- [ ] Make consumers idempotent and retryable.
- [ ] Add dead-letter or permanently-failed handling without deleting the original event.
- [ ] Enforce household scope when reading and processing tenant-owned outbox events.

## Notifications and follow-ups

- [ ] Create `notification_jobs` with household, recipient, source event, scheduled time, status, attempts and delivery metadata.
- [ ] Store estimated duration and next check time for completed purchases where applicable.
- [ ] Keep notification text as a proposal/question when inventory is inferred rather than confirmed.
- [ ] Support simulated follow-up timing for the prototype without requiring a production scheduler.
- [ ] Prevent duplicate notifications when an outbox event is retried.

## Schema safety and operational rules

- [ ] Use UTC timestamps consistently.
- [ ] Prefer UUIDs for externally reachable identifiers.
- [ ] Add soft-delete or archival behavior only where historical records must be retained; do not add it everywhere by default.
- [ ] Restrict status transitions to explicit valid transitions in the service layer and database constraints where useful.
- [ ] Avoid storing raw audio unless a future feature explicitly requires it and retention is defined.
- [ ] Avoid storing exact pantry inventory as fact without user confirmation.
- [ ] Add audit fields for sensitive mutations such as membership changes, owner approvals and provider-account changes.
- [ ] Define retention and deletion behavior for users, household membership, receipts, audio metadata, orders and outbox payloads.

## Mock versus real implementation

### Mock now

- [ ] Use mock database records or fixtures for API scaffold work.
- [ ] Keep the Drizzle schema plan independent from a real database connection.
- [ ] Use mock Silpo product/order/delivery data.
- [ ] Use mock memory and outbox processing where the API needs a response.

### Real later

- [x] Implement Drizzle tables and relations.
- [x] Generate the initial migration; applying it against PostgreSQL remains a later step.
- [x] Add RLS policies and document the trusted request context.
- [ ] Add password hashing and session persistence through the API authentication layer.
- [ ] Add real Silpo account and order synchronization.
- [ ] Add durable outbox processing and Mem0 synchronization.

## Completion criteria for the database scaffold

- [x] The schema plan covers users, households, memberships, permissions, invitations, intents, plans, products, proposals, approvals, orders, deliveries, provider accounts, feedback, notifications and outbox events.
- [x] The model supports one user in multiple households without mixing data or memory.
- [x] Decision capability is membership-scoped and can change over time.
- [x] Real provider orders can be reconciled with local records without losing historical snapshots.
- [x] RLS and outbox boundaries are documented before implementation begins.
- [x] No PostgreSQL user creation or real database operation is part of this scaffold task.
