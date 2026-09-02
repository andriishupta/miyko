import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { requireAgentConfig } from './agent.config.js'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

export const openAiClient = {
  async json<T>(messages: Message[], schema: z.ZodType<T>): Promise<T> {
    const config = requireAgentConfig()
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, response_format: { type: 'json_object' } }),
    })
    if (!response.ok) throw new AppError('AGENT_PROVIDER_FAILED', 'Agent model request failed', 502)
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = body.choices?.[0]?.message?.content
    if (!content) throw new AppError('AGENT_INVALID_RESPONSE', 'Agent model returned an invalid response', 502)
    try {
      const parsed: unknown = JSON.parse(content)
      const checked = schema.safeParse(parsed)
      if (!checked.success) throw new Error('schema')
      return checked.data
    } catch {
      throw new AppError('AGENT_INVALID_RESPONSE', 'Agent model returned an invalid response', 502)
    }
  },
}
