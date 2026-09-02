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
  searchProducts: (query: string) => Promise<unknown[]>
}

export type FoodIntentResult = {
  threadId: string
  runId: string
  classification: { type: 'meal_planning' | 'shopping' | 'feedback' | 'other'; summary: string; confidence: number } | null
  plan: { title: string; meals: Array<{ name: string; ingredients: string[] }> } | null
  products: unknown[]
}

export interface AgentLayer {
  initializeMemory(input: MemoryInitializationInput): Promise<MemoryInitializationResult>
  foodIntent(input: FoodIntentInput): Promise<FoodIntentResult>
}
