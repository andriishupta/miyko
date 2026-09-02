# MiyKo — Product Requirements Document

**Status:** Hackathon prototype  
**Date:** September 2026  
**Product:** Mobile household food agent  
**Platform:** Expo / React Native  
**Primary integration:** Official Silpo MCP

## 1. Product Summary

MiyKo is a food-planning agent with long-term memory that helps individuals and households decide what to eat, coordinate preferences, create grocery baskets and improve future purchases.

Unlike a traditional shopping assistant, MiyKo operates across the complete food cycle:

```text
intent → planning → household approval → purchase → feedback → next purchase
```

Users can record ideas such as “I want carbonara this week,” collaborate with household members and turn an approved plan into a real Silpo basket. MiyKo remembers preferences, previous purchases, portion feedback and recurring habits, then proactively suggests the next purchase when supplies may be running low.

A household may contain one person or multiple family members.

## 2. Elevator Pitch

MiyKo is a household food agent that remembers what people want to eat, what they previously purchased and what worked for them. It combines long-term memory with the official Silpo MCP to transform a few words into a personalized shopping plan and real basket. Household members can contribute requests, while the owner approves the final purchase. Afterward, MiyKo learns from the outcome and improves the next shopping cycle.

## 3. Problem

Food planning requires repeated decisions:

- what to eat;
- what products may already be available;
- how many portions are required;
- what each household member likes or avoids;
- which requests should be included;
- when another purchase may be needed;
- whether previous quantities were too small or excessive.

Existing shopping assistants mainly solve the current request. They do not maintain a continuous household food cycle with shared planning, approval, long-term memory and proactive follow-up.

## 4. Target Users

### Primary users

- individuals who regularly purchase groceries online;
- couples coordinating household purchases;
- families with different preferences and restrictions;
- busy people who want to reduce repeated food-planning decisions.

### Household roles

- **Owner:** manages the household and connected Silpo account; approves purchases.
- **Adult member:** adds requests and edits shared plans.
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

### Intent inbox

Users can record future food intentions without immediately creating a basket:

- “I want carbonara this week.”
- “We need breakfasts for three days.”
- “I want to try ramen.”
- “Remember to buy fruit next time.”

### Collaborative planning

Household members can:

- view active meal and shopping plans;
- add requests;
- suggest products or desserts;
- comment on proposals;
- approve, edit or reject items according to their role.

### Agent-created Silpo basket

MiyKo:

1. retrieves relevant memory;
2. checks previous Silpo purchases;
3. estimates portions;
4. searches actual products through Silpo MCP;
5. proposes products and replacements;
6. waits for owner approval;
7. writes approved products to the Silpo basket.

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
5. MiyKo imports up to 100 previous online and offline receipts.
6. Mem0 extracts long-term preferences and recurring patterns.

### Dinner planning

Andrii writes:

> I want carbonara for dinner today. Make enough for two days.

MiyKo:

1. retrieves household and member memory from Mem0;
2. checks relevant previous purchases;
3. estimates the required portions;
4. searches Silpo products through MCP;
5. creates a carbonara basket proposal.

### Household collaboration

The wife adds:

> Please add a dessert.

A child profile requests:

> I want chips instead of ice cream.

MiyKo updates the proposal and pauses before changing the real basket.

The owner can:

- approve the chips;
- replace them;
- reject them;
- approve the remaining basket.

### Purchase

After owner approval, MiyKo calls the Silpo MCP cart tools and adds the confirmed products to the real basket.

### Learning

After purchase, MiyKo stores feedback:

- carbonara was prepared for five portions;
- the household approved occasional dessert;
- some eggs may remain;
- the selected meat quantity was sufficient for two days.

### Follow-up

Two days later, MiyKo sends:

> You may be close to finishing the products from the previous plan. Should I repeat the basket, use the remaining ingredients or create a new three-day plan?

A new planning workflow begins using updated long-term memory.

## 7. Agent Workflow

The Agent Layer runs in LangGraph Cloud. Planning may finish in one run, while the order workflow checkpoints in the managed platform, pauses for provider or household decisions and resumes until basket and delivery choices are complete. It does not bypass owner approval.

```text
food request
  ↓
classify request
  ↓
load member memory and local history
  ↓
plan meals and portions
  ↓
search provider products when connected
  ↓
save local meal plan and optional proposal
  ↓
create durable order workflow
  ↓
provider response / replacement / pickup / delivery choice
  ↓
pause → household decision → resume by thread_id
  ↓
owner approval
  ↓
update provider basket → save local order/delivery
  ↓
feedback event → memory update
```

