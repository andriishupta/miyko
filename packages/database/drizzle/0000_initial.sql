CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'scheduled', 'in_transit', 'delivered', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('quantity', 'leftover', 'liked', 'repeat', 'general');--> statement-breakpoint
CREATE TYPE "public"."household_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."intent_source" AS ENUM('text', 'audio');--> statement-breakpoint
CREATE TYPE "public"."intent_status" AS ENUM('active', 'planned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."meal_plan_item_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'other');--> statement-breakpoint
CREATE TYPE "public"."meal_plan_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."memory_scope" AS ENUM('household', 'member', 'planning_run');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'processing', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_item_status" AS ENUM('pending', 'approved', 'declined', 'replaced', 'added', 'unavailable', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'approved', 'syncing', 'in_cart', 'placed', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'published', 'retrying', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."planning_run_status" AS ENUM('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."proposal_decision" AS ENUM('approve', 'decline', 'replace', 'edit');--> statement-breakpoint
CREATE TYPE "public"."proposal_item_status" AS ENUM('proposed', 'approved', 'declined', 'replaced', 'edited');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'awaiting_changes', 'awaiting_owner_approval', 'approved', 'declined', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."proposal_suggestion_type" AS ENUM('add', 'replace', 'quantity_change', 'decline');--> statement-breakpoint
CREATE TYPE "public"."provider_account_status" AS ENUM('active', 'expired', 'revoked', 'reconnect_required');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"action" varchar(120) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connected_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"authorized_by_member_id" uuid NOT NULL,
	"access_token_reference" text NOT NULL,
	"refresh_token_reference" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "provider_account_status" DEFAULT 'active' NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"meal_plan_item_id" uuid,
	"provider_delivery_id" varchar(255),
	"scheduled_from" timestamp with time zone,
	"scheduled_to" timestamp with time zone,
	"address_reference" text,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_scheduled_window_check" CHECK ("deliveries"."scheduled_to" IS NULL OR "deliveries"."scheduled_from" IS NULL OR "deliveries"."scheduled_to" >= "deliveries"."scheduled_from")
);
--> statement-breakpoint
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"meal_plan_item_id" uuid,
	"order_id" uuid,
	"kind" "feedback_kind" NOT NULL,
	"subject" varchar(200),
	"value" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "food_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"submitted_by_member_id" uuid NOT NULL,
	"text" text NOT NULL,
	"normalized_status" "intent_status" DEFAULT 'active' NOT NULL,
	"desired_date" timestamp with time zone,
	"desired_date_end" timestamp with time zone,
	"source" "intent_source" DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_intents_desired_date_range_check" CHECK ("food_intents"."desired_date_end" IS NULL OR "food_intents"."desired_date" IS NULL OR "food_intents"."desired_date_end" >= "food_intents"."desired_date")
);
--> statement-breakpoint
ALTER TABLE "food_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "household_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_user_id" uuid,
	"invitee_email" varchar(320),
	"role" "household_role" DEFAULT 'member' NOT NULL,
	"can_make_decisions" boolean DEFAULT false NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_invitations_invitee_identity_check" CHECK ("household_invitations"."invitee_user_id" IS NOT NULL OR "household_invitations"."invitee_email" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "household_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "household_role" DEFAULT 'member' NOT NULL,
	"can_make_decisions" boolean DEFAULT false NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_removed_at_consistency" CHECK (("household_members"."status" = 'active' AND "household_members"."removed_at" IS NULL) OR ("household_members"."status" = 'removed' AND "household_members"."removed_at" IS NOT NULL)),
	CONSTRAINT "household_members_owner_decision_consistency" CHECK ("household_members"."role" <> 'owner' OR "household_members"."can_make_decisions" = true)
);
--> statement-breakpoint
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "household_provider_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"selected_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_provider_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"operation" varchar(80) NOT NULL,
	"status" varchar(32) NOT NULL,
	"aggregate_type" varchar(80),
	"aggregate_id" uuid,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"intent_id" uuid,
	"type" "meal_plan_item_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"notes" text,
	"servings" integer DEFAULT 1 NOT NULL,
	"planned_for" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_items_servings_positive" CHECK ("meal_plan_items"."servings" > 0)
);
--> statement-breakpoint
ALTER TABLE "meal_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"planning_run_id" uuid,
	"created_by_member_id" uuid NOT NULL,
	"name" varchar(200),
	"notes" text,
	"status" "meal_plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memory_sync_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid,
	"planning_run_id" uuid,
	"scope" "memory_scope" NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"external_memory_id" varchar(255),
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_sync_records_scope_owner_check" CHECK (("memory_sync_records"."scope" = 'household' AND "memory_sync_records"."member_id" IS NULL AND "memory_sync_records"."planning_run_id" IS NULL) OR ("memory_sync_records"."scope" = 'member' AND "memory_sync_records"."member_id" IS NOT NULL AND "memory_sync_records"."planning_run_id" IS NULL) OR ("memory_sync_records"."scope" = 'planning_run' AND "memory_sync_records"."member_id" IS NULL AND "memory_sync_records"."planning_run_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "memory_sync_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipient_member_id" uuid NOT NULL,
	"source_event_id" uuid,
	"order_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"next_check_at" timestamp with time zone,
	"estimated_duration_days" numeric(8, 2),
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivery_metadata" jsonb,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_jobs_duration_non_negative" CHECK ("notification_jobs"."estimated_duration_days" IS NULL OR "notification_jobs"."estimated_duration_days" >= 0),
	CONSTRAINT "notification_jobs_attempts_non_negative" CHECK ("notification_jobs"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "notification_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"provider_product_id_snapshot" varchar(255) NOT NULL,
	"product_name_snapshot" varchar(400) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"unit_price_snapshot" numeric(12, 2),
	"total_price_snapshot" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"status" "order_item_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"connected_account_id" uuid,
	"proposal_id" uuid,
	"provider_order_id" varchar(255),
	"provider_basket_id" varchar(255),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"purchased_at" timestamp with time zone,
	"last_provider_sync_at" timestamp with time zone,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_total_amount_non_negative" CHECK ("orders"."total_amount" IS NULL OR "orders"."total_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_attempts_non_negative" CHECK ("outbox_events"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "planning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"started_by_member_id" uuid NOT NULL,
	"langgraph_thread_id" varchar(255),
	"langgraph_run_id" varchar(255),
	"status" "planning_run_status" DEFAULT 'pending' NOT NULL,
	"context" jsonb,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planning_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_replacements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"replacement_product_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_replacements_not_self" CHECK ("product_replacements"."product_id" <> "product_replacements"."replacement_product_id")
);
--> statement-breakpoint
CREATE TABLE "provider_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_product_id" varchar(255) NOT NULL,
	"normalized_name" varchar(400) NOT NULL,
	"details" jsonb,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"connected_account_id" uuid,
	"order_id" uuid,
	"direction" varchar(16) NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"provider_event_id" varchar(255),
	"request_summary" jsonb,
	"response_summary" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_sync_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_proposal_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"proposal_item_id" uuid,
	"member_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_proposal_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_proposal_item_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"proposal_item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"decision" "proposal_decision" NOT NULL,
	"replacement_product_id" uuid,
	"quantity" numeric(12, 3),
	"unit" varchar(32),
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_proposal_item_decisions_quantity_positive" CHECK ("shopping_proposal_item_decisions"."quantity" IS NULL OR "shopping_proposal_item_decisions"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "shopping_proposal_item_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"replacement_for_product_id" uuid,
	"product_name_snapshot" varchar(400) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"estimated_unit_price" numeric(12, 2),
	"estimated_total_price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"status" "proposal_item_status" DEFAULT 'proposed' NOT NULL,
	"final_decision_by_member_id" uuid,
	"final_decision_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_proposal_items_quantity_positive" CHECK ("shopping_proposal_items"."quantity" > 0),
	CONSTRAINT "shopping_proposal_items_decision_consistency" CHECK (("shopping_proposal_items"."final_decision_at" IS NULL AND "shopping_proposal_items"."final_decision_by_member_id" IS NULL) OR ("shopping_proposal_items"."final_decision_at" IS NOT NULL AND "shopping_proposal_items"."final_decision_by_member_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_proposal_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"proposal_item_id" uuid,
	"member_id" uuid NOT NULL,
	"type" "proposal_suggestion_type" NOT NULL,
	"suggested_product_id" uuid,
	"suggested_quantity" numeric(12, 3),
	"suggested_unit" varchar(32),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_proposal_suggestions_quantity_positive" CHECK ("shopping_proposal_suggestions"."suggested_quantity" IS NULL OR "shopping_proposal_suggestions"."suggested_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"planning_run_id" uuid,
	"meal_plan_id" uuid,
	"created_by_member_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"approved_by_member_id" uuid,
	"approved_at" timestamp with time zone,
	"declined_by_member_id" uuid,
	"declined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_proposals_approval_consistency" CHECK (("shopping_proposals"."status" <> 'approved' AND "shopping_proposals"."approved_at" IS NULL AND "shopping_proposals"."approved_by_member_id" IS NULL) OR ("shopping_proposals"."status" IN ('approved', 'applied') AND "shopping_proposals"."approved_at" IS NOT NULL AND "shopping_proposals"."approved_by_member_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "shopping_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "user_sessions_expiry_after_creation" CHECK ("user_sessions"."expires_at" > "user_sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"normalized_email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"display_name" varchar(200),
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_member_id_household_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD CONSTRAINT "connected_provider_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD CONSTRAINT "connected_provider_accounts_provider_id_shopping_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."shopping_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD CONSTRAINT "connected_provider_accounts_authorized_by_member_id_household_members_id_fk" FOREIGN KEY ("authorized_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_meal_plan_item_id_meal_plan_items_id_fk" FOREIGN KEY ("meal_plan_item_id") REFERENCES "public"."meal_plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_meal_plan_item_id_meal_plan_items_id_fk" FOREIGN KEY ("meal_plan_item_id") REFERENCES "public"."meal_plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_intents" ADD CONSTRAINT "food_intents_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_intents" ADD CONSTRAINT "food_intents_submitted_by_member_id_household_members_id_fk" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_provider_settings" ADD CONSTRAINT "household_provider_settings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_provider_settings" ADD CONSTRAINT "household_provider_settings_provider_id_shopping_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."shopping_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_provider_settings" ADD CONSTRAINT "household_provider_settings_selected_account_id_connected_provider_accounts_id_fk" FOREIGN KEY ("selected_account_id") REFERENCES "public"."connected_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_intent_id_food_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."food_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_planning_run_id_planning_runs_id_fk" FOREIGN KEY ("planning_run_id") REFERENCES "public"."planning_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_member_id_household_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_sync_records" ADD CONSTRAINT "memory_sync_records_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_sync_records" ADD CONSTRAINT "memory_sync_records_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_sync_records" ADD CONSTRAINT "memory_sync_records_planning_run_id_planning_runs_id_fk" FOREIGN KEY ("planning_run_id") REFERENCES "public"."planning_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_recipient_member_id_household_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_source_event_id_outbox_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_provider_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."provider_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_id_shopping_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."shopping_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_connected_account_id_connected_provider_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_proposal_id_shopping_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."shopping_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_started_by_member_id_household_members_id_fk" FOREIGN KEY ("started_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_replacements" ADD CONSTRAINT "product_replacements_product_id_provider_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."provider_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_replacements" ADD CONSTRAINT "product_replacements_replacement_product_id_provider_products_id_fk" FOREIGN KEY ("replacement_product_id") REFERENCES "public"."provider_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_provider_id_shopping_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."shopping_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_events" ADD CONSTRAINT "provider_sync_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_events" ADD CONSTRAINT "provider_sync_events_provider_id_shopping_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."shopping_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_events" ADD CONSTRAINT "provider_sync_events_connected_account_id_connected_provider_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_events" ADD CONSTRAINT "provider_sync_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_comments" ADD CONSTRAINT "shopping_proposal_comments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_comments" ADD CONSTRAINT "shopping_proposal_comments_proposal_id_shopping_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."shopping_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_comments" ADD CONSTRAINT "shopping_proposal_comments_proposal_item_id_shopping_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."shopping_proposal_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_comments" ADD CONSTRAINT "shopping_proposal_comments_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_item_decisions" ADD CONSTRAINT "shopping_proposal_item_decisions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_item_decisions" ADD CONSTRAINT "shopping_proposal_item_decisions_proposal_item_id_shopping_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."shopping_proposal_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_item_decisions" ADD CONSTRAINT "shopping_proposal_item_decisions_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_item_decisions" ADD CONSTRAINT "shopping_proposal_item_decisions_replacement_product_id_provider_products_id_fk" FOREIGN KEY ("replacement_product_id") REFERENCES "public"."provider_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ADD CONSTRAINT "shopping_proposal_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ADD CONSTRAINT "shopping_proposal_items_proposal_id_shopping_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."shopping_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ADD CONSTRAINT "shopping_proposal_items_product_id_provider_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."provider_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ADD CONSTRAINT "shopping_proposal_items_replacement_for_product_id_provider_products_id_fk" FOREIGN KEY ("replacement_for_product_id") REFERENCES "public"."provider_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_items" ADD CONSTRAINT "shopping_proposal_items_final_decision_by_member_id_household_members_id_fk" FOREIGN KEY ("final_decision_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ADD CONSTRAINT "shopping_proposal_suggestions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ADD CONSTRAINT "shopping_proposal_suggestions_proposal_id_shopping_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."shopping_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ADD CONSTRAINT "shopping_proposal_suggestions_proposal_item_id_shopping_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."shopping_proposal_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ADD CONSTRAINT "shopping_proposal_suggestions_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposal_suggestions" ADD CONSTRAINT "shopping_proposal_suggestions_suggested_product_id_provider_products_id_fk" FOREIGN KEY ("suggested_product_id") REFERENCES "public"."provider_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_planning_run_id_planning_runs_id_fk" FOREIGN KEY ("planning_run_id") REFERENCES "public"."planning_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_created_by_member_id_household_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_approved_by_member_id_household_members_id_fk" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD CONSTRAINT "shopping_proposals_declined_by_member_id_household_members_id_fk" FOREIGN KEY ("declined_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_household_created_idx" ON "audit_logs" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_aggregate_idx" ON "audit_logs" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "connected_provider_accounts_household_status_idx" ON "connected_provider_accounts" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_provider_accounts_household_provider_member_uq" ON "connected_provider_accounts" USING btree ("household_id","provider_id","authorized_by_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_provider_delivery_uq" ON "deliveries" USING btree ("order_id","provider_delivery_id");--> statement-breakpoint
CREATE INDEX "deliveries_household_status_idx" ON "deliveries" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "feedback_household_created_idx" ON "feedback" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_member_idx" ON "feedback" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "food_intents_household_status_idx" ON "food_intents" USING btree ("household_id","normalized_status");--> statement-breakpoint
CREATE INDEX "food_intents_submitted_by_idx" ON "food_intents" USING btree ("submitted_by_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_invitations_token_hash_uq" ON "household_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "household_invitations_household_status_idx" ON "household_invitations" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "household_invitations_invitee_email_idx" ON "household_invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_household_user_uq" ON "household_members" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_one_active_owner_uq" ON "household_members" USING btree ("household_id") WHERE "household_members"."status" = 'active' AND "household_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "household_members_user_active_idx" ON "household_members" USING btree ("user_id","household_id") WHERE "household_members"."status" = 'active';--> statement-breakpoint
CREATE INDEX "household_members_household_active_idx" ON "household_members" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "household_provider_settings_household_provider_uq" ON "household_provider_settings" USING btree ("household_id","provider_id");--> statement-breakpoint
CREATE INDEX "households_owner_id_idx" ON "households" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_household_operation_key_uq" ON "idempotency_keys" USING btree ("household_id","operation","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "meal_plan_items_plan_date_idx" ON "meal_plan_items" USING btree ("meal_plan_id","planned_for");--> statement-breakpoint
CREATE INDEX "meal_plan_items_household_date_idx" ON "meal_plan_items" USING btree ("household_id","planned_for");--> statement-breakpoint
CREATE INDEX "meal_plans_household_status_idx" ON "meal_plans" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "meal_plans_planning_run_idx" ON "meal_plans" USING btree ("planning_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_sync_records_namespace_uq" ON "memory_sync_records" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "memory_sync_records_household_scope_idx" ON "memory_sync_records" USING btree ("household_id","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_jobs_source_event_recipient_uq" ON "notification_jobs" USING btree ("source_event_id","recipient_member_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_due_idx" ON "notification_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "notification_jobs_household_idx" ON "notification_jobs" USING btree ("household_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_household_status_idx" ON "order_items" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_order_uq" ON "orders" USING btree ("provider_id","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_basket_uq" ON "orders" USING btree ("provider_id","provider_basket_id");--> statement-breakpoint
CREATE INDEX "orders_household_status_idx" ON "orders" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "orders_household_sync_idx" ON "orders" USING btree ("household_id","sync_status");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_aggregate_transition_uq" ON "outbox_events" USING btree ("aggregate_type","aggregate_id","event_type","version");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_events_household_idx" ON "outbox_events" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_runs_langgraph_thread_uq" ON "planning_runs" USING btree ("langgraph_thread_id");--> statement-breakpoint
CREATE INDEX "planning_runs_household_status_idx" ON "planning_runs" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_replacements_pair_uq" ON "product_replacements" USING btree ("product_id","replacement_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_products_provider_external_id_uq" ON "provider_products" USING btree ("provider_id","provider_product_id");--> statement-breakpoint
CREATE INDEX "provider_products_name_idx" ON "provider_products" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_sync_events_provider_event_uq" ON "provider_sync_events" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "provider_sync_events_household_status_idx" ON "provider_sync_events" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "shopping_proposal_comments_proposal_idx" ON "shopping_proposal_comments" USING btree ("proposal_id","created_at");--> statement-breakpoint
CREATE INDEX "shopping_proposal_item_decisions_item_idx" ON "shopping_proposal_item_decisions" USING btree ("proposal_item_id","created_at");--> statement-breakpoint
CREATE INDEX "shopping_proposal_items_proposal_idx" ON "shopping_proposal_items" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "shopping_proposal_items_household_status_idx" ON "shopping_proposal_items" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "shopping_proposal_suggestions_proposal_idx" ON "shopping_proposal_suggestions" USING btree ("proposal_id","created_at");--> statement-breakpoint
CREATE INDEX "shopping_proposals_household_status_idx" ON "shopping_proposals" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "shopping_proposals_revision_idx" ON "shopping_proposals" USING btree ("id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_providers_slug_uq" ON "shopping_providers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_providers_name_uq" ON "shopping_providers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_uq" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_active_idx" ON "user_sessions" USING btree ("user_id","expires_at") WHERE "user_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_sessions_expiry_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_uq" ON "users" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
-- RLS helper functions are part of the initial schema because Drizzle policies
-- can reference SQL functions but cannot declare SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.miyko_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.miyko_is_household_member(target_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members AS hm
    WHERE hm.household_id = target_household_id
      AND hm.user_id = public.miyko_current_user_id()
      AND hm.status = 'active'
  );
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.miyko_can_bootstrap_household(target_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.households AS h
    WHERE h.id = target_household_id
      AND h.owner_id = public.miyko_current_user_id()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.household_members AS hm
    WHERE hm.household_id = target_household_id
      AND hm.role = 'owner'
      AND hm.status = 'active'
  );
$$;--> statement-breakpoint
CREATE POLICY "audit_logs_select" ON "audit_logs" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("audit_logs"."household_id"));--> statement-breakpoint
CREATE POLICY "audit_logs_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("audit_logs"."household_id"));--> statement-breakpoint
CREATE POLICY "audit_logs_update" ON "audit_logs" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("audit_logs"."household_id")) WITH CHECK (public.miyko_is_household_member("audit_logs"."household_id"));--> statement-breakpoint
CREATE POLICY "audit_logs_delete" ON "audit_logs" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("audit_logs"."household_id"));--> statement-breakpoint
CREATE POLICY "connected_provider_accounts_select" ON "connected_provider_accounts" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("connected_provider_accounts"."household_id"));--> statement-breakpoint
CREATE POLICY "connected_provider_accounts_insert" ON "connected_provider_accounts" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("connected_provider_accounts"."household_id"));--> statement-breakpoint
CREATE POLICY "connected_provider_accounts_update" ON "connected_provider_accounts" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("connected_provider_accounts"."household_id")) WITH CHECK (public.miyko_is_household_member("connected_provider_accounts"."household_id"));--> statement-breakpoint
CREATE POLICY "connected_provider_accounts_delete" ON "connected_provider_accounts" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("connected_provider_accounts"."household_id"));--> statement-breakpoint
CREATE POLICY "deliveries_select" ON "deliveries" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("deliveries"."household_id"));--> statement-breakpoint
CREATE POLICY "deliveries_insert" ON "deliveries" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("deliveries"."household_id"));--> statement-breakpoint
CREATE POLICY "deliveries_update" ON "deliveries" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("deliveries"."household_id")) WITH CHECK (public.miyko_is_household_member("deliveries"."household_id"));--> statement-breakpoint
CREATE POLICY "deliveries_delete" ON "deliveries" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("deliveries"."household_id"));--> statement-breakpoint
CREATE POLICY "feedback_select" ON "feedback" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("feedback"."household_id"));--> statement-breakpoint
CREATE POLICY "feedback_insert" ON "feedback" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("feedback"."household_id"));--> statement-breakpoint
CREATE POLICY "feedback_update" ON "feedback" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("feedback"."household_id")) WITH CHECK (public.miyko_is_household_member("feedback"."household_id"));--> statement-breakpoint
CREATE POLICY "feedback_delete" ON "feedback" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("feedback"."household_id"));--> statement-breakpoint
CREATE POLICY "food_intents_select" ON "food_intents" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("food_intents"."household_id"));--> statement-breakpoint
CREATE POLICY "food_intents_insert" ON "food_intents" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("food_intents"."household_id"));--> statement-breakpoint
CREATE POLICY "food_intents_update" ON "food_intents" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("food_intents"."household_id")) WITH CHECK (public.miyko_is_household_member("food_intents"."household_id"));--> statement-breakpoint
CREATE POLICY "food_intents_delete" ON "food_intents" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("food_intents"."household_id"));--> statement-breakpoint
CREATE POLICY "household_invitations_select" ON "household_invitations" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "household_invitations_insert" ON "household_invitations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("household_invitations"."household_id"));--> statement-breakpoint
CREATE POLICY "household_invitations_update" ON "household_invitations" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id()) WITH CHECK (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "household_invitations_delete" ON "household_invitations" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("household_invitations"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_select" ON "household_members" AS PERMISSIVE FOR SELECT TO public USING ("household_members"."user_id" = public.miyko_current_user_id() OR public.miyko_is_household_member("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_insert" ON "household_members" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((
        public.miyko_is_household_member("household_members"."household_id")
        OR (
          public.miyko_can_bootstrap_household("household_members"."household_id")
          AND "household_members"."user_id" = public.miyko_current_user_id()
        )
      ));--> statement-breakpoint
