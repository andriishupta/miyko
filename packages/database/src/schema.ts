import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** JSON kept in Postgres is deliberately untyped at runtime and validated at the API boundary. */
export type JsonObject = Record<string, unknown>;

const timestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).notNull().defaultNow();

const optionalTimestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

const currentUserId = () => sql`public.miyko_current_user_id()`;
const currentUserEmail = () => sql`public.miyko_current_user_email()`;

const isHouseholdMember = (householdId: AnyPgColumn) =>
  sql`public.miyko_is_household_member(${householdId})`;

const canAcceptHouseholdInvitation = (householdId: AnyPgColumn) =>
  sql`public.miyko_can_accept_household_invitation(${householdId})`;

const householdCrudPolicies = (name: string, householdId: AnyPgColumn) => [
  pgPolicy(`${name}_select`, {
    for: "select",
    using: isHouseholdMember(householdId),
  }),
  pgPolicy(`${name}_insert`, {
    for: "insert",
    withCheck: isHouseholdMember(householdId),
  }),
  pgPolicy(`${name}_update`, {
    for: "update",
    using: isHouseholdMember(householdId),
    withCheck: isHouseholdMember(householdId),
  }),
  pgPolicy(`${name}_delete`, {
    for: "delete",
    using: isHouseholdMember(householdId),
  }),
];

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
  "deactivated",
]);

export const householdRoleEnum = pgEnum("household_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "removed",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
]);

export const intentStatusEnum = pgEnum("intent_status", [
  "active",
  "planned",
  "completed",
  "cancelled",
]);

export const intentSourceEnum = pgEnum("intent_source", ["text", "audio"]);

export const planningRunStatusEnum = pgEnum("planning_run_status", [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const mealPlanStatusEnum = pgEnum("meal_plan_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
]);

export const mealPlanItemTypeEnum = pgEnum("meal_plan_item_type", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "other",
]);

export const feedbackKindEnum = pgEnum("feedback_kind", [
  "quantity",
  "leftover",
  "liked",
  "repeat",
  "general",
]);

export const providerAccountStatusEnum = pgEnum("provider_account_status", [
  "active",
  "expired",
  "revoked",
  "reconnect_required",
]);

export const providerKindEnum = pgEnum("provider_kind", ["store", "delivery"]);

export const providerStatusEnum = pgEnum("provider_status", ["active", "inactive"]);

export const providerAuthMethodEnum = pgEnum("provider_auth_method", [
  "oauth",
  "password",
  "api_key",
  "mcp",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "awaiting_changes",
  "awaiting_owner_approval",
  "approved",
  "declined",
  "applied",
  "failed",
]);

export const proposalItemStatusEnum = pgEnum("proposal_item_status", [
  "proposed",
  "approved",
  "declined",
  "replaced",
  "edited",
]);

export const proposalSuggestionTypeEnum = pgEnum("proposal_suggestion_type", [
  "add",
  "replace",
  "quantity_change",
  "decline",
]);

export const proposalDecisionEnum = pgEnum("proposal_decision", [
  "approve",
  "decline",
  "replace",
  "edit",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "approved",
  "syncing",
  "in_cart",
  "placed",
  "completed",
  "cancelled",
  "failed",
]);

