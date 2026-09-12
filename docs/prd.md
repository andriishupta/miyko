# MiyKo — Product Requirements Document

**Status:** Hackathon prototype
**Date:** September 2026
**Product:** Mobile household food agent  
**Platform:** Expo / React Native  
**Primary integration:** Official Silpo MCP

## 1. Product Summary

MiyKo is a food AI agent that coordinates shared purchases through durable workflows, explicit roles, human approvals and household-scoped long-term memory. The MVP is household-first, while the same workflow can also support an office team, party, picnic or another temporary group.

Unlike a traditional shopping assistant, MiyKo coordinates the complete workflow:

```text
shared request → managed workflow → member changes → approval → provider basket → checkout
```

Users can start requests such as “make carbonara this week,” “dinner for two,” “repeat last week’s office pizza order” or “shop for two weeks,” collaborate with household members and turn an approved result into a real provider basket. Recipes and products come from the LLM and store provider; MiyKo does not maintain its own catalog. Long-term memory belongs to the household and its members, so previous purchases and preferences remain useful beyond a single chat.

A household may contain one person or multiple family members. For a party, picnic or office event it can be created as a temporary household using the same workflow.

## 2. Elevator Pitch

MiyKo turns shared household or group purchases into durable workflows that can pause, resume, run on a schedule, repeat from memory or compare multiple stores. Members contribute requests, while roles and approvals keep important decisions under human control. Long-term household/member memory carries preferences and previous purchases across workflows instead of losing them with one chat.

## 3. Problem

Food planning requires repeated decisions:

- what to eat;
- what products may already be available;
- how many portions are required;
- what each household member likes or avoids;
- which requests should be included;
- when another purchase may be needed;
- whether previous quantities were too small or excessive.

Existing shopping assistants mainly solve the current request. They do not maintain a durable shared workflow with roles, approvals, long-term group memory and reusable purchase context.

## 4. Target Users

### Primary users

- individuals who regularly purchase groceries online;
- couples coordinating household purchases;
- families with different preferences and restrictions;
- busy people who want to reduce repeated food-planning decisions.

### Household roles

- **Owner:** manages the household and connected Silpo account; approves purchases.
- **Adult member:** adds requests and edits the shared workflow.
- **Child profile:** contributes preferences or requests but cannot approve purchases.

A household containing one owner is a fully supported use case.

## 5. Core Product Capabilities

### Long-term household memory

MiyKo remembers:

- preferred products and cuisines;
- disliked products;
- dietary restrictions;
- typical basket contents;
- usual shopping frequency;
- approximate household portions;
- meals users want to try;
- products that were insufficient, excessive or unused;
- feedback from completed shopping cycles.

### Workflow inbox

Users can start a managed workflow from a future food event without immediately changing a provider basket:

- “I want carbonara this week.”
- “We need breakfasts for three days.”
- “I want to try ramen.”
- “Remember to buy fruit next time.”

### Workflow collaboration

Household members can:

- view active workflows;
- add requests;
- request additions, replacements or fulfillment changes;
- approve or reject provider actions according to their role.

### Agent-created Silpo basket

The MVP uses the typed `step-order` workflow. It:

1. retrieves relevant memory;
2. checks previous Silpo purchases;
3. generates the recipe and resolves actual products through Silpo MCP;
4. proposes replacements or fulfillment choices;
5. pauses for household decisions and owner/admin approval;
6. writes approved changes to the Silpo basket.

### Food Loop

After a completed purchase, MiyKo asks:

- Was the quantity sufficient?
- What remained unused?
- What did the household like?
- Should anything be repeated?
- Should the next basket be different?

The answers update long-term memory.

### Proactive follow-up

MiyKo estimates when another purchase may be useful and sends a notification such as:

> Your last purchase was planned for approximately two days. Would you like to repeat it, adjust it or plan something new?

The system must present this as an estimate, not claim that a product has definitely run out.

## 6. Example End-to-End Scenario

### Initial household setup

1. Andrii creates the Petrenko household.
2. He connects his Silpo account.
3. His wife joins through an invitation.
4. Child profiles are added without independent Silpo accounts.
5. LangGraph/Silpo MCP reads the provider history required for the workflow.
6. Mem0 keeps long-term preferences and recurring patterns.

### Dinner planning

Andrii writes:

> I want carbonara for dinner today. Make enough for two days.

MiyKo:

1. retrieves household and member memory from Mem0;
2. asks the managed provider workflow for relevant history and products;
3. generates the recipe and basket in LangGraph/Silpo MCP;
4. returns the current provider basket for household review;
5. pauses before any provider mutation.

