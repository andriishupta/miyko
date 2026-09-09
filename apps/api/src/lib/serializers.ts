import type { AuthUser, Household, HouseholdMember, Membership } from "@miyko/contracts";

type UserRow = { id: string; email: string; firstName?: string; lastName?: string; displayName: string | null };
type MemberRow = { id: string; householdId: string; userId: string; role: "owner" | "admin" | "editor" | "viewer"; status: "active" | "removed"; joinedAt: Date; removedAt: Date | null; user?: UserRow | null };

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

export const toContractUser = (row: UserRow): AuthUser => ({ id: row.id, email: row.email, displayName: row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(" ") || null) });
export const toContractHousehold = (row: { id: string; name: string; ownerId: string; createdAt: Date; updatedAt: Date }): Household => ({ id: row.id, name: row.name, ownerId: row.ownerId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
export const toContractMembership = (row: { id: string; householdId: string; userId: string; role: "owner" | "admin" | "editor" | "viewer"; status: "active" | "removed" }): Membership => ({ id: row.id, householdId: row.householdId, userId: row.userId, role: row.role, status: row.status });
export const toContractMember = (row: MemberRow): HouseholdMember => ({ id: row.id, householdId: row.householdId, userId: row.userId, role: row.role, status: row.status, joinedAt: row.joinedAt.toISOString(), removedAt: iso(row.removedAt), user: row.user ? toContractUser(row.user) : undefined });