export const orderItemStatusEnum = pgEnum("order_item_status", [
  "pending",
  "approved",
  "declined",
  "replaced",
  "added",
  "unavailable",
  "cancelled",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "scheduled",
  "in_transit",
  "delivered",
  "cancelled",
  "failed",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "published",
  "retrying",
  "dead_letter",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

export const memoryScopeEnum = pgEnum("memory_scope", [
  "household",
  "member",
  "planning_run",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    status: accountStatusEnum("status").notNull().default("active"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
    lastLoginAt: optionalTimestampColumn("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_normalized_email_uq").on(table.normalizedEmail),
    index("users_status_idx").on(table.status),
    pgPolicy("users_select_own", {
      for: "select",
      using: sql`${table.id} = ${currentUserId()}`,
    }),
    pgPolicy("users_update_own", {
      for: "update",
      using: sql`${table.id} = ${currentUserId()}`,
      withCheck: sql`${table.id} = ${currentUserId()}`,
    }),
  ],
).enableRLS();

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: optionalTimestampColumn("revoked_at"),
    createdAt: timestampColumn("created_at"),
    lastUsedAt: optionalTimestampColumn("last_used_at"),
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_uq").on(table.tokenHash),
    index("user_sessions_user_active_idx")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} IS NULL`),
    index("user_sessions_expiry_idx").on(table.expiresAt),
    check(
      "user_sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    pgPolicy("user_sessions_select_own", {
      for: "select",
      using: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_sessions_insert_own", {
      for: "insert",
      withCheck: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_sessions_update_own", {
      for: "update",
      using: sql`${table.userId} = ${currentUserId()}`,
      withCheck: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_sessions_delete_own", {
      for: "delete",
      using: sql`${table.userId} = ${currentUserId()}`,
    }),
  ],
).enableRLS();

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    index("households_owner_id_idx").on(table.ownerId),
    pgPolicy("households_select", {
      for: "select",
      using: sql`${table.ownerId} = ${currentUserId()} OR ${isHouseholdMember(table.id)}`,
    }),
    pgPolicy("households_insert", {
      for: "insert",
      withCheck: sql`${table.ownerId} = ${currentUserId()}`,
    }),
    pgPolicy("households_update", {
      for: "update",
      using: isHouseholdMember(table.id),
      withCheck: isHouseholdMember(table.id),
    }),
    pgPolicy("households_delete", {
      for: "delete",
      using: isHouseholdMember(table.id),
    }),
  ],
).enableRLS();

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: householdRoleEnum("role").notNull().default("viewer"),
    status: membershipStatusEnum("status").notNull().default("active"),
    joinedAt: timestampColumn("joined_at"),
    removedAt: optionalTimestampColumn("removed_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("household_members_household_user_uq").on(
      table.householdId,
      table.userId,
    ),
    uniqueIndex("household_members_one_active_owner_uq")
      .on(table.householdId)
      .where(sql`${table.status} = 'active' AND ${table.role} = 'owner'`),
    index("household_members_user_active_idx")
      .on(table.userId, table.householdId)
      .where(sql`${table.status} = 'active'`),
    index("household_members_household_active_idx").on(table.householdId, table.status),
    check(
      "household_members_removed_at_consistency",
      sql`(${table.status} = 'active' AND ${table.removedAt} IS NULL) OR (${table.status} = 'removed' AND ${table.removedAt} IS NOT NULL)`,
    ),
    pgPolicy("household_members_select", {
      for: "select",
      using: sql`${table.userId} = ${currentUserId()} OR ${isHouseholdMember(table.householdId)}`,
    }),
    pgPolicy("household_members_insert", {
      for: "insert",
      withCheck: sql`(
        ${isHouseholdMember(table.householdId)}
        OR ${canAcceptHouseholdInvitation(table.householdId)}
        OR (
          public.miyko_can_bootstrap_household(${table.householdId})
          AND ${table.userId} = ${currentUserId()}
        )
      )`,
    }),
    pgPolicy("household_members_update", {
      for: "update",
      using: sql`${isHouseholdMember(table.householdId)} OR (${table.userId} = ${currentUserId()} AND ${canAcceptHouseholdInvitation(table.householdId)})`,
      withCheck: sql`${isHouseholdMember(table.householdId)} OR (${table.userId} = ${currentUserId()} AND ${canAcceptHouseholdInvitation(table.householdId)})`,
    }),
    pgPolicy("household_members_delete", {
      for: "delete",
      using: isHouseholdMember(table.householdId),
    }),
  ],
).enableRLS();

export const householdInvitations = pgTable(
  "household_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    inviteeUserId: uuid("invitee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inviteeEmail: varchar("invitee_email", { length: 320 }),
    role: householdRoleEnum("role").notNull().default("viewer"),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedAt: optionalTimestampColumn("accepted_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("household_invitations_token_hash_uq").on(table.tokenHash),
    index("household_invitations_household_status_idx").on(
      table.householdId,
      table.status,
    ),
    index("household_invitations_invitee_email_idx").on(table.inviteeEmail),
    check(
      "household_invitations_invitee_identity_check",
      sql`${table.inviteeUserId} IS NOT NULL OR ${table.inviteeEmail} IS NOT NULL`,
    ),
    pgPolicy("household_invitations_select", {
      for: "select",
      using: sql`${isHouseholdMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}`,
    }),
    pgPolicy("household_invitations_insert", {
      for: "insert",
      withCheck: isHouseholdMember(table.householdId),
    }),
    pgPolicy("household_invitations_update", {
      for: "update",
      using: sql`${isHouseholdMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}`,
      withCheck: sql`${isHouseholdMember(table.householdId)} OR ${table.inviteeUserId} = ${currentUserId()} OR ${table.inviteeEmail} = ${currentUserEmail()}`,
    }),
    pgPolicy("household_invitations_delete", {
      for: "delete",
      using: isHouseholdMember(table.householdId),
    }),
  ],
).enableRLS();

export const shoppingProviders = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    kind: providerKindEnum("kind").notNull().default("store"),
    status: providerStatusEnum("status").notNull().default("active"),
    capabilities: text("capabilities").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("shopping_providers_slug_uq").on(table.slug),
    uniqueIndex("shopping_providers_name_uq").on(table.name),
  ],
);

/**
 * A user's account at an external provider. Credentials are references into
 * server-side secret storage; raw passwords and access tokens never belong in
 * this table or in shared contracts.
 */
export const userProviderAccounts = pgTable(
  "user_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    providerSubject: varchar("provider_subject", { length: 255 }),
    accountLogin: varchar("account_login", { length: 320 }),
    authMethod: providerAuthMethodEnum("auth_method").notNull(),
    status: providerAccountStatusEnum("status").notNull().default("active"),
    accessTokenReference: text("access_token_reference"),
    refreshTokenReference: text("refresh_token_reference"),
    credentialReference: text("credential_reference"),
    scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
    accessTokenExpiresAt: optionalTimestampColumn("access_token_expires_at"),
    refreshTokenExpiresAt: optionalTimestampColumn("refresh_token_expires_at"),
    lastUsedAt: optionalTimestampColumn("last_used_at"),
    metadata: jsonb("metadata").$type<JsonObject>(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("user_providers_user_provider_subject_uq").on(
      table.userId,
      table.providerId,
      table.providerSubject,
    ),
    index("user_providers_user_status_idx").on(table.userId, table.status),
    index("user_providers_provider_status_idx").on(table.providerId, table.status),
    pgPolicy("user_providers_select_own", {
      for: "select",
      using: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_providers_insert_own", {
      for: "insert",
      withCheck: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_providers_update_own", {
      for: "update",
      using: sql`${table.userId} = ${currentUserId()}`,
      withCheck: sql`${table.userId} = ${currentUserId()}`,
    }),
    pgPolicy("user_providers_delete_own", {
      for: "delete",
      using: sql`${table.userId} = ${currentUserId()}`,
    }),
  ],
).enableRLS();

export const providerProducts = pgTable(
  "provider_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    providerProductId: varchar("provider_product_id", { length: 255 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 400 }).notNull(),
    details: jsonb("details").$type<JsonObject>(),
    lastSeenAt: timestampColumn("last_seen_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("provider_products_provider_external_id_uq").on(
      table.providerId,
      table.providerProductId,
    ),
    index("provider_products_name_idx").on(table.normalizedName),
  ],
);

export const foodIntents = pgTable(
  "food_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    submittedByMemberId: uuid("submitted_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    normalizedStatus: intentStatusEnum("normalized_status").notNull().default("active"),
    desiredDate: timestamp("desired_date", { withTimezone: true, mode: "date" }),
    desiredDateEnd: timestamp("desired_date_end", { withTimezone: true, mode: "date" }),
    source: intentSourceEnum("source").notNull().default("text"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("food_intents", table.householdId),
    index("food_intents_household_status_idx").on(
      table.householdId,
      table.normalizedStatus,
    ),
    index("food_intents_submitted_by_idx").on(table.submittedByMemberId),
    check(
      "food_intents_desired_date_range_check",
      sql`${table.desiredDateEnd} IS NULL OR ${table.desiredDate} IS NULL OR ${table.desiredDateEnd} >= ${table.desiredDate}`,
    ),
  ],
).enableRLS();

export const planningRuns = pgTable(
  "planning_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    startedByMemberId: uuid("started_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    langgraphThreadId: varchar("langgraph_thread_id", { length: 255 }),
    langgraphRunId: varchar("langgraph_run_id", { length: 255 }),
    status: planningRunStatusEnum("status").notNull().default("pending"),
    context: jsonb("context").$type<JsonObject>(),
    startedAt: optionalTimestampColumn("started_at"),
    pausedAt: optionalTimestampColumn("paused_at"),
    completedAt: optionalTimestampColumn("completed_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("planning_runs", table.householdId),
    uniqueIndex("planning_runs_langgraph_thread_uq").on(table.langgraphThreadId),
    index("planning_runs_household_status_idx").on(table.householdId, table.status),
  ],
).enableRLS();

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    planningRunId: uuid("planning_run_id").references(() => planningRuns.id, {
      onDelete: "set null",
    }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }),
    notes: text("notes"),
    status: mealPlanStatusEnum("status").notNull().default("draft"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("meal_plans", table.householdId),
    index("meal_plans_household_status_idx").on(table.householdId, table.status),
    index("meal_plans_planning_run_idx").on(table.planningRunId),
  ],
).enableRLS();

export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    mealPlanId: uuid("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    intentId: uuid("intent_id").references(() => foodIntents.id, {
      onDelete: "set null",
    }),
    type: mealPlanItemTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    notes: text("notes"),
    servings: integer("servings").notNull().default(1),
    plannedFor: timestamp("planned_for", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("meal_plan_items", table.householdId),
    index("meal_plan_items_plan_date_idx").on(table.mealPlanId, table.plannedFor),
    index("meal_plan_items_household_date_idx").on(table.householdId, table.plannedFor),
    check("meal_plan_items_servings_positive", sql`${table.servings} > 0`),
  ],
).enableRLS();

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    mealPlanItemId: uuid("meal_plan_item_id").references(() => mealPlanItems.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    kind: feedbackKindEnum("kind").notNull(),
    subject: varchar("subject", { length: 200 }),
    value: jsonb("value").$type<JsonObject>().notNull(),
    observedAt: timestampColumn("observed_at"),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("feedback", table.householdId),
    index("feedback_household_created_idx").on(table.householdId, table.createdAt),
    index("feedback_member_idx").on(table.memberId),
  ],
).enableRLS();

export const memorySyncRecords = pgTable(
  "memory_sync_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => householdMembers.id, {
      onDelete: "cascade",
    }),
    planningRunId: uuid("planning_run_id").references(() => planningRuns.id, {
      onDelete: "cascade",
    }),
    scope: memoryScopeEnum("scope").notNull(),
    namespace: varchar("namespace", { length: 255 }).notNull(),
    externalMemoryId: varchar("external_memory_id", { length: 255 }),
    lastSyncedAt: optionalTimestampColumn("last_synced_at"),
    metadata: jsonb("metadata").$type<JsonObject>(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("memory_sync_records", table.householdId),
    uniqueIndex("memory_sync_records_namespace_uq").on(table.namespace),
    index("memory_sync_records_household_scope_idx").on(table.householdId, table.scope),
    check(
      "memory_sync_records_scope_owner_check",
      sql`(${table.scope} = 'household' AND ${table.memberId} IS NULL AND ${table.planningRunId} IS NULL) OR (${table.scope} = 'member' AND ${table.memberId} IS NOT NULL AND ${table.planningRunId} IS NULL) OR (${table.scope} = 'planning_run' AND ${table.memberId} IS NULL AND ${table.planningRunId} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export const productReplacements = pgTable(
  "product_replacements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => providerProducts.id, { onDelete: "cascade" }),
    replacementProductId: uuid("replacement_product_id")
      .notNull()
      .references(() => providerProducts.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    uniqueIndex("product_replacements_pair_uq").on(
      table.productId,
      table.replacementProductId,
    ),
    check("product_replacements_not_self", sql`${table.productId} <> ${table.replacementProductId}`),
  ],
);

export const shoppingProposals = pgTable(
  "shopping_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    planningRunId: uuid("planning_run_id").references(() => planningRuns.id, {
      onDelete: "set null",
    }),
    mealPlanId: uuid("meal_plan_id").references(() => mealPlans.id, {
      onDelete: "set null",
    }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: proposalStatusEnum("status").notNull().default("draft"),
    approvedByMemberId: uuid("approved_by_member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    approvedAt: optionalTimestampColumn("approved_at"),
    declinedByMemberId: uuid("declined_by_member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    declinedAt: optionalTimestampColumn("declined_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("shopping_proposals", table.householdId),
    index("shopping_proposals_household_status_idx").on(table.householdId, table.status),
    index("shopping_proposals_revision_idx").on(table.id, table.revision),
    check(
      "shopping_proposals_approval_consistency",
      sql`(${table.status} <> 'approved' AND ${table.approvedAt} IS NULL AND ${table.approvedByMemberId} IS NULL) OR (${table.status} IN ('approved', 'applied') AND ${table.approvedAt} IS NOT NULL AND ${table.approvedByMemberId} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export const shoppingProposalItems = pgTable(
  "shopping_proposal_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => shoppingProposals.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => providerProducts.id, { onDelete: "restrict" }),
    replacementForProductId: uuid("replacement_for_product_id").references(
      () => providerProducts.id,
      { onDelete: "set null" },
    ),
    productNameSnapshot: varchar("product_name_snapshot", { length: 400 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    estimatedUnitPrice: numeric("estimated_unit_price", { precision: 12, scale: 2 }),
    estimatedTotalPrice: numeric("estimated_total_price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
    status: proposalItemStatusEnum("status").notNull().default("proposed"),
    finalDecisionByMemberId: uuid("final_decision_by_member_id").references(
      () => householdMembers.id,
      { onDelete: "set null" },
    ),
    finalDecisionAt: optionalTimestampColumn("final_decision_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("shopping_proposal_items", table.householdId),
    index("shopping_proposal_items_proposal_idx").on(table.proposalId),
    index("shopping_proposal_items_household_status_idx").on(table.householdId, table.status),
    check("shopping_proposal_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "shopping_proposal_items_decision_consistency",
      sql`(${table.finalDecisionAt} IS NULL AND ${table.finalDecisionByMemberId} IS NULL) OR (${table.finalDecisionAt} IS NOT NULL AND ${table.finalDecisionByMemberId} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export const shoppingProposalComments = pgTable(
  "shopping_proposal_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => shoppingProposals.id, { onDelete: "cascade" }),
    proposalItemId: uuid("proposal_item_id").references(() => shoppingProposalItems.id, {
      onDelete: "cascade",
    }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("shopping_proposal_comments", table.householdId),
    index("shopping_proposal_comments_proposal_idx").on(table.proposalId, table.createdAt),
  ],
).enableRLS();

export const shoppingProposalSuggestions = pgTable(
  "shopping_proposal_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => shoppingProposals.id, { onDelete: "cascade" }),
    proposalItemId: uuid("proposal_item_id").references(() => shoppingProposalItems.id, {
      onDelete: "cascade",
    }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    type: proposalSuggestionTypeEnum("type").notNull(),
    suggestedProductId: uuid("suggested_product_id").references(() => providerProducts.id, {
      onDelete: "set null",
    }),
    suggestedQuantity: numeric("suggested_quantity", { precision: 12, scale: 3 }),
    suggestedUnit: varchar("suggested_unit", { length: 32 }),
    note: text("note"),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("shopping_proposal_suggestions", table.householdId),
    index("shopping_proposal_suggestions_proposal_idx").on(table.proposalId, table.createdAt),
    check(
      "shopping_proposal_suggestions_quantity_positive",
      sql`${table.suggestedQuantity} IS NULL OR ${table.suggestedQuantity} > 0`,
    ),
  ],
).enableRLS();

export const shoppingProposalItemDecisions = pgTable(
  "shopping_proposal_item_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    proposalItemId: uuid("proposal_item_id")
      .notNull()
      .references(() => shoppingProposalItems.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    decision: proposalDecisionEnum("decision").notNull(),
    replacementProductId: uuid("replacement_product_id").references(() => providerProducts.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }),
    unit: varchar("unit", { length: 32 }),
    comment: text("comment"),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("shopping_proposal_item_decisions", table.householdId),
    index("shopping_proposal_item_decisions_item_idx").on(table.proposalItemId, table.createdAt),
    check(
      "shopping_proposal_item_decisions_quantity_positive",
      sql`${table.quantity} IS NULL OR ${table.quantity} > 0`,
    ),
  ],
).enableRLS();

export const connectedProviderAccounts = pgTable(
  "connected_provider_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    userProviderAccountId: uuid("user_provider_account_id").references(
      () => userProviderAccounts.id,
      { onDelete: "set null" },
    ),
    authorizedByMemberId: uuid("authorized_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    status: providerAccountStatusEnum("status").notNull().default("active"),
    revokedAt: optionalTimestampColumn("revoked_at"),
    lastSyncedAt: optionalTimestampColumn("last_synced_at"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("connected_provider_accounts", table.householdId),
    index("connected_provider_accounts_household_status_idx").on(
      table.householdId,
      table.status,
    ),
    index("connected_provider_accounts_user_account_idx").on(table.userProviderAccountId),
    uniqueIndex("connected_provider_accounts_household_provider_member_uq").on(
      table.householdId,
      table.providerId,
      table.authorizedByMemberId,
    ),
  ],
).enableRLS();

export const householdProviderSettings = pgTable(
  "household_provider_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    selectedAccountId: uuid("selected_account_id").references(
      () => connectedProviderAccounts.id,
      { onDelete: "set null" },
    ),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("household_provider_settings", table.householdId),
    uniqueIndex("household_provider_settings_household_provider_uq").on(
      table.householdId,
      table.providerId,
    ),
  ],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    connectedAccountId: uuid("connected_account_id").references(
      () => connectedProviderAccounts.id,
      { onDelete: "set null" },
    ),
    proposalId: uuid("proposal_id").references(() => shoppingProposals.id, {
      onDelete: "set null",
    }),
    providerOrderId: varchar("provider_order_id", { length: 255 }),
    providerBasketId: varchar("provider_basket_id", { length: 255 }),
    status: orderStatusEnum("status").notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
    purchasedAt: optionalTimestampColumn("purchased_at"),
    lastProviderSyncAt: optionalTimestampColumn("last_provider_sync_at"),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("orders", table.householdId),
    uniqueIndex("orders_provider_order_uq").on(table.providerId, table.providerOrderId),
    uniqueIndex("orders_provider_basket_uq").on(table.providerId, table.providerBasketId),
    index("orders_household_status_idx").on(table.householdId, table.status),
    index("orders_household_sync_idx").on(table.householdId, table.syncStatus),
    check("orders_total_amount_non_negative", sql`${table.totalAmount} IS NULL OR ${table.totalAmount} >= 0`),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => providerProducts.id, {
      onDelete: "set null",
    }),
    providerProductIdSnapshot: varchar("provider_product_id_snapshot", { length: 255 }).notNull(),
    productNameSnapshot: varchar("product_name_snapshot", { length: 400 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 12, scale: 2 }),
    totalPriceSnapshot: numeric("total_price_snapshot", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
    status: orderItemStatusEnum("status").notNull().default("pending"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("order_items", table.householdId),
    index("order_items_order_idx").on(table.orderId),
    index("order_items_household_status_idx").on(table.householdId, table.status),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
).enableRLS();

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    mealPlanItemId: uuid("meal_plan_item_id").references(() => mealPlanItems.id, {
      onDelete: "set null",
    }),
    deliveryProviderId: uuid("delivery_provider_id").references(
      () => shoppingProviders.id,
      { onDelete: "set null" },
    ),
    providerDeliveryId: varchar("provider_delivery_id", { length: 255 }),
    scheduledFrom: optionalTimestampColumn("scheduled_from"),
    scheduledTo: optionalTimestampColumn("scheduled_to"),
    addressReference: text("address_reference"),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("deliveries", table.householdId),
    uniqueIndex("deliveries_provider_delivery_uq").on(
      table.orderId,
      table.providerDeliveryId,
    ),
    index("deliveries_household_status_idx").on(table.householdId, table.status),
    index("deliveries_provider_status_idx").on(table.deliveryProviderId, table.status),
    check(
      "deliveries_scheduled_window_check",
      sql`${table.scheduledTo} IS NULL OR ${table.scheduledFrom} IS NULL OR ${table.scheduledTo} >= ${table.scheduledFrom}`,
    ),
  ],
).enableRLS();

export const providerSyncEvents = pgTable(
  "provider_sync_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => shoppingProviders.id, { onDelete: "restrict" }),
    connectedAccountId: uuid("connected_account_id").references(
      () => connectedProviderAccounts.id,
      { onDelete: "set null" },
    ),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    direction: varchar("direction", { length: 16 }).notNull(),
    status: syncStatusEnum("status").notNull().default("pending"),
    providerEventId: varchar("provider_event_id", { length: 255 }),
    requestSummary: jsonb("request_summary").$type<JsonObject>(),
    responseSummary: jsonb("response_summary").$type<JsonObject>(),
    errorMessage: text("error_message"),
    startedAt: optionalTimestampColumn("started_at"),
    finishedAt: optionalTimestampColumn("finished_at"),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("provider_sync_events", table.householdId),
    uniqueIndex("provider_sync_events_provider_event_uq").on(
      table.providerId,
      table.providerEventId,
    ),
    index("provider_sync_events_household_status_idx").on(table.householdId, table.status),
  ],
).enableRLS();

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    operation: varchar("operation", { length: 80 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }),
    aggregateId: uuid("aggregate_id"),
    response: jsonb("response").$type<JsonObject>(),
    createdAt: timestampColumn("created_at"),
    expiresAt: optionalTimestampColumn("expires_at"),
  },
  (table) => [
    ...householdCrudPolicies("idempotency_keys", table.householdId),
    uniqueIndex("idempotency_keys_household_operation_key_uq").on(
      table.householdId,
      table.operation,
      table.key,
    ),
    index("idempotency_keys_expiry_idx").on(table.expiresAt),
  ],
).enableRLS();

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    version: integer("version").notNull().default(1),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestampColumn("available_at"),
    processedAt: optionalTimestampColumn("processed_at"),
    lastError: text("last_error"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("outbox_events", table.householdId),
    uniqueIndex("outbox_events_aggregate_transition_uq").on(
      table.aggregateType,
      table.aggregateId,
      table.eventType,
      table.version,
    ),
    index("outbox_events_pending_idx").on(table.status, table.availableAt),
    index("outbox_events_household_idx").on(table.householdId, table.createdAt),
    check("outbox_events_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
).enableRLS();

export const notificationJobs = pgTable(
  "notification_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recipientMemberId: uuid("recipient_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "restrict" }),
    sourceEventId: uuid("source_event_id").references(() => outboxEvents.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }).notNull(),
    nextCheckAt: optionalTimestampColumn("next_check_at"),
    estimatedDurationDays: numeric("estimated_duration_days", { precision: 8, scale: 2 }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    deliveryMetadata: jsonb("delivery_metadata").$type<JsonObject>(),
    sentAt: optionalTimestampColumn("sent_at"),
    lastError: text("last_error"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
  },
  (table) => [
    ...householdCrudPolicies("notification_jobs", table.householdId),
    uniqueIndex("notification_jobs_source_event_recipient_uq").on(
      table.sourceEventId,
      table.recipientMemberId,
    ),
    index("notification_jobs_due_idx").on(table.status, table.scheduledAt),
    index("notification_jobs_household_idx").on(table.householdId, table.scheduledAt),
    check(
      "notification_jobs_duration_non_negative",
      sql`${table.estimatedDurationDays} IS NULL OR ${table.estimatedDurationDays} >= 0`,
    ),
    check("notification_jobs_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
).enableRLS();

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>(),
    createdAt: timestampColumn("created_at"),
  },
  (table) => [
    ...householdCrudPolicies("audit_logs", table.householdId),
    index("audit_logs_household_created_idx").on(table.householdId, table.createdAt),
    index("audit_logs_aggregate_idx").on(table.aggregateType, table.aggregateId),
  ],
).enableRLS();

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  memberships: many(householdMembers),
  providerAccounts: many(userProviderAccounts),
  ownedHouseholds: many(households),
  sentInvitations: many(householdInvitations, { relationName: "inviter" }),
  receivedInvitations: many(householdInvitations, { relationName: "invitee" }),
}));