### Household collaboration

The wife adds or replaces an item:

> Please add a dessert.

A child profile requests a dessert:

> I want ice cream too.

The managed workflow keeps the request in its LangGraph thread, rechecks the current MCP basket and pauses before changing the real basket. The owner can:

- approve or decline the child request;
- accept or change the partner's addition/replacement;
- approve the remaining basket.

### Purchase

After an owner/admin command or approval, the resumed LangGraph workflow revalidates the current Silpo MCP state, calls the cart tools and adds the confirmed products to the real provider basket.

### Learning

After purchase, MiyKo stores feedback:

- carbonara was prepared for five portions;
- the household approved occasional dessert;
- some eggs may remain;
- the selected meat quantity was sufficient for two days.

### Follow-up

Two days later, MiyKo sends:

> You may be close to finishing the products from the previous plan. Should I repeat the basket, use the remaining ingredients or create a new three-day plan?

A new managed workflow begins using updated long-term memory.

## 7. Agent Workflow

The Agent Layer runs in a local LangGraph Agent Server for the MVP and can move to a hosted deployment later. A request and an order are one managed workflow: LangGraph checkpoints it, pauses for provider or household decisions and resumes until basket and fulfillment choices are complete.

```text
household request
  ↓
create deterministic workflow reference
  ↓
LangGraph loads Mem0 context and uses Silpo MCP
  ↓
recipe / basket / replacement / fulfillment choice
  ↓
pause → household decision → resume by thread_id
  ↓
owner/admin authorization
  ↓
update provider basket and return checkout link
  ↓
feedback → Mem0 update
```

Each workflow UUID becomes its deterministic LangGraph thread ID; LangGraph Agent Server assigns run IDs and preserves workflow state between requests. Local structured stdout logs record OpenAI and Silpo MCP execution without requiring cloud tracing. PostgreSQL stores only those external IDs, the provider reference, last observed status and approval decisions. Replacement, pickup/delivery, delivery-slot, approval and decline actions resume the thread. Owner/admin commands or approval authorize provider mutations. PostgreSQL does not store graph checkpoints, basket items or authoritative order state; background workflow-status synchronization is deferred.

## 8. Memory Design

### Mem0 Platform

Mem0 provides managed long-term memory and semantic retrieval.

Memory scopes:

```text
household_id → shared household memory
member_id    → personal preferences
workflow_id  → transient context held by LangGraph, not PostgreSQL
```

Example memories:

- “The household usually plans food for two or three days.”
- “Maria prefers fruit desserts.”
- “The child dislikes spicy products.”
- “Large packages of greens are frequently left unused.”
- “Carbonara portions should be slightly larger next time.”

Mem0 performs:

- memory extraction;
- embeddings;
- semantic storage;
- relevant-memory retrieval;
- memory updates.

No pgvector infrastructure is required while using Mem0 Cloud.

### Application database

PostgreSQL remains the source of truth for:

- users;
- households;
- membership;
- roles and permissions;
- invitations;
- owner Silpo authorization and the household provider connection;
- encrypted OAuth credentials;
- approval status;
- workflow references, outbox events and audit records.

Mem0 must never be used as the source of truth for permissions, authentication or purchase authorization.

### Projection and cache rule

The API may keep a thin last-observed projection and an optional short-lived cache for provider reads to avoid unnecessary repeated requests. This data is allowed to be stale and must not be treated as the current basket, order or delivery state. Before any provider mutation, the managed workflow reads and validates the current state through Silpo MCP. No product, basket or order cache is stored as a local domain model in PostgreSQL.

## 9. Silpo MCP Integration

The managed LangGraph workflow uses the official Silpo MCP server. The MiyKo API only handles provider authentication, encrypted credentials and household binding.

Relevant tools include:

- online and offline order history;
- family profile and food restrictions;
- product search;
- product details and nutritional attributes;
- similar products and replacements;
- current shopping basket;
- adding and updating basket products;
- delivery types and available time slots.

Actual tool names and schemas must be discovered through `tools/list`.

### Safety rule

Read operations may run automatically. A provider mutation requires an authenticated owner/admin command or their explicit approval of another member's request.

## 10. Authentication

Two authorization layers are required.

### MiyKo authentication

Users authenticate with the MiyKo backend. The backend determines:

- user identity;
- household membership;
- role;
- permissions.

### Silpo authorization

Each connected Silpo account uses OAuth 2.1 Authorization Code + PKCE through the MCP transport. The owner signs in on the Silpo authorization page; MiyKo must never collect the owner's Silpo password.

