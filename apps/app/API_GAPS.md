# App/API gaps

The app calls the Hono API through the shared `@miyko/contracts` types. Relational API resources are read from the existing Drizzle database client; external agent, audio, Mem0 and Silpo integrations remain scaffold adapters.

## Missing or not directly representable

- Household onboarding: `POST /onboarding/households` creates the first household and owner membership without requiring an existing household context. `POST /invitations/:id/accept` is available without household context and is wired to the `Join household` flow.
- Store providers: the app uses `GET /providers` and `GET /providers/accounts`, connects or reauthorizes through the user-level routes, and then calls the household-scoped bind route. Provider credentials remain API-side; the app only keeps them in the form state while submitting.
- Text chat / food intent: there is no route such as `POST /intents` or `POST /chat` that accepts the message from the chat screen and returns a planning response. `POST /memory` is not an equivalent replacement because memory is not the source of truth for an intent.
- Audio capture: `POST /audio/process` exists and the app client exposes it, but the app has no recording/file-upload flow yet. The Home audio control therefore reports this as unavailable instead of sending fabricated audio data.
- Basket approval context: `POST /orders/proposals/:proposalId/approve` exists, but the delivery detail response does not expose a proposal ID. The app does not turn a delivery tap into a fabricated basket approval.
Product, household, delivery and order identifiers are now UUIDs from the database and the app consumes their shared contract shapes directly.
