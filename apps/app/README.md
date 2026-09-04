# MiyKo mobile app

Expo/React Native client for authentication, household setup, provider connection and managed workflows.

The app sends text or audio requests to the Hono API, displays the latest workflow projection and lets the household owner connect the provider and approve or decline pending actions. Members use the existing household provider connection without reconnecting. Recipes, products, images, basket contents, fulfillment and pause/resume state are returned by the LangGraph/Silpo MCP workflow; API values are references or last-observed status, not a local catalog or authoritative order model.

Configure `EXPO_PUBLIC_API_URL` in `.env.local`. For a physical device use the development machine LAN address instead of `localhost`.
