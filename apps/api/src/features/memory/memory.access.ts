import { and, eq } from "drizzle-orm";
import { householdMembers } from "@miyko/database/schema";
import type { RequestContext } from "@miyko/contracts";
import { db } from "../../lib/database.js";
import { forbidden, notFound } from "../../lib/errors.js";

export type MemoryNamespace = string;

export const requireMemoryNamespace = async (context: RequestContext, memberId?: string | null): Promise<MemoryNamespace> => {
  if (!memberId) return `household:${context.household.id}`;
  if (memberId !== context.membership.id && !["owner", "admin"].includes(context.membership.role)) throw forbidden();

  const member = await db.query.householdMembers.findFirst({
    where: and(
      eq(householdMembers.id, memberId),
      eq(householdMembers.householdId, context.household.id),
      eq(householdMembers.status, "active"),
    ),
  });
  if (!member) throw notFound("Household member");

  return `member:${memberId}`;
};
