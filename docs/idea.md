# MiyKo — household food workflows with shared memory

MiyKo is a food AI agent for a household or another group of people. It gives members one shared place to describe what they want, add or change requests and complete an order through clear roles and approvals. A household can be a family, but the same model can also represent an office pizza party, picnic or another temporary group.

The core MVP is one stable workflow that lives from the first request until the basket and fulfillment are confirmed. Authorized members can update it directly; restricted requests pause for owner/admin approval and then resume from the same point. MiyKo coordinates planning, recipe generation and store actions behind the scenes while users see one continuous conversation.

Long-term memory supports the workflow instead of defining the whole product. It belongs to the household and its members rather than a single chat, bringing relevant preferences and previous purchases into every new request—for example, repeating an earlier office pizza order or recognizing the ice cream a child requested last week. Consumption tracking and a fully optimized next-purchase cycle remain future extensions rather than requirements for the demo.

```text
household or temporary group
  → shared request → member changes → approval → provider basket → checkout
                       ↑ reusable memory and previous purchases
```

## Hackathon description (UA)

> «МійКо» — харчовий AI-агент, який перетворює спільні закупівлі сім’ї або групи людей на керовані робочі сценарії — workflows. Для сімейної вечері, офісної pizza party чи пікніка учасники додають побажання в одному чаті, а ролі та погодження визначають, хто може змінити або підтвердити кошик. Workflow зберігається між діями: його можна продовжити пізніше, запланувати на певний час, повторювати регулярно або використати для порівняння кошиків у кількох магазинах-провайдерах. Довготривала пам’ять прив’язана до household і його учасників, а не лише до одного чату: вона враховує вподобання та попередні покупки, дозволяє повторити минуле замовлення або точніше підібрати товари. МійКо допомагає скласти план, виконати заміни, вибрати доставку й довести покупку до оформлення, залишаючи важливі рішення за людиною. Технічно рішення поєднує LangChain і LangGraph для тривалих workflows, Mem0 для довготривалої пам’яті та multi-provider архітектуру для роботи з різними магазинами.

## Workflow directions

`step-order` remains the general MVP workflow. Budget optimization, replacements and fulfillment choices are reusable capabilities inside workflows, not separate workflow kinds.

- `scheduled-order` — activates at a selected time, refreshes availability and prices, then requests confirmation;
- `recurring-order` — periodically prepares a new basket using the previous order and relevant memory;
- `multi-store-order` — builds comparable baskets through several store providers and lets the household choose;
- `delegated-order` — temporarily transfers workflow management and approval authority to another member;
- `consensus-order` — waits for decisions from several required members or an agreed majority before continuing.

## MVP value

- one household owner connects the Silpo account;
- every member works through the same household connection;
- a text or audio request starts a resumable `step-order` workflow;
- member roles determine which changes are direct and which require approval;
- LangGraph keeps the active plan and pauses for later actions;
- Mem0 provides relevant household/member preferences and previous purchase context;
- Silpo MCP owns real products, prices, basket, fulfillment and checkout;
- PostgreSQL stores only identity, permissions, provider binding, workflow references, approvals and outbox delivery state.

## Demo story

```text
owner: “Prepare dinner for us”
  → graph imports a summary of the latest 10 Silpo in-store receipts into Mem0 once
  → initial request stays in graph state; the Silpo basket is untouched
partner/editor: “Add beer”
  → request is added directly to the shared plan
child/viewer: “Add ice cream”
  → graph pauses for owner/admin approval
owner/admin approves
  → request joins the plan
owner/admin: “Prepare the basket”
  → graph calls the official Silpo MCP and shows products, prices and total
owner/admin requests a replacement, pickup/delivery mode or delivery slot
  → graph updates the same real basket
owner opens the returned Silpo checkout link and confirms there
```

Notifications are narrated in the hackathon demo but are not implemented in this MVP.

## Boundaries

MiyKo does not store recipes, meal plans, provider products, basket items, receipts or LangGraph checkpoints. Recipes may be generated when a workflow needs them. Provider reads may be cached later, but the provider remains authoritative and every mutation must re-read current state.

Permissions are deny-by-default. The API supplies authenticated household identity and role; Mem0 and the LLM cannot grant access. Owners and admins can approve and mutate the provider basket, editors can add plan requests directly, and viewer requests require approval. The same roles can be used when the household represents an office team, party or temporary group.

For the local demo, `langgraph dev` keeps pause/resume state in its local development storage across requests and ordinary restarts while that storage is preserved. A hosted or production-like Agent Server is needed later for durability across machine loss and deployment replacement. Silpo authentication is OAuth 2.1 Authorization Code + PKCE; MiyKo must never collect the owner's Silpo password.