export const householdsRelations = relations(households, ({ one, many }) => ({
  owner: one(users, {
    fields: [households.ownerId],
    references: [users.id],
  }),
  members: many(householdMembers),
  invitations: many(householdInvitations),
  intents: many(foodIntents),
  planningRuns: many(planningRuns),
  mealPlans: many(mealPlans),
  mealPlanItems: many(mealPlanItems),
  feedback: many(feedback),
  memorySyncRecords: many(memorySyncRecords),
  proposals: many(shoppingProposals),
  proposalItems: many(shoppingProposalItems),
  proposalComments: many(shoppingProposalComments),
  proposalSuggestions: many(shoppingProposalSuggestions),
  proposalItemDecisions: many(shoppingProposalItemDecisions),
  connectedProviderAccounts: many(connectedProviderAccounts),
  providerSettings: many(householdProviderSettings),
  orders: many(orders),
  orderItems: many(orderItems),
  deliveries: many(deliveries),
  providerSyncEvents: many(providerSyncEvents),
  idempotencyKeys: many(idempotencyKeys),
  outboxEvents: many(outboxEvents),
  notificationJobs: many(notificationJobs),
  auditLogs: many(auditLogs),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one, many }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdMembers.userId],
    references: [users.id],
  }),
  submittedIntents: many(foodIntents),
  startedPlanningRuns: many(planningRuns),
  createdMealPlans: many(mealPlans),
  feedback: many(feedback),
  authorizedProviderAccounts: many(connectedProviderAccounts),
  createdProposals: many(shoppingProposals),
  approvedProposals: many(shoppingProposals, { relationName: "proposalApprover" }),
  declinedProposals: many(shoppingProposals, { relationName: "proposalDecliner" }),
  comments: many(shoppingProposalComments),
  suggestions: many(shoppingProposalSuggestions),
  itemDecisions: many(shoppingProposalItemDecisions),
  finalProposalItemDecisions: many(shoppingProposalItems, { relationName: "itemDecisionMaker" }),
  notificationJobs: many(notificationJobs),
  auditLogs: many(auditLogs),
}));

