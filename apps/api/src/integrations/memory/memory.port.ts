export type MemoryMetadata = Record<string, string>

export interface MemoryProvider {
  add(namespace: string, content: string, metadata: MemoryMetadata): Promise<string>
  search(namespace: string, query: string, limit?: number): Promise<unknown[]>
  update(namespace: string, memoryId: string, content: string): Promise<void>
}
