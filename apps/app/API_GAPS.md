# App/API gaps

The app calls the Hono API through the shared `@miyko/contracts` types. Relational API resources are read from the existing Drizzle database client; external provider and Agent Layer behavior still depends on server-side credentials and deployed integrations.

## Missing or not directly representable

- Household onboarding: `POST /onboarding/households` creates the first household and owner membership without requiring an existing household context. `POST /invitations/:id/accept` is available without household context and is wired to the `Join household` flow.
- Store providers: the app uses `GET /providers` and `GET /providers/accounts`, connects or reauthorizes through the user-level routes, and then calls the household-scoped bind route. Provider credentials remain API-side; the app only keeps them in the form state while submitting.
- Text chat / food intent: the app calls `POST /intents` with the shared food-intent shape. The API invokes the Agent Layer, persists the intent and meal plan, and creates a provider-backed shopping proposal when a provider is connected.
- Planning: the app client exposes `POST /planning` and `GET /planning/:planningRunId`; the API scopes runs to the active household and persists run correlation identifiers.
- Audio processing: `POST /audio/process` sends a real Expo recording as JSON base64. The API performs transcription and uses the same intent/planning flow as text input.
- Memory initialization: the Settings UI calls `GET /memory/status`; the API returns the latest household-scoped initialization record or `null` when none exists.
- Provider synchronization: the provider UI calls `POST /providers/:providerSlug/sync`; the API queues a sync only when the provider state is stale and returns the current sync status.
- Basket approval: proposal review and owner approval now call the existing proposal routes. Delivery details expose a proposal ID when one is linked; otherwise the UI reports that no proposal was returned. Approval still depends on an active provider binding, and provider basket synchronization can return the API's explicit connection or integration error.
Product, household, delivery and order identifiers are now UUIDs from the database and the app consumes their shared contract shapes directly.
