import { MemoryClient, type Memory } from "mem0ai";

const client = (apiKey: string) => new MemoryClient({ apiKey });

export const householdNamespace = (householdId: string) => `household:${householdId}`;
export const memberNamespace = (memberId: string) => `member:${memberId}`;

export const findMemories = async (apiKey: string, namespace: string, query: string): Promise<Memory[]> => {
  const result = await client(apiKey).search(query, { filters: { user_id: namespace }, topK: 10 });
  return result.results;
};

export const findMemoriesBySource = async (apiKey: string, namespace: string, source: string): Promise<Memory[]> => {
  const result = await client(apiKey).getAll({ filters: { user_id: namespace }, pageSize: 100, latestOnly: true });
  return result.results.filter((item) => item.metadata?.source === source);
};

export const remember = async (apiKey: string, namespace: string, content: string, metadata: Record<string, string>): Promise<void> => {
  await client(apiKey).add([{ role: "user", content }], { userId: namespace, metadata: { ...metadata, namespace } });
};
