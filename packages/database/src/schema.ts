import { relations, sql } from "drizzle-orm";
import {
  bytea,
  check,
  integer,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

const now = (name: string) => timestamp(name, { withTimezone: true, mode: "date" }).notNull().defaultNow();
const optionalDate = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const currentUserId = () => sql`public.miyko_current_user_id()`;
const currentUserEmail = () => sql`public.miyko_current_user_email()`;
const isMember = (householdId: AnyPgColumn) => sql`public.miyko_is_household_member(${householdId})`;
const canAcceptInvitation = (householdId: AnyPgColumn) => sql`public.miyko_can_accept_household_invitation(${householdId})`;

const householdPolicies = (name: string, householdId: AnyPgColumn) => [
  pgPolicy(`${name}_select`, { for: "select", using: isMember(householdId) }),
  pgPolicy(`${name}_insert`, { for: "insert", withCheck: isMember(householdId) }),
  pgPolicy(`${name}_update`, { for: "update", using: isMember(householdId), withCheck: isMember(householdId) }),
  pgPolicy(`${name}_delete`, { for: "delete", using: isMember(householdId) }),
];

export const accountStatusEnum = pgEnum("account_status", ["active", "suspended", "deactivated"]);
export const householdRoleEnum = pgEnum("household_role", ["owner", "admin", "editor", "viewer"]);
export const membershipStatusEnum = pgEnum("membership_status", ["active", "removed"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "declined", "expired", "revoked"]);
export const providerStatusEnum = pgEnum("provider_status", ["active", "inactive"]);
export const providerAuthMethodEnum = pgEnum("provider_auth_method", ["mcp"]);
export const providerAccountStatusEnum = pgEnum("provider_account_status", ["active", "expired", "revoked", "reconnect_required"]);
export const providerSecretKindEnum = pgEnum("provider_secret_kind", ["access_token", "refresh_token"]);
export const workflowStatusEnum = pgEnum("workflow_status", ["pending", "running", "interrupted", "succeeded", "failed", "cancelled"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "declined"]);
export const workflowActionEnum = pgEnum("workflow_action", ["provider_action", "fulfillment", "delivery_slot"]);
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "processing", "published", "retrying", "dead_letter"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull(),
  normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 200 }),
  status: accountStatusEnum("status").notNull().default("active"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
  lastLoginAt: optionalDate("last_login_at"),
}, (table) => [
  uniqueIndex("users_normalized_email_uq").on(table.normalizedEmail),
  index("users_status_idx").on(table.status),
  pgPolicy("users_select_own", { for: "select", using: sql`${table.id} = ${currentUserId()}` }),
  pgPolicy("users_update_own", { for: "update", using: sql`${table.id} = ${currentUserId()}`, withCheck: sql`${table.id} = ${currentUserId()}` }),
]).enableRLS();

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  revokedAt: optionalDate("revoked_at"),
  createdAt: now("created_at"),
  lastUsedAt: optionalDate("last_used_at"),
}, (table) => [
  uniqueIndex("user_sessions_token_hash_uq").on(table.tokenHash),
  index("user_sessions_user_active_idx").on(table.userId, table.expiresAt).where(sql`${table.revokedAt} IS NULL`),
  check("user_sessions_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  pgPolicy("user_sessions_select_own", { for: "select", using: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_sessions_insert_own", { for: "insert", withCheck: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_sessions_update_own", { for: "update", using: sql`${table.userId} = ${currentUserId()}`, withCheck: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_sessions_delete_own", { for: "delete", using: sql`${table.userId} = ${currentUserId()}` }),
]).enableRLS();

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  index("households_owner_id_idx").on(table.ownerId),
  pgPolicy("households_select", { for: "select", using: sql`${table.ownerId} = ${currentUserId()} OR ${isMember(table.id)}` }),
  pgPolicy("households_insert", { for: "insert", withCheck: sql`${table.ownerId} = ${currentUserId()}` }),
  pgPolicy("households_update", { for: "update", using: isMember(table.id), withCheck: isMember(table.id) }),
  pgPolicy("households_delete", { for: "delete", using: isMember(table.id) }),
]).enableRLS();