export const householdInvitationsRelations = relations(householdInvitations, ({ one }) => ({
  household: one(households, {
    fields: [householdInvitations.householdId],
    references: [households.id],
  }),
  inviter: one(users, {
    fields: [householdInvitations.inviterId],
    references: [users.id],
    relationName: "inviter",
  }),
  invitee: one(users, {
    fields: [householdInvitations.inviteeUserId],
    references: [users.id],
    relationName: "invitee",
  }),
}));

export const shoppingProvidersRelations = relations(shoppingProviders, ({ many }) => ({
  products: many(providerProducts),
  userAccounts: many(userProviderAccounts),
  connectedAccounts: many(connectedProviderAccounts),
  providerSettings: many(householdProviderSettings),
  orders: many(orders),
  syncEvents: many(providerSyncEvents),
}));

export const userProviderAccountsRelations = relations(
  userProviderAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userProviderAccounts.userId],
      references: [users.id],
    }),
    provider: one(shoppingProviders, {
      fields: [userProviderAccounts.providerId],
      references: [shoppingProviders.id],
    }),
    householdConnections: many(connectedProviderAccounts),
  }),
);

export const providerProductsRelations = relations(providerProducts, ({ one, many }) => ({
  provider: one(shoppingProviders, {
    fields: [providerProducts.providerId],
    references: [shoppingProviders.id],
  }),
  proposalItems: many(shoppingProposalItems),
  orderItems: many(orderItems),
  replacementsFrom: many(productReplacements, { relationName: "sourceProduct" }),
  replacementsTo: many(productReplacements, { relationName: "replacementProduct" }),
}));

