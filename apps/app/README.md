# MiyKo mobile app

Expo/React Native client for authentication, household setup, provider connection and managed workflows.

The app sends text or audio requests to the Hono API, displays the latest workflow projection and lets the household owner connect the provider and approve or decline pending actions. Members use the existing household provider connection without reconnecting. Recipes, products, images, basket contents, fulfillment and pause/resume state are returned by the LangGraph/Silpo MCP workflow; API values are references or last-observed status, not a local catalog or authoritative order model.

Configure `EXPO_PUBLIC_API_URL` in `.env.local`. For a physical device use the development machine LAN address instead of `localhost`.

Provider connection opens the system browser. `SILPO_OAUTH_REDIRECT_URI` must point to the API callback and be registered with the provider; `PROVIDER_OAUTH_APP_REDIRECT_URI=miyko://provider/oauth/callback` returns control to the native app. If the API runs on another Linux/macOS machine and the demo uses a physical phone, the API callback must also use a phone-reachable LAN or tunnel URL rather than `127.0.0.1`.

For the demo, log in with the seeded accounts from the API README. The owner sees the Silpo connection action; admin and user already belong to the same household but do not see a provider connection form. A physical phone must reach both the API and the OAuth callback: replace `192.168.1.100` in `.env.local` with the development machine's LAN IP, set the API `HOST=0.0.0.0`, and register the matching LAN/HTTPS callback URL with the provider. `localhost` and `127.0.0.1` refer to the phone itself when the app runs on a physical device.