export const householdMembers = pgTable("household_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: householdRoleEnum("role").notNull().default("viewer"),
  status: membershipStatusEnum("status").notNull().default("active"),
  joinedAt: now("joined_at"),
  removedAt: optionalDate("removed_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  uniqueIndex("household_members_household_user_uq").on(table.householdId, table.userId),
  uniqueIndex("household_members_one_active_owner_uq").on(table.householdId).where(sql`${table.status} = 'active' AND ${table.role} = 'owner'`),
  index("household_members_user_active_idx").on(table.userId, table.householdId).where(sql`${table.status} = 'active'`),
  index("household_members_household_active_idx").on(table.householdId, table.status),
  check("household_members_removed_at_consistency", sql`(${table.status} = 'active' AND ${table.removedAt} IS NULL) OR (${table.status} = 'removed' AND ${table.removedAt} IS NOT NULL)`),
  pgPolicy("household_members_select", { for: "select", using: sql`${table.userId} = ${currentUserId()} OR ${isMember(table.householdId)}` }),
  pgPolicy("household_members_insert", { for: "insert", withCheck: sql`(${isMember(table.householdId)} OR ${canAcceptInvitation(table.householdId)} OR (public.miyko_can_bootstrap_household(${table.householdId}) AND ${table.userId} = ${currentUserId()}))` }),
  pgPolicy("household_members_update", { for: "update", using: sql`${isMember(table.householdId)} OR (${table.userId} = ${currentUserId()} AND ${canAcceptInvitation(table.householdId)})`, withCheck: sql`${isMember(table.householdId)} OR (${table.userId} = ${currentUserId()} AND ${canAcceptInvitation(table.householdId)})` }),
  pgPolicy("household_members_delete", { for: "delete", using: isMember(table.householdId) }),
]).enableRLS();

export const householdInvitations = pgTable("household_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  inviterId: uuid("inviter_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  inviteeUserId: uuid("invitee_user_id").references(() => users.id, { onDelete: "set null" }),
  inviteeEmail: varchar("invitee_email", { length: 320 }),
  role: householdRoleEnum("role").notNull().default("viewer"),
  tokenHash: text("token_hash").notNull(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  acceptedAt: optionalDate("accepted_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  uniqueIndex("household_invitations_token_hash_uq").on(table.tokenHash),
  index("household_invitations_household_status_idx").on(table.householdId, table.status),
  index("household_invitations_invitee_email_idx").on(table.inviteeEmail),
  check("household_invitations_invitee_identity_check", sql`${table.inviteeUserId} IS NOT NULL OR ${table.inviteeEmail} IS NOT NULL`),
  pgPolicy("household_invitations_select", { for: "select", using: sql`${isMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}` }),
  pgPolicy("household_invitations_insert", { for: "insert", withCheck: isMember(table.householdId) }),
  pgPolicy("household_invitations_update", { for: "update", using: sql`${isMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}`, withCheck: sql`${isMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}` }),
  pgPolicy("household_invitations_delete", { for: "delete", using: isMember(table.householdId) }),
]).enableRLS();

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  status: providerStatusEnum("status").notNull().default("active"),
  capabilities: text("capabilities").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  uniqueIndex("providers_slug_uq").on(table.slug),
  uniqueIndex("providers_name_uq").on(table.name),
  pgPolicy("providers_select_active", { for: "select", using: sql`${table.status} = 'active'` }),
]).enableRLS();

export const userProviderAccounts = pgTable("user_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  providerSubject: varchar("provider_subject", { length: 255 }),
  accountLogin: varchar("account_login", { length: 320 }),
  authMethod: providerAuthMethodEnum("auth_method").notNull(),
  status: providerAccountStatusEnum("status").notNull().default("active"),
  scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
  accessTokenExpiresAt: optionalDate("access_token_expires_at"),
  refreshTokenExpiresAt: optionalDate("refresh_token_expires_at"),
  lastUsedAt: optionalDate("last_used_at"),
  metadata: jsonb("metadata").$type<JsonObject>(),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  uniqueIndex("user_providers_user_provider_subject_uq").on(table.userId, table.providerId, table.providerSubject),
  index("user_providers_user_status_idx").on(table.userId, table.status),
  pgPolicy("user_providers_select_own", { for: "select", using: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_providers_insert_own", { for: "insert", withCheck: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_providers_update_own", { for: "update", using: sql`${table.userId} = ${currentUserId()}`, withCheck: sql`${table.userId} = ${currentUserId()}` }),
  pgPolicy("user_providers_delete_own", { for: "delete", using: sql`${table.userId} = ${currentUserId()}` }),
]).enableRLS();

export const providerSecrets = pgTable("provider_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userProviderAccountId: uuid("user_provider_account_id").notNull().references(() => userProviderAccounts.id, { onDelete: "cascade" }),
  kind: providerSecretKindEnum("kind").notNull(),
  encryptedValue: bytea("encrypted_value").notNull(),
  keyVersion: varchar("key_version", { length: 64 }).notNull(),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  uniqueIndex("provider_secrets_account_kind_uq").on(table.userProviderAccountId, table.kind),
  pgPolicy("provider_secrets_select_own", { for: "select", using: sql`EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = ${table.userProviderAccountId} AND account.user_id = public.miyko_current_user_id())` }),
  pgPolicy("provider_secrets_insert_own", { for: "insert", withCheck: sql`EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = ${table.userProviderAccountId} AND account.user_id = public.miyko_current_user_id())` }),
  pgPolicy("provider_secrets_update_own", { for: "update", using: sql`EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = ${table.userProviderAccountId} AND account.user_id = public.miyko_current_user_id())`, withCheck: sql`EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = ${table.userProviderAccountId} AND account.user_id = public.miyko_current_user_id())` }),
  pgPolicy("provider_secrets_delete_own", { for: "delete", using: sql`EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = ${table.userProviderAccountId} AND account.user_id = public.miyko_current_user_id())` }),
]).enableRLS();

