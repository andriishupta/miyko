import { and, eq } from "drizzle-orm";
import { householdMembers } from "@miyko/database/schema";
import type { MemoryWriteRequest, RequestContext } from "@miyko/contracts";
import { db } from "../../lib/database.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { mem0Client } from "../../integrations/memory/mem0.client.js";

export class MemoryService {
  async status() {
    return { provider: "mem0", managed: true };
  }

  async write(context: RequestContext, input: MemoryWriteRequest) {
    if (input.memberId && input.memberId !== context.membership.id && !["owner", "admin"].includes(context.membership.role)) throw forbidden();
    if (input.memberId) {
      const member = await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, input.memberId), eq(householdMembers.householdId, context.household.id), eq(householdMembers.status, "active")) });
      if (!member) throw notFound("Household member");
    }
    const namespace = input.memberId ? `member:${input.memberId}` : `household:${context.household.id}`;
    const externalMemoryId = await mem0Client.add(namespace, input.text, { source: input.source, confirmed: input.confirmed ?? false });
    return { namespace, externalMemoryId };
  }

  async search(context: RequestContext, query: string, memberId?: string) {
    if (memberId && memberId !== context.membership.id && !["owner", "admin"].includes(context.membership.role)) throw forbidden();
    const namespace = memberId ? `member:${memberId}` : `household:${context.household.id}`;
    return mem0Client.search(namespace, query);
  }
}

export const memoryService = new MemoryService();