export const productReplacementsRelations = relations(productReplacements, ({ one }) => ({
  product: one(providerProducts, {
    fields: [productReplacements.productId],
    references: [providerProducts.id],
    relationName: "sourceProduct",
  }),
  replacementProduct: one(providerProducts, {
    fields: [productReplacements.replacementProductId],
    references: [providerProducts.id],
    relationName: "replacementProduct",
  }),
}));

export const foodIntentsRelations = relations(foodIntents, ({ one, many }) => ({
  household: one(households, {
    fields: [foodIntents.householdId],
    references: [households.id],
  }),
  submittedByMember: one(householdMembers, {
    fields: [foodIntents.submittedByMemberId],
    references: [householdMembers.id],
  }),
  mealPlanItems: many(mealPlanItems),
}));

export const planningRunsRelations = relations(planningRuns, ({ one, many }) => ({
  household: one(households, {
    fields: [planningRuns.householdId],
    references: [households.id],
  }),
  startedByMember: one(householdMembers, {
    fields: [planningRuns.startedByMemberId],
    references: [householdMembers.id],
  }),
  mealPlans: many(mealPlans),
  proposals: many(shoppingProposals),
  memorySyncRecords: many(memorySyncRecords),
}));

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  household: one(households, {
    fields: [mealPlans.householdId],
    references: [households.id],
  }),
  planningRun: one(planningRuns, {
    fields: [mealPlans.planningRunId],
    references: [planningRuns.id],
  }),
  createdByMember: one(householdMembers, {
    fields: [mealPlans.createdByMemberId],
    references: [householdMembers.id],
  }),
  items: many(mealPlanItems),
  proposals: many(shoppingProposals),
}));