CREATE POLICY "household_members_update" ON "household_members" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("household_members"."household_id")) WITH CHECK (public.miyko_is_household_member("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_members_delete" ON "household_members" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("household_members"."household_id"));--> statement-breakpoint
CREATE POLICY "household_provider_settings_select" ON "household_provider_settings" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("household_provider_settings"."household_id"));--> statement-breakpoint
CREATE POLICY "household_provider_settings_insert" ON "household_provider_settings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("household_provider_settings"."household_id"));--> statement-breakpoint
CREATE POLICY "household_provider_settings_update" ON "household_provider_settings" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("household_provider_settings"."household_id")) WITH CHECK (public.miyko_is_household_member("household_provider_settings"."household_id"));--> statement-breakpoint
CREATE POLICY "household_provider_settings_delete" ON "household_provider_settings" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("household_provider_settings"."household_id"));--> statement-breakpoint
CREATE POLICY "households_select" ON "households" AS PERMISSIVE FOR SELECT TO public USING ("households"."owner_id" = public.miyko_current_user_id() OR public.miyko_is_household_member("households"."id"));--> statement-breakpoint
CREATE POLICY "households_insert" ON "households" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("households"."owner_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "households_update" ON "households" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("households"."id")) WITH CHECK (public.miyko_is_household_member("households"."id"));--> statement-breakpoint
CREATE POLICY "households_delete" ON "households" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("households"."id"));--> statement-breakpoint
CREATE POLICY "idempotency_keys_select" ON "idempotency_keys" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("idempotency_keys"."household_id"));--> statement-breakpoint
CREATE POLICY "idempotency_keys_insert" ON "idempotency_keys" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("idempotency_keys"."household_id"));--> statement-breakpoint
CREATE POLICY "idempotency_keys_update" ON "idempotency_keys" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("idempotency_keys"."household_id")) WITH CHECK (public.miyko_is_household_member("idempotency_keys"."household_id"));--> statement-breakpoint
CREATE POLICY "idempotency_keys_delete" ON "idempotency_keys" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("idempotency_keys"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plan_items_select" ON "meal_plan_items" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("meal_plan_items"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plan_items_insert" ON "meal_plan_items" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("meal_plan_items"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plan_items_update" ON "meal_plan_items" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("meal_plan_items"."household_id")) WITH CHECK (public.miyko_is_household_member("meal_plan_items"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plan_items_delete" ON "meal_plan_items" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("meal_plan_items"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plans_select" ON "meal_plans" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("meal_plans"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plans_insert" ON "meal_plans" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("meal_plans"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plans_update" ON "meal_plans" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("meal_plans"."household_id")) WITH CHECK (public.miyko_is_household_member("meal_plans"."household_id"));--> statement-breakpoint
CREATE POLICY "meal_plans_delete" ON "meal_plans" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("meal_plans"."household_id"));--> statement-breakpoint
CREATE POLICY "memory_sync_records_select" ON "memory_sync_records" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("memory_sync_records"."household_id"));--> statement-breakpoint
CREATE POLICY "memory_sync_records_insert" ON "memory_sync_records" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("memory_sync_records"."household_id"));--> statement-breakpoint
CREATE POLICY "memory_sync_records_update" ON "memory_sync_records" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("memory_sync_records"."household_id")) WITH CHECK (public.miyko_is_household_member("memory_sync_records"."household_id"));--> statement-breakpoint
CREATE POLICY "memory_sync_records_delete" ON "memory_sync_records" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("memory_sync_records"."household_id"));--> statement-breakpoint
CREATE POLICY "notification_jobs_select" ON "notification_jobs" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("notification_jobs"."household_id"));--> statement-breakpoint
CREATE POLICY "notification_jobs_insert" ON "notification_jobs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("notification_jobs"."household_id"));--> statement-breakpoint
CREATE POLICY "notification_jobs_update" ON "notification_jobs" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("notification_jobs"."household_id")) WITH CHECK (public.miyko_is_household_member("notification_jobs"."household_id"));--> statement-breakpoint
CREATE POLICY "notification_jobs_delete" ON "notification_jobs" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("notification_jobs"."household_id"));--> statement-breakpoint
CREATE POLICY "order_items_select" ON "order_items" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("order_items"."household_id"));--> statement-breakpoint
CREATE POLICY "order_items_insert" ON "order_items" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("order_items"."household_id"));--> statement-breakpoint
CREATE POLICY "order_items_update" ON "order_items" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("order_items"."household_id")) WITH CHECK (public.miyko_is_household_member("order_items"."household_id"));--> statement-breakpoint
CREATE POLICY "order_items_delete" ON "order_items" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("order_items"."household_id"));--> statement-breakpoint
CREATE POLICY "orders_select" ON "orders" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("orders"."household_id"));--> statement-breakpoint
CREATE POLICY "orders_insert" ON "orders" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("orders"."household_id"));--> statement-breakpoint
CREATE POLICY "orders_update" ON "orders" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("orders"."household_id")) WITH CHECK (public.miyko_is_household_member("orders"."household_id"));--> statement-breakpoint
CREATE POLICY "orders_delete" ON "orders" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("orders"."household_id"));--> statement-breakpoint
CREATE POLICY "outbox_events_select" ON "outbox_events" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("outbox_events"."household_id"));--> statement-breakpoint
CREATE POLICY "outbox_events_insert" ON "outbox_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("outbox_events"."household_id"));--> statement-breakpoint
CREATE POLICY "outbox_events_update" ON "outbox_events" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("outbox_events"."household_id")) WITH CHECK (public.miyko_is_household_member("outbox_events"."household_id"));--> statement-breakpoint
CREATE POLICY "outbox_events_delete" ON "outbox_events" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("outbox_events"."household_id"));--> statement-breakpoint
CREATE POLICY "planning_runs_select" ON "planning_runs" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("planning_runs"."household_id"));--> statement-breakpoint
CREATE POLICY "planning_runs_insert" ON "planning_runs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("planning_runs"."household_id"));--> statement-breakpoint
CREATE POLICY "planning_runs_update" ON "planning_runs" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("planning_runs"."household_id")) WITH CHECK (public.miyko_is_household_member("planning_runs"."household_id"));--> statement-breakpoint
CREATE POLICY "planning_runs_delete" ON "planning_runs" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("planning_runs"."household_id"));--> statement-breakpoint
CREATE POLICY "provider_sync_events_select" ON "provider_sync_events" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("provider_sync_events"."household_id"));--> statement-breakpoint
CREATE POLICY "provider_sync_events_insert" ON "provider_sync_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("provider_sync_events"."household_id"));--> statement-breakpoint
CREATE POLICY "provider_sync_events_update" ON "provider_sync_events" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("provider_sync_events"."household_id")) WITH CHECK (public.miyko_is_household_member("provider_sync_events"."household_id"));--> statement-breakpoint
CREATE POLICY "provider_sync_events_delete" ON "provider_sync_events" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("provider_sync_events"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_comments_select" ON "shopping_proposal_comments" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("shopping_proposal_comments"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_comments_insert" ON "shopping_proposal_comments" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("shopping_proposal_comments"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_comments_update" ON "shopping_proposal_comments" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("shopping_proposal_comments"."household_id")) WITH CHECK (public.miyko_is_household_member("shopping_proposal_comments"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_comments_delete" ON "shopping_proposal_comments" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("shopping_proposal_comments"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_item_decisions_select" ON "shopping_proposal_item_decisions" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("shopping_proposal_item_decisions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_item_decisions_insert" ON "shopping_proposal_item_decisions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("shopping_proposal_item_decisions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_item_decisions_update" ON "shopping_proposal_item_decisions" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("shopping_proposal_item_decisions"."household_id")) WITH CHECK (public.miyko_is_household_member("shopping_proposal_item_decisions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_item_decisions_delete" ON "shopping_proposal_item_decisions" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("shopping_proposal_item_decisions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_items_select" ON "shopping_proposal_items" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("shopping_proposal_items"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_items_insert" ON "shopping_proposal_items" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("shopping_proposal_items"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_items_update" ON "shopping_proposal_items" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("shopping_proposal_items"."household_id")) WITH CHECK (public.miyko_is_household_member("shopping_proposal_items"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_items_delete" ON "shopping_proposal_items" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("shopping_proposal_items"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_suggestions_select" ON "shopping_proposal_suggestions" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("shopping_proposal_suggestions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_suggestions_insert" ON "shopping_proposal_suggestions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("shopping_proposal_suggestions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_suggestions_update" ON "shopping_proposal_suggestions" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("shopping_proposal_suggestions"."household_id")) WITH CHECK (public.miyko_is_household_member("shopping_proposal_suggestions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposal_suggestions_delete" ON "shopping_proposal_suggestions" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("shopping_proposal_suggestions"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposals_select" ON "shopping_proposals" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("shopping_proposals"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposals_insert" ON "shopping_proposals" AS PERMISSIVE FOR INSERT TO public WITH CHECK (public.miyko_is_household_member("shopping_proposals"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposals_update" ON "shopping_proposals" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("shopping_proposals"."household_id")) WITH CHECK (public.miyko_is_household_member("shopping_proposals"."household_id"));--> statement-breakpoint
CREATE POLICY "shopping_proposals_delete" ON "shopping_proposals" AS PERMISSIVE FOR DELETE TO public USING (public.miyko_is_household_member("shopping_proposals"."household_id"));--> statement-breakpoint
CREATE POLICY "user_sessions_select_own" ON "user_sessions" AS PERMISSIVE FOR SELECT TO public USING ("user_sessions"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_sessions_insert_own" ON "user_sessions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("user_sessions"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_sessions_update_own" ON "user_sessions" AS PERMISSIVE FOR UPDATE TO public USING ("user_sessions"."user_id" = public.miyko_current_user_id()) WITH CHECK ("user_sessions"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_sessions_delete_own" ON "user_sessions" AS PERMISSIVE FOR DELETE TO public USING ("user_sessions"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO public USING ("users"."id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO public USING ("users"."id" = public.miyko_current_user_id()) WITH CHECK ("users"."id" = public.miyko_current_user_id());
