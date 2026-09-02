import { AppError } from '../../lib/errors.js'

export const requireAgentConfig = () => {
  const apiUrl = process.env.LANGGRAPH_API_URL
  const apiKey = process.env.LANGGRAPH_API_KEY
  const assistantId = process.env.LANGGRAPH_ASSISTANT_ID
  if (!apiUrl || !apiKey || !assistantId) throw new AppError('AGENT_CONFIGURATION_REQUIRED', 'LangGraph Cloud is not configured', 503)
  return { apiUrl, apiKey, assistantId }
}
