import type { MemoryWriteRequest } from "@miyko/contracts";
import { mem0Client } from "../../integrations/memory/mem0.client.js";
import type { MemoryNamespace } from "./memory.access.js";

export class MemoryService {
  async status() {
    return { provider: "mem0", managed: true };
  }

  async write(namespace: MemoryNamespace, input: MemoryWriteRequest) {
    const externalMemoryId = await mem0Client.add(namespace, input.text, { source: input.source, confirmed: input.confirmed ?? false });
    return { namespace, externalMemoryId };
  }

  async search(namespace: MemoryNamespace, query: string) {
    return mem0Client.search(namespace, query);
  }
}

export const memoryService = new MemoryService();
