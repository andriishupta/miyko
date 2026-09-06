import { AppError } from '../../lib/errors.js'

export const requireAgentConfig = () => {
  const apiUrl = process.env.LANGGRAPH_API_URL
  const apiKey = process.env.LANGGRAPH_API_KEY
  const workflow = process.env.LANGGRAPH_WORKFLOW
  if (!apiUrl || !apiKey || !workflow) throw new AppError('AGENT_CONFIGURATION_REQUIRED', 'LangGraph Cloud is not configured', 503)
  return { apiUrl, apiKey, workflow }
}
