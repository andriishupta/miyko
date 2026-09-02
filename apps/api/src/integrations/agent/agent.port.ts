export type MemoryInitializationInput = {
  namespace: string
  receipts: unknown[]
  memoryId?: string | null
}

export type MemoryInitializationResult = {
  threadId: string
  runId: string
  memoryId: string | null
  analysis: { summary: string; preferences: string[] } | null
}

export type FoodIntentInput = {
  text: string
  namespace: string
  providerHistory: unknown[]
}

export type FoodIntentResult = {
  threadId: string
  runId: string
  classification: { type: 'meal_planning' | 'shopping' | 'feedback' | 'other'; summary: string; confidence: number } | null
  plan: { title: string; meals: Array<{ name: string; ingredients: string[] }> } | null
  productQueries: string[]
}

export type OrderWorkflowInput = {
  proposalId: string
  householdId: string
  eventId: string
  decision?: 'approved' | 'declined'
  proposal?: unknown
}

export type WorkflowReference = {
  provider: 'langgraph'
  threadId: string
  runId: string
  status: 'pending' | 'running' | 'error' | 'success' | 'timeout' | 'interrupted'
}

export interface AgentLayer {
  initializeMemory(input: MemoryInitializationInput): Promise<MemoryInitializationResult>
  foodIntent(input: FoodIntentInput): Promise<FoodIntentResult>
  startOrderWorkflow(input: OrderWorkflowInput): Promise<WorkflowReference>
  resumeOrderWorkflow(input: OrderWorkflowInput & { threadId: string; decision: 'approved' | 'declined' }): Promise<WorkflowReference>
}