export const mealPlanItemsRelations = relations(mealPlanItems, ({ one, many }) => ({
  household: one(households, {
    fields: [mealPlanItems.householdId],
    references: [households.id],
  }),
  mealPlan: one(mealPlans, {
    fields: [mealPlanItems.mealPlanId],
    references: [mealPlans.id],
  }),
  intent: one(foodIntents, {
    fields: [mealPlanItems.intentId],
    references: [foodIntents.id],
  }),
  feedback: many(feedback),
  deliveries: many(deliveries),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  household: one(households, {
    fields: [feedback.householdId],
    references: [households.id],
  }),
  member: one(householdMembers, {
    fields: [feedback.memberId],
    references: [householdMembers.id],
  }),
  mealPlanItem: one(mealPlanItems, {
    fields: [feedback.mealPlanItemId],
    references: [mealPlanItems.id],
  }),
  order: one(orders, {
    fields: [feedback.orderId],
    references: [orders.id],
  }),
}));

export const memorySyncRecordsRelations = relations(memorySyncRecords, ({ one }) => ({
  household: one(households, {
    fields: [memorySyncRecords.householdId],
    references: [households.id],
  }),
  member: one(householdMembers, {
    fields: [memorySyncRecords.memberId],
    references: [householdMembers.id],
  }),
  planningRun: one(planningRuns, {
    fields: [memorySyncRecords.planningRunId],
    references: [planningRuns.id],
  }),
}));

