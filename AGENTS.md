# AGENTS.md

This file contains repository-wide engineering conventions. Product behavior, domain rules, architecture decisions and feature requirements belong in `README.md` and the project documentation.

## Working style

- At the start of every agent session, read this file, `README.md` and the relevant project documentation before taking action.
- At the end of every session, review whether the work changed a documented decision, contract or workflow and update the existing documentation when needed.
- Prefer updating an existing `README.md`, PRD or architecture document over creating another document.
- If a new general document or file is useful but was not explicitly requested, recommend it and ask for permission before creating it.
- Read the relevant project documentation before changing behavior or architecture.
- Keep changes focused on the requested outcome.
- Prefer small, understandable implementations over speculative abstractions.
- Do not silently change product scope, public contracts or security assumptions.
- Preserve unrelated user changes.
- Do not run tests, builds, formatters or other checks automatically unless requested. When useful, provide the command for the owner to run.
- Avoid destructive Git and filesystem operations.

## Simplicity

- Use the simplest design that satisfies the requirement.
- Do not add unnecessary layers, dependencies, configuration or validation.
- Do not add fallback behavior that hides a missing configuration or silently changes behavior.
- Fail explicitly and safely when a required dependency, configuration value or permission is missing.
- Keep error handling proportional to the actual risk and domain complexity.

```ts
// Good: missing configuration is visible immediately.
const apiUrl = process.env.API_URL;
if (!apiUrl) throw new Error('API_URL is required');

// Avoid: silently switching to an unexpected environment.
const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
```

## Code organization

- Group code by feature when the project has multiple domain features.
- Keep a feature's routes, schemas, services, types and adapters logically together.
- Put genuinely shared behavior in `utils`, `lib` or `infrastructure` modules.
- Do not duplicate common functions across features.
- Keep route, controller or screen files thin; move reusable logic into focused modules.
- Avoid creating a new component, helper or service when an existing one already owns that responsibility.

```text
features/
  orders/
    orders.routes.ts
    orders.schemas.ts
    orders.service.ts
    orders.constants.ts
lib/
  dates.ts
  errors.ts
  ids.ts
```

## Functions and classes

- Prefer small functions for transformations, validation and business rules.
- Prefer pure functions when state is not required.
- Use classes only when they represent a meaningful stateful boundary, such as a client, repository or service with a lifecycle.
- Do not create classes only to group static helper functions.
- Keep constructors and public methods narrow when a class is justified.

## TypeScript

- Use strict TypeScript and explicit compiler settings for each runtime package.
- Prefer inferred types for local values and named types for public boundaries.
- Avoid `any`; use `unknown` at untrusted boundaries and narrow it through validation.
- Use enums, literal unions or `as const` objects for finite states instead of repeating string literals.
- Keep constants in named modules instead of scattering magic numbers and status strings.
- Do not use type assertions merely to silence compiler errors.

```ts
export const ORDER_STATUS = {
  pending: 'pending',
  approved: 'approved',
  completed: 'completed',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];
```

## Security and permissions

Security is deny-by-default: access is denied until a specific rule grants it.

- Authenticate and authorize at the server or trusted application boundary.
- Never trust identity, tenant, role, permission or approval values supplied only by a client.
- Apply authorization close to the protected resource, not only at the outer route or UI layer.
- Use explicit allowlists for roles, actions, state transitions, origins and external operations.
- Keep secrets, credentials, password hashes and private payloads out of clients, logs and analytics.
- Validate all external input and third-party responses at the boundary.
- Do not create anonymous debug, impersonation or fallback paths for convenience.
- Return generic external errors; keep sensitive diagnostics in protected logs.
- Apply least privilege to runtime credentials and separate them from migration or administrative credentials.

```ts
export function requirePermission(granted: boolean): void {
  if (!granted) throw new Error('Forbidden');
}
```

## Database

- Keep schemas as small as the domain allows; model required business facts, not hypothetical features.
- Use migrations as the source of reproducible database changes.
- Use UUIDs, foreign keys, unique constraints, check constraints and indexes intentionally.
- Add `createdAt` and `updatedAt` to normal mutable domain tables by default.
- Add `deletedAt` when recoverable deletion or historical retention is needed; do not add it automatically to append-only or purely relational tables.
- Make tenant ownership explicit when a project has tenant boundaries, and use database-level isolation such as RLS where appropriate.
- Keep permissions closed by default in database policies and grant only required operations.
- Never commit database credentials or personal connection details.
- Migration tooling must use controlled, non-personal credentials; runtime application access must use a least-privilege database role.
- Keep database-library types out of UI contracts.
- Use transactions when multiple writes must succeed together or when a business change emits an event.

```ts
const rows = await db
  .select()
  .from(records)
  .where(and(eq(records.id, recordId), eq(records.tenantId, context.tenantId)));
```

## API and contracts

- Keep API endpoints small, explicit and resource-oriented.
- Keep handlers thin: parse input, authorize, call domain logic and serialize the result.
- Use a consistent response and error shape.
- Treat the API contract as the boundary between backend and UI.
- Update shared contracts, serializers and UI types together after a domain or database schema change.
- Never return internal database fields such as credentials, hashes, private metadata or audit internals.
- Do not expose raw database rows directly to clients.
- Separate read operations from state-changing operations.
- Make external calls time-bounded, validated and idempotent when they mutate state.
- Select mock and real adapters explicitly through configuration; never switch silently after a failure.

## React and React Native

- Keep components focused on presentation and interaction.
- Keep implementation details such as orchestration frameworks, memory providers, protocols and internal state names out of user-facing copy. Translate them into short product language; reserve identifiers and diagnostics for explicitly hidden developer information.
- Extract repeated UI into a shared `components` module.
- Keep data fetching and domain logic out of low-level presentational components.
- Keep loading, empty, error, disabled and pressed states explicit.
- Use theme tokens for colors, spacing and typography instead of repeated hardcoded values.
- Prefer accessible platform primitives before writing custom interaction components.

### Expo projects

- Use Expo and Expo Router when the project is based on Expo.
- Use React Native Paper for common cross-platform UI and centralized themes when it fits the product.
- Use native or Expo components for platform-specific controls when they provide a better experience.
- Keep one shared component tree where possible; use platform-specific files only when behavior genuinely differs.
- Use `react-native-safe-area-context` for safe-area handling.
- Prefer native controls for switches, sliders, pickers and similar platform behaviors.
- Keep mobile configuration free of server secrets and database credentials.
- Do not hardcode `localhost` for a physical device; use an intentional LAN or development URL.

```tsx
<PaperProvider theme={theme}>
  <Screen />
</PaperProvider>
```

## Definition of done

- The implementation is focused and has no unnecessary fallback path.
- Public boundaries have explicit types and validation.
- Permissions are denied by default and checked at the trusted boundary.
- Shared logic is not duplicated.
- Database changes are represented by migrations and reflected in contracts where needed.
- UI states and themes are handled consistently.
- Documentation is updated when a decision affects future work.