export const connectedProviderAccounts = pgTable("connected_provider_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  userProviderAccountId: uuid("user_provider_account_id").notNull().references(() => userProviderAccounts.id, { onDelete: "cascade" }),
  authorizedByMemberId: uuid("authorized_by_member_id").notNull().references(() => householdMembers.id, { onDelete: "restrict" }),
  status: providerAccountStatusEnum("status").notNull().default("active"),
  revokedAt: optionalDate("revoked_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  ...householdPolicies("connected_provider_accounts", table.householdId),
  uniqueIndex("connected_provider_accounts_household_provider_uq").on(table.householdId, table.providerId),
  index("connected_provider_accounts_household_status_idx").on(table.householdId, table.status),
]);

/** A small application projection. LangGraph owns state, messages, basket data and checkpoints. */
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  startedByMemberId: uuid("started_by_member_id").notNull().references(() => householdMembers.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  status: workflowStatusEnum("status").notNull().default("pending"),
  threadId: varchar("thread_id", { length: 255 }).notNull(),
  runId: varchar("run_id", { length: 255 }),
  providerBasketId: varchar("provider_basket_id", { length: 255 }),
  providerOrderId: varchar("provider_order_id", { length: 255 }),
  fulfillmentMode: varchar("fulfillment_mode", { length: 16 }).$type<"pickup" | "delivery">(),
  scheduledFrom: optionalDate("scheduled_from"),
  scheduledTo: optionalDate("scheduled_to"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  ...householdPolicies("workflows", table.householdId),
  uniqueIndex("workflows_thread_uq").on(table.threadId),
  index("workflows_household_status_idx").on(table.householdId, table.status),
  check("workflows_scheduled_window_check", sql`${table.scheduledTo} IS NULL OR ${table.scheduledFrom} IS NULL OR ${table.scheduledTo} >= ${table.scheduledFrom}`),
]);

export const workflowApprovals = pgTable("workflow_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  requestedByMemberId: uuid("requested_by_member_id").notNull().references(() => householdMembers.id, { onDelete: "restrict" }),
  externalRequestId: varchar("external_request_id", { length: 255 }),
  action: workflowActionEnum("action").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  decidedByMemberId: uuid("decided_by_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
  decidedAt: optionalDate("decided_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  ...householdPolicies("workflow_approvals", table.householdId),
  index("workflow_approvals_workflow_status_idx").on(table.workflowId, table.status),
  uniqueIndex("workflow_approvals_external_request_uq").on(table.workflowId, table.externalRequestId),
  check("workflow_approvals_decision_consistency", sql`(${table.status} = 'pending' AND ${table.decidedAt} IS NULL AND ${table.decidedByMemberId} IS NULL) OR (${table.status} IN ('approved', 'declined') AND ${table.decidedAt} IS NOT NULL AND ${table.decidedByMemberId} IS NOT NULL)`),
]);

/** Delivery transport for workflow actions. */
export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  version: integer("version").notNull().default(1),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  status: outboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: now("available_at"),
  claimedAt: optionalDate("claimed_at"),
  claimedBy: varchar("claimed_by", { length: 120 }),
  claimExpiresAt: optionalDate("claim_expires_at"),
  processedAt: optionalDate("processed_at"),
  lastError: text("last_error"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (table) => [
  ...householdPolicies("outbox_events", table.householdId),
  uniqueIndex("outbox_events_aggregate_transition_uq").on(table.aggregateType, table.aggregateId, table.eventType, table.version),
  index("outbox_events_claim_idx").on(table.status, table.availableAt, table.claimExpiresAt),
  check("outbox_events_claim_consistency", sql`(${table.claimedAt} IS NULL AND ${table.claimedBy} IS NULL AND ${table.claimExpiresAt} IS NULL) OR (${table.claimedAt} IS NOT NULL AND ${table.claimedBy} IS NOT NULL AND ${table.claimExpiresAt} IS NOT NULL)`),
]).enableRLS();

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  actorMemberId: uuid("actor_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  metadata: jsonb("metadata").$type<JsonObject>(),
  createdAt: now("created_at"),
}, (table) => [
  ...householdPolicies("audit_logs", table.householdId),
  index("audit_logs_household_created_idx").on(table.householdId, table.createdAt),
  index("audit_logs_aggregate_idx").on(table.aggregateType, table.aggregateId),
]).enableRLS();

