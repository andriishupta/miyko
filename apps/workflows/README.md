# MiyKo workflows

Local LangGraph application for MiyKo. The graph slug is the hardcoded workflow kind `step-order`; it is not configuration.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add `OPENAI_API_KEY` and `MEM0_API_KEY`. LangSmith Cloud tracing is not required. The Silpo token is not a workflow environment variable.
3. Install workspace dependencies with `pnpm install` from the repository root.
4. Start this app with `pnpm --filter @miyko/workflows dev`.
5. Set the API environment to `LANGGRAPH_API_URL=http://127.0.0.1:2024`. A LangGraph API key is not required for the local server.

The local Agent Server owns graph checkpoints. MiyKo PostgreSQL does not contain a LangGraph checkpointer. The initial request and member additions remain in graph state until the order flow ends; Mem0 stores reusable household context and the summary of the latest ten Silpo online orders. `langgraph dev` persists development state to its local directory, which is enough for the recorded demo if that directory is kept. Hosted or production-like LangGraph is needed later for durability across machine loss or replacement.

Silpo currently exposes basket operations and checkout links, not a final place-order tool. `step-order` therefore prepares and updates the real basket, then returns its checkout link for the owner to finish in Silpo. Before every start/resume, the API resolves the household owner's encrypted OAuth credential and passes the access token as runtime-only context, outside graph state and Mem0.

The workflow writes JSON lines to stdout for OpenAI classification/model calls, discovered Silpo tools, every MCP tool start/completion and the final basket summary. Prompts, tool arguments and credentials are deliberately excluded. Read them in the workflow terminal; the same stdout is available through `docker logs` if this process is containerized later.
