import { and, desc, eq, inArray } from "drizzle-orm";
import { connectedProviderAccounts, householdMembers, workflows } from "@miyko/database/schema";
import type { DashboardResponse, RequestContext } from "@miyko/contracts";
import { db } from "../../lib/database.js";
import { toWorkflow } from "../workflows/workflows.service.js";

export class DashboardService {
  async getDashboard(context: RequestContext): Promise<DashboardResponse> {
    const [workflowRows, memberRows, providerConnections] = await Promise.all([
      db.query.workflows.findMany({ where: and(eq(workflows.householdId, context.household.id), inArray(workflows.status, ["pending", "running", "interrupted"])), with: { approvals: true }, orderBy: [desc(workflows.updatedAt)], limit: 10 }),
      db.query.householdMembers.findMany({ where: and(eq(householdMembers.householdId, context.household.id), eq(householdMembers.status, "active")) }),
      db.query.connectedProviderAccounts.findMany({ where: and(eq(connectedProviderAccounts.householdId, context.household.id), eq(connectedProviderAccounts.status, "active")) }),
    ]);
    const activeWorkflows = workflowRows.map(toWorkflow);
    return {
      household: context.household,
      activeWorkflows,
      householdSummary: {
        memberCount: memberRows.length,
        connectedProviders: providerConnections.length,
        pendingApprovals: activeWorkflows.reduce((count, workflow) => count + workflow.approvals.filter((approval) => approval.status === "pending").length, 0),
      },
      input: { audioEnabled: true, chatEnabled: true },
    };
  }
}

export const dashboardService = new DashboardService();