Silpo access and refresh tokens:

- are stored only on the backend;
- are encrypted at rest;
- are never exposed to React Native;
- are associated with the household owner who authorized the provider.

Each household has one active connection per provider. Household members use that owner-authorized connection; they do not create separate Silpo connections. The managed workflow and Silpo MCP own the final basket and order.

## 11. Technical Architecture

```text
Expo / React Native
        ↓
Hono API — TypeScript
        ├── authentication
        ├── household management
        ├── invitations and roles
        ├── LangGraph Agent Server client and thin projection
        ├── provider authentication adapters
        └── outbox worker
                 ↓
        ┌────────┼───────────────┐
        ↓        ↓               ↓
   PostgreSQL  Mem0 Platform  Silpo MCP
```

### Technology stack

- **Mobile:** Expo, React Native, TypeScript.
- **Backend:** Hono, TypeScript.
- **Agent Layer:** LangChain/LangGraph Agent Server with local structured execution logs.
- **Long-term memory:** Mem0 Cloud.
- **Database:** PostgreSQL.
- **MCP:** official Model Context Protocol TypeScript client.
- **Validation:** Zod.
- **Notifications:** Expo Notifications.
- **LLM:** tool-calling model selected during implementation.

Requests should be batched where possible. Receipt ingestion should not create a separate memory request for every individual product. If repeated provider reads become expensive, add a bounded cache at the integration boundary with an explicit TTL; it must not replace MCP revalidation before mutations.

## 12. Notifications and Scheduling

Follow-up notifications are deferred from the core MVP. If enabled later, a notification service can start a new managed workflow from a household memory signal; it should not introduce local meal, product or order state.

## 13. MVP Scope

### Must have

- household creation;
- owner and member roles;
- household invitation;
- one household Silpo connection authorized by the owner;
- Mem0 memory extraction and retrieval;
- natural-language workflow;
- managed Silpo MCP recipe/product/basket interaction;
- member item request;
- owner approve/decline;
- real Silpo basket update;

### Should have

- an additional store provider;
- voice input;
- child profile;
- item replacement;
- feedback after purchase;
- additional workflow kinds.

### Future workflow directions

- `scheduled-order`: activates at a selected time and requests confirmation after refreshing provider state;
- `recurring-order`: prepares a new basket from the previous order and relevant memory;
- `multi-store-order`: compares baskets through several store providers;
- `delegated-order`: temporarily transfers management and approval authority;
- `consensus-order`: requires decisions from several members or an agreed majority.

### Not included

- payment processing;
- automatic ordering without approval;
- support for ATB, Glovo or other retailers;
- Apple Health or MyFitnessPal;
- medical advice;
- exact automatic pantry inventory;
- smart-fridge integrations;
- detailed calorie tracking;
- production-grade parental controls.

## 14. Success Metrics

### Hackathon metrics

- Complete one end-to-end workflow during the demo.
- Show at least one real Silpo MCP tool call.
- Retrieve at least one relevant preference from Mem0.
- Add approved products to the real Silpo basket.

### Product metrics

- time from food event to approved basket;
- percentage of proposed items accepted;
- number of manual basket edits;
- repeated weekly usage;
- household-member participation;
- reduction in unused products;
- accuracy of portion estimates;
- notification-to-new-plan conversion.

## 15. Risks and Mitigations

| Risk                                     | Mitigation                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Incorrect memory inference               | Show memories as editable and request confirmation for important restrictions     |
| Stale product availability or local projection | Treat cached/projection data as informational and revalidate through MCP before cart update |
| Unauthorized basket changes              | Require owner/admin authorization and backend permission checks                    |
| Sensitive receipt data in cloud services | Minimize payloads and avoid storing provider credentials in Mem0 |
| Mem0 retrieval limit                     | Batch receipt ingestion and retrieve memory once per major workflow stage         |
| Workflow becomes too broad               | Demonstrate one strong dinner-to-basket-to-follow-up scenario                     |
| Notification inference is wrong          | Phrase notifications as questions, not factual inventory claims                   |

## 16. Main Differentiator

Mushroom helps users complete a current shopping request.

MiyKo maintains a durable household or group workflow with reusable memory:

```text
Mushroom: request → recommendation → basket

MiyKo: shared request → persistent workflow → collaboration
       → approval → provider basket → reusable memory
```

MiyKo is not another shopping chat. It coordinates people, permissions, memory and real provider actions across time while keeping consequential decisions under human control.