LangGraph Cloud assigns each proposal workflow its thread and run IDs and preserves workflow state between requests and restarts; LangSmith Cloud traces the run. PostgreSQL stores those external IDs, the provider name and last status observed when an action runs, alongside the approved business decision and final order. It does not store graph checkpoints. Basket application happens from the approval outbox event, so provider failures use the existing retry policy instead of extending the HTTP request. Background workflow-status synchronization is deferred.

## 8. Memory Design

### Mem0 Platform

Mem0 provides managed long-term memory and semantic retrieval.

Memory scopes:

```text
household_id → shared household memory
member_id    → personal preferences
run_id       → specific dinner or shopping session
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
- connected Silpo accounts;
- encrypted OAuth credentials;
- planning-run metadata;
- approval status;
- provider synchronization and outbox events.

Mem0 must never be used as the source of truth for permissions, authentication or purchase authorization.

## 9. Silpo MCP Integration

The backend acts as an MCP client for the official Silpo MCP server.

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

Read operations may run automatically. Any operation that changes the real Silpo basket requires explicit owner approval.

## 10. Authentication

Two authorization layers are required.

### MiyKo authentication

Users authenticate with the MiyKo backend. The backend determines:

- user identity;
- household membership;
- role;
- permissions.

### Silpo authorization

Each connected Silpo account uses the official Silpo OAuth flow.

Silpo access and refresh tokens:

- are stored only on the backend;
- are encrypted at rest;
- are never exposed to React Native;
- are associated with the connected household member.

The household selects which connected Silpo account owns the final shopping basket.

## 11. Technical Architecture

```text
Expo / React Native
        ↓
Hono API — TypeScript
        ├── authentication
        ├── household management
        ├── invitations and roles
        ├── sequential Agent Layer
        ├── provider adapters
        └── outbox worker
                 ↓
        ┌────────┼───────────────┐
        ↓        ↓               ↓
   PostgreSQL  Mem0 Platform  Silpo MCP
```

### Technology stack

- **Mobile:** Expo, React Native, TypeScript.
- **Backend:** Hono, TypeScript.
- **Agent Layer:** sequential model calls behind an API interface.
- **Long-term memory:** Mem0 Hobby plan.
- **Database:** PostgreSQL.
- **MCP:** official Model Context Protocol TypeScript client.
- **Validation:** Zod.
- **Notifications:** Expo Notifications.
- **LLM:** tool-calling model selected during implementation.

Requests should be batched where possible. Receipt ingestion should not create a separate memory request for every individual product.

## 12. Notifications and Scheduling

Follow-up notifications are deferred from the core MVP. If enabled later, the backend can store:

```text
purchase_completed_at
estimated_duration_days
next_check_at
notification_status
planning_run_id
```

A scheduled job may trigger the next planning request at `next_check_at`; it is not part of the current critical path.

## 13. MVP Scope

### Must have

- household creation;
- owner and member roles;
- household invitation;
- one connected Silpo account;
- receipt-history ingestion;
- Mem0 memory extraction and retrieval;
- natural-language meal request;
- real Silpo MCP product search;
- basket proposal;
- member item request;
- owner approve/decline;
- real Silpo basket update;

### Should have

- second connected Silpo account;
- voice input;
- child profile;
- item replacement;
- feedback after purchase;
- intent inbox for future meals.

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

- time from food intent to approved basket;
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
| Stale product availability               | Revalidate products through MCP before cart update                                |
| Unauthorized basket changes              | Require owner approval and backend permission checks                              |
| Sensitive receipt data in cloud services | Minimize payloads, use synthetic demo data and avoid storing OAuth tokens in Mem0 |
| Mem0 retrieval limit                     | Batch receipt ingestion and retrieve memory once per major workflow stage         |
| Workflow becomes too broad               | Demonstrate one strong dinner-to-basket-to-follow-up scenario                     |
| Notification inference is wrong          | Phrase notifications as questions, not factual inventory claims                   |

## 16. Main Differentiator

Mushroom helps users complete a current shopping request.

MiyKo maintains a continuous food-planning relationship:

```text
Mushroom: request → recommendation → basket

MiyKo: memory → intent → collaboration → approval
       → basket → feedback → proactive next cycle
```

MiyKo is not another shopping chat. It is a persistent food-control layer that coordinates people, preferences, purchases and future decisions.
