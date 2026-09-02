# `@miyko/contracts`

Public serialized contracts shared by the Hono API and Expo app. They cover auth, households, provider connections, workflow references/projections, approvals, memory and dashboard responses.

Recipe, product, basket, fulfillment and order payloads are intentionally not contracts here: they are owned by the managed LangGraph/Silpo MCP workflow and must not become a second local domain model. Workflow status and external IDs exposed here are last-observed references, not authoritative provider state.

Workflow actions carry typed fulfillment or delivery choices, or a provider intent/request reference. They do not carry MCP command names or arbitrary tool arguments. Approval and decline actions always target an explicit `approvalId`.