export const usersRelations = relations(users, ({ many }) => ({ sessions: many(userSessions), memberships: many(householdMembers), providerAccounts: many(userProviderAccounts) }));
export const userSessionsRelations = relations(userSessions, ({ one }) => ({ user: one(users, { fields: [userSessions.userId], references: [users.id] }) }));
export const householdsRelations = relations(households, ({ one, many }) => ({ owner: one(users, { fields: [households.ownerId], references: [users.id] }), members: many(householdMembers), invitations: many(householdInvitations), providerConnections: many(connectedProviderAccounts), workflows: many(workflows), approvals: many(workflowApprovals), outboxEvents: many(outboxEvents), auditLogs: many(auditLogs) }));
export const householdMembersRelations = relations(householdMembers, ({ one, many }) => ({ household: one(households, { fields: [householdMembers.householdId], references: [households.id] }), user: one(users, { fields: [householdMembers.userId], references: [users.id] }), workflows: many(workflows), requestedApprovals: many(workflowApprovals, { relationName: "requestedApprovals" }), decidedApprovals: many(workflowApprovals, { relationName: "decidedApprovals" }) }));
export const householdInvitationsRelations = relations(householdInvitations, ({ one }) => ({ household: one(households, { fields: [householdInvitations.householdId], references: [households.id] }), inviter: one(users, { fields: [householdInvitations.inviterId], references: [users.id] }), invitee: one(users, { fields: [householdInvitations.inviteeUserId], references: [users.id] }) }));
export const providersRelations = relations(providers, ({ many }) => ({ accounts: many(userProviderAccounts), connections: many(connectedProviderAccounts), workflows: many(workflows) }));
export const userProviderAccountsRelations = relations(userProviderAccounts, ({ one, many }) => ({ user: one(users, { fields: [userProviderAccounts.userId], references: [users.id] }), provider: one(providers, { fields: [userProviderAccounts.providerId], references: [providers.id] }), secrets: many(providerSecrets), connections: many(connectedProviderAccounts) }));
export const providerSecretsRelations = relations(providerSecrets, ({ one }) => ({ account: one(userProviderAccounts, { fields: [providerSecrets.userProviderAccountId], references: [userProviderAccounts.id] }) }));
export const connectedProviderAccountsRelations = relations(connectedProviderAccounts, ({ one }) => ({ household: one(households, { fields: [connectedProviderAccounts.householdId], references: [households.id] }), provider: one(providers, { fields: [connectedProviderAccounts.providerId], references: [providers.id] }), userProviderAccount: one(userProviderAccounts, { fields: [connectedProviderAccounts.userProviderAccountId], references: [userProviderAccounts.id] }), authorizedByMember: one(householdMembers, { fields: [connectedProviderAccounts.authorizedByMemberId], references: [householdMembers.id] }) }));
export const workflowsRelations = relations(workflows, ({ one, many }) => ({ household: one(households, { fields: [workflows.householdId], references: [households.id] }), startedByMember: one(householdMembers, { fields: [workflows.startedByMemberId], references: [householdMembers.id] }), provider: one(providers, { fields: [workflows.providerId], references: [providers.id] }), approvals: many(workflowApprovals) }));
export const workflowApprovalsRelations = relations(workflowApprovals, ({ one }) => ({ household: one(households, { fields: [workflowApprovals.householdId], references: [households.id] }), workflow: one(workflows, { fields: [workflowApprovals.workflowId], references: [workflows.id] }), requestedByMember: one(householdMembers, { fields: [workflowApprovals.requestedByMemberId], references: [householdMembers.id], relationName: "requestedApprovals" }), decidedByMember: one(householdMembers, { fields: [workflowApprovals.decidedByMemberId], references: [householdMembers.id], relationName: "decidedApprovals" }) }));
export const outboxEventsRelations = relations(outboxEvents, ({ one }) => ({ household: one(households, { fields: [outboxEvents.householdId], references: [households.id] }) }));
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({ household: one(households, { fields: [auditLogs.householdId], references: [households.id] }), actorMember: one(householdMembers, { fields: [auditLogs.actorMemberId], references: [householdMembers.id] }) }));

export const schema = {
  users, userSessions, households, householdMembers, householdInvitations,
  providers, userProviderAccounts, providerSecrets, connectedProviderAccounts,
  workflows, workflowApprovals, outboxEvents, auditLogs,
  usersRelations, userSessionsRelations, householdsRelations, householdMembersRelations,
  householdInvitationsRelations, providersRelations, userProviderAccountsRelations,
  providerSecretsRelations, connectedProviderAccountsRelations,
  workflowsRelations, workflowApprovalsRelations, outboxEventsRelations,
  auditLogsRelations,
};

export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowApproval = typeof workflowApprovals.$inferSelect;