export const shoppingProposalsRelations = relations(shoppingProposals, ({ one, many }) => ({
  household: one(households, {
    fields: [shoppingProposals.householdId],
    references: [households.id],
  }),
  planningRun: one(planningRuns, {
    fields: [shoppingProposals.planningRunId],
    references: [planningRuns.id],
  }),
  mealPlan: one(mealPlans, {
    fields: [shoppingProposals.mealPlanId],
    references: [mealPlans.id],
  }),
  createdByMember: one(householdMembers, {
    fields: [shoppingProposals.createdByMemberId],
    references: [householdMembers.id],
  }),
  approvedByMember: one(householdMembers, {
    fields: [shoppingProposals.approvedByMemberId],
    references: [householdMembers.id],
    relationName: "proposalApprover",
  }),
  declinedByMember: one(householdMembers, {
    fields: [shoppingProposals.declinedByMemberId],
    references: [householdMembers.id],
    relationName: "proposalDecliner",
  }),
  items: many(shoppingProposalItems),
  comments: many(shoppingProposalComments),
  suggestions: many(shoppingProposalSuggestions),
  orders: many(orders),
}));

export const shoppingProposalItemsRelations = relations(
  shoppingProposalItems,
  ({ one, many }) => ({
    household: one(households, {
      fields: [shoppingProposalItems.householdId],
      references: [households.id],
    }),
    proposal: one(shoppingProposals, {
      fields: [shoppingProposalItems.proposalId],
      references: [shoppingProposals.id],
    }),
    product: one(providerProducts, {
      fields: [shoppingProposalItems.productId],
      references: [providerProducts.id],
    }),
    replacementForProduct: one(providerProducts, {
      fields: [shoppingProposalItems.replacementForProductId],
      references: [providerProducts.id],
      relationName: "proposalItemReplacementSource",
    }),
    finalDecisionByMember: one(householdMembers, {
      fields: [shoppingProposalItems.finalDecisionByMemberId],
      references: [householdMembers.id],
      relationName: "itemDecisionMaker",
    }),
    comments: many(shoppingProposalComments),
    suggestions: many(shoppingProposalSuggestions),
    decisions: many(shoppingProposalItemDecisions),
  }),
);

export const shoppingProposalCommentsRelations = relations(
  shoppingProposalComments,
  ({ one }) => ({
    household: one(households, {
      fields: [shoppingProposalComments.householdId],
      references: [households.id],
    }),
    proposal: one(shoppingProposals, {
      fields: [shoppingProposalComments.proposalId],
      references: [shoppingProposals.id],
    }),
    proposalItem: one(shoppingProposalItems, {
      fields: [shoppingProposalComments.proposalItemId],
      references: [shoppingProposalItems.id],
    }),
    member: one(householdMembers, {
      fields: [shoppingProposalComments.memberId],
      references: [householdMembers.id],
    }),
  }),
);

export const shoppingProposalSuggestionsRelations = relations(
  shoppingProposalSuggestions,
  ({ one }) => ({
    household: one(households, {
      fields: [shoppingProposalSuggestions.householdId],
      references: [households.id],
    }),
    proposal: one(shoppingProposals, {
      fields: [shoppingProposalSuggestions.proposalId],
      references: [shoppingProposals.id],
    }),
    proposalItem: one(shoppingProposalItems, {
      fields: [shoppingProposalSuggestions.proposalItemId],
      references: [shoppingProposalItems.id],
    }),
    member: one(householdMembers, {
      fields: [shoppingProposalSuggestions.memberId],
      references: [householdMembers.id],
    }),
    suggestedProduct: one(providerProducts, {
      fields: [shoppingProposalSuggestions.suggestedProductId],
      references: [providerProducts.id],
    }),
  }),
);

export const shoppingProposalItemDecisionsRelations = relations(
  shoppingProposalItemDecisions,
  ({ one }) => ({
    household: one(households, {
      fields: [shoppingProposalItemDecisions.householdId],
      references: [households.id],
    }),
    proposalItem: one(shoppingProposalItems, {
      fields: [shoppingProposalItemDecisions.proposalItemId],
      references: [shoppingProposalItems.id],
    }),
    member: one(householdMembers, {
      fields: [shoppingProposalItemDecisions.memberId],
      references: [householdMembers.id],
    }),
    replacementProduct: one(providerProducts, {
      fields: [shoppingProposalItemDecisions.replacementProductId],
      references: [providerProducts.id],
    }),
  }),
);

