import { AppError } from '../../lib/errors.js'

export const requireAgentConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!apiKey || !model) throw new AppError('AGENT_CONFIGURATION_REQUIRED', 'Agent model is not configured', 503)
  return { apiKey, model, endpoint: process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions' }
}
