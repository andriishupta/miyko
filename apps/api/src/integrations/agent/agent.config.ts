import { AppError } from '../../lib/errors.js'
import { WORKFLOW_KIND, type WorkflowKind } from '@miyko/contracts'

const graphByWorkflowKind: Record<WorkflowKind, string> = {
  [WORKFLOW_KIND.stepOrder]: WORKFLOW_KIND.stepOrder,
}

export const requireAgentConfig = (workflowKind: WorkflowKind) => {
  const apiUrl = process.env.LANGGRAPH_API_URL
  const apiKey = process.env.LANGGRAPH_API_KEY?.trim()
  const workflow = graphByWorkflowKind[workflowKind]
  if (!apiUrl || !workflow) throw new AppError('AGENT_CONFIGURATION_REQUIRED', 'LangGraph Agent Server is not configured', 503)
  return { apiUrl, apiKey, workflow }
}