export const connectedProviderAccountsRelations = relations(
  connectedProviderAccounts,
  ({ one, many }) => ({
    household: one(households, {
      fields: [connectedProviderAccounts.householdId],
      references: [households.id],
    }),
    provider: one(shoppingProviders, {
      fields: [connectedProviderAccounts.providerId],
      references: [shoppingProviders.id],
    }),
    userProviderAccount: one(userProviderAccounts, {
      fields: [connectedProviderAccounts.userProviderAccountId],
      references: [userProviderAccounts.id],
    }),
    authorizedByMember: one(householdMembers, {
      fields: [connectedProviderAccounts.authorizedByMemberId],
      references: [householdMembers.id],
    }),
    providerSettings: many(householdProviderSettings),
    orders: many(orders),
    syncEvents: many(providerSyncEvents),
  }),
);

export const householdProviderSettingsRelations = relations(
  householdProviderSettings,
  ({ one }) => ({
    household: one(households, {
      fields: [householdProviderSettings.householdId],
      references: [households.id],
    }),
    provider: one(shoppingProviders, {
      fields: [householdProviderSettings.providerId],
      references: [shoppingProviders.id],
    }),
    selectedAccount: one(connectedProviderAccounts, {
      fields: [householdProviderSettings.selectedAccountId],
      references: [connectedProviderAccounts.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  household: one(households, {
    fields: [orders.householdId],
    references: [households.id],
  }),
  provider: one(shoppingProviders, {
    fields: [orders.providerId],
    references: [shoppingProviders.id],
  }),
  connectedAccount: one(connectedProviderAccounts, {
    fields: [orders.connectedAccountId],
    references: [connectedProviderAccounts.id],
  }),
  proposal: one(shoppingProposals, {
    fields: [orders.proposalId],
    references: [shoppingProposals.id],
  }),
  items: many(orderItems),
  deliveries: many(deliveries),
  feedback: many(feedback),
  syncEvents: many(providerSyncEvents),
  notificationJobs: many(notificationJobs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  household: one(households, {
    fields: [orderItems.householdId],
    references: [households.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(providerProducts, {
    fields: [orderItems.productId],
    references: [providerProducts.id],
  }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  household: one(households, {
    fields: [deliveries.householdId],
    references: [households.id],
  }),
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
  mealPlanItem: one(mealPlanItems, {
    fields: [deliveries.mealPlanItemId],
    references: [mealPlanItems.id],
  }),
  deliveryProvider: one(shoppingProviders, {
    fields: [deliveries.deliveryProviderId],
    references: [shoppingProviders.id],
  }),
}));

export const providerSyncEventsRelations = relations(providerSyncEvents, ({ one }) => ({
  household: one(households, {
    fields: [providerSyncEvents.householdId],
    references: [households.id],
  }),
  provider: one(shoppingProviders, {
    fields: [providerSyncEvents.providerId],
    references: [shoppingProviders.id],
  }),
  connectedAccount: one(connectedProviderAccounts, {
    fields: [providerSyncEvents.connectedAccountId],
    references: [connectedProviderAccounts.id],
  }),
  order: one(orders, {
    fields: [providerSyncEvents.orderId],
    references: [orders.id],
  }),
}));

export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  household: one(households, {
    fields: [idempotencyKeys.householdId],
    references: [households.id],
  }),
}));

export const outboxEventsRelations = relations(outboxEvents, ({ one, many }) => ({
  household: one(households, {
    fields: [outboxEvents.householdId],
    references: [households.id],
  }),
  notificationJobs: many(notificationJobs),
}));

export const notificationJobsRelations = relations(notificationJobs, ({ one }) => ({
  household: one(households, {
    fields: [notificationJobs.householdId],
    references: [households.id],
  }),
  recipientMember: one(householdMembers, {
    fields: [notificationJobs.recipientMemberId],
    references: [householdMembers.id],
  }),
  sourceEvent: one(outboxEvents, {
    fields: [notificationJobs.sourceEventId],
    references: [outboxEvents.id],
  }),
  order: one(orders, {
    fields: [notificationJobs.orderId],
    references: [orders.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  household: one(households, {
    fields: [auditLogs.householdId],
    references: [households.id],
  }),
  actorMember: one(householdMembers, {
    fields: [auditLogs.actorMemberId],
    references: [householdMembers.id],
  }),
}));

export const schema = {
  users,
  userSessions,
  households,
  householdMembers,
  householdInvitations,
  shoppingProviders,
  userProviderAccounts,
  providerProducts,
  productReplacements,
  foodIntents,
  planningRuns,
  mealPlans,
  mealPlanItems,
  feedback,
  memorySyncRecords,
  shoppingProposals,
  shoppingProposalItems,
  shoppingProposalComments,
  shoppingProposalSuggestions,
  shoppingProposalItemDecisions,
  connectedProviderAccounts,
  householdProviderSettings,
  orders,
  orderItems,
  deliveries,
  providerSyncEvents,
  idempotencyKeys,
  outboxEvents,
  notificationJobs,
  auditLogs,
  usersRelations,
  householdsRelations,
  householdMembersRelations,
  householdInvitationsRelations,
  shoppingProvidersRelations,
  userProviderAccountsRelations,
  providerProductsRelations,
  productReplacementsRelations,
  foodIntentsRelations,
  planningRunsRelations,
  mealPlansRelations,
  mealPlanItemsRelations,
  feedbackRelations,
  memorySyncRecordsRelations,
  shoppingProposalsRelations,
  shoppingProposalItemsRelations,
  shoppingProposalCommentsRelations,
  shoppingProposalSuggestionsRelations,
  shoppingProposalItemDecisionsRelations,
  connectedProviderAccountsRelations,
  householdProviderSettingsRelations,
  ordersRelations,
  orderItemsRelations,
  deliveriesRelations,
  providerSyncEventsRelations,
  idempotencyKeysRelations,
  outboxEventsRelations,
  notificationJobsRelations,
  auditLogsRelations,
  userSessionsRelations,
};

export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type ShoppingProposal = typeof shoppingProposals.$inferSelect;
export type Order = typeof orders.$inferSelect;
