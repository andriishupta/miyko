-- Provider catalog is global reference data. Runtime API access is read-only
-- and limited to active providers; migrations/admin operations remain outside
-- the api_role path.
CREATE TYPE "public"."provider_sync_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'stale');--> statement-breakpoint
CREATE TYPE "public"."provider_secret_kind" AS ENUM('access_token', 'refresh_token', 'password', 'api_key', 'mcp_credential');--> statement-breakpoint
CREATE TYPE "public"."memory_initialization_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'waiting_for_provider');--> statement-breakpoint

ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "providers_select_active" ON "providers" AS PERMISSIVE FOR SELECT TO public USING ("providers"."status" = 'active');--> statement-breakpoint

ALTER TABLE "connected_provider_accounts" ADD COLUMN "sync_status" "public"."provider_sync_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD COLUMN "first_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD COLUMN "stale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD COLUMN "last_sync_error" text;--> statement-breakpoint

CREATE TABLE "provider_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_provider_account_id" uuid NOT NULL,
	"kind" "provider_secret_kind" NOT NULL,
	"encrypted_value" bytea NOT NULL,
	"key_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "provider_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE "memory_initializations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"household_id" uuid,
	"member_id" uuid,
	"provider_account_id" uuid,
	"source_event_id" uuid,
	"status" "memory_initialization_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "memory_initializations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "outbox_events" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "claimed_by" varchar(120);--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "claim_expires_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "provider_secrets" ADD CONSTRAINT "provider_secrets_user_provider_account_id_user_providers_id_fk" FOREIGN KEY ("user_provider_account_id") REFERENCES "public"."user_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_initializations" ADD CONSTRAINT "memory_initializations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_initializations" ADD CONSTRAINT "memory_initializations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_initializations" ADD CONSTRAINT "memory_initializations_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_initializations" ADD CONSTRAINT "memory_initializations_provider_account_id_user_providers_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."user_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_initializations" ADD CONSTRAINT "memory_initializations_source_event_id_outbox_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "provider_secrets_account_kind_uq" ON "provider_secrets" USING btree ("user_provider_account_id","kind");--> statement-breakpoint
CREATE INDEX "provider_secrets_account_idx" ON "provider_secrets" USING btree ("user_provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_initializations_source_event_uq" ON "memory_initializations" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "memory_initializations_user_status_idx" ON "memory_initializations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "memory_initializations_household_idx" ON "memory_initializations" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "memory_initializations_provider_account_idx" ON "memory_initializations" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX "provider_sync_events_connected_account_idx" ON "provider_sync_events" USING btree ("connected_account_id");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("status","available_at","claim_expires_at");--> statement-breakpoint

CREATE POLICY "provider_secrets_select_own" ON "provider_secrets" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = "provider_secrets"."user_provider_account_id" AND account.user_id = public.miyko_current_user_id()));--> statement-breakpoint
CREATE POLICY "provider_secrets_insert_own" ON "provider_secrets" AS PERMISSIVE FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = "provider_secrets"."user_provider_account_id" AND account.user_id = public.miyko_current_user_id()));--> statement-breakpoint
CREATE POLICY "provider_secrets_update_own" ON "provider_secrets" AS PERMISSIVE FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = "provider_secrets"."user_provider_account_id" AND account.user_id = public.miyko_current_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = "provider_secrets"."user_provider_account_id" AND account.user_id = public.miyko_current_user_id()));--> statement-breakpoint
CREATE POLICY "provider_secrets_delete_own" ON "provider_secrets" AS PERMISSIVE FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = "provider_secrets"."user_provider_account_id" AND account.user_id = public.miyko_current_user_id()));--> statement-breakpoint

CREATE POLICY "memory_initializations_select_own" ON "memory_initializations" AS PERMISSIVE FOR SELECT TO public USING ("memory_initializations"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "memory_initializations_insert_own" ON "memory_initializations" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("memory_initializations"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "memory_initializations_update_own" ON "memory_initializations" AS PERMISSIVE FOR UPDATE TO public USING ("memory_initializations"."user_id" = public.miyko_current_user_id()) WITH CHECK ("memory_initializations"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "memory_initializations_delete_own" ON "memory_initializations" AS PERMISSIVE FOR DELETE TO public USING ("memory_initializations"."user_id" = public.miyko_current_user_id());--> statement-breakpoint

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_claim_consistency" CHECK (("claimed_at" IS NULL AND "claimed_by" IS NULL AND "claim_expires_at" IS NULL) OR ("claimed_at" IS NOT NULL AND "claimed_by" IS NOT NULL AND "claim_expires_at" IS NOT NULL));--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "provider_secrets" TO "api_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "memory_initializations" TO "api_role";--> statement-breakpoint
