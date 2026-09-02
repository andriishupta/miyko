-- Generalize the original store catalog into a provider catalog. The TypeScript
-- export keeps its legacy name for compatibility, but the database is generic.
ALTER TABLE "shopping_providers" RENAME TO "providers";--> statement-breakpoint

CREATE TYPE "public"."provider_kind" AS ENUM('store', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."provider_auth_method" AS ENUM('oauth', 'password', 'api_key', 'mcp');--> statement-breakpoint

ALTER TABLE "providers" ADD COLUMN "kind" "public"."provider_kind" DEFAULT 'store' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "status" "public"."provider_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "capabilities" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint

CREATE TABLE "user_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_subject" varchar(255),
	"account_login" varchar(320),
	"auth_method" "provider_auth_method" NOT NULL,
	"status" "provider_account_status" DEFAULT 'active' NOT NULL,
	"access_token_reference" text,
	"refresh_token_reference" text,
	"credential_reference" text,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "connected_provider_accounts" ADD COLUMN "user_provider_account_id" uuid;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" DROP COLUMN "access_token_reference";--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" DROP COLUMN "refresh_token_reference";--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" DROP COLUMN "scopes";--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" DROP COLUMN "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" DROP COLUMN "refresh_token_expires_at";--> statement-breakpoint

ALTER TABLE "deliveries" ADD COLUMN "delivery_provider_id" uuid;--> statement-breakpoint

ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_provider_accounts" ADD CONSTRAINT "connected_provider_accounts_user_provider_account_id_user_providers_id_fk" FOREIGN KEY ("user_provider_account_id") REFERENCES "public"."user_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivery_provider_id_providers_id_fk" FOREIGN KEY ("delivery_provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "user_providers_user_provider_subject_uq" ON "user_providers" USING btree ("user_id","provider_id","provider_subject");--> statement-breakpoint
CREATE INDEX "user_providers_user_status_idx" ON "user_providers" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_providers_provider_status_idx" ON "user_providers" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "connected_provider_accounts_user_account_idx" ON "connected_provider_accounts" USING btree ("user_provider_account_id");--> statement-breakpoint
CREATE INDEX "deliveries_provider_status_idx" ON "deliveries" USING btree ("delivery_provider_id","status");--> statement-breakpoint

CREATE POLICY "user_providers_select_own" ON "user_providers" AS PERMISSIVE FOR SELECT TO public USING ("user_providers"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_providers_insert_own" ON "user_providers" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("user_providers"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_providers_update_own" ON "user_providers" AS PERMISSIVE FOR UPDATE TO public USING ("user_providers"."user_id" = public.miyko_current_user_id()) WITH CHECK ("user_providers"."user_id" = public.miyko_current_user_id());--> statement-breakpoint
CREATE POLICY "user_providers_delete_own" ON "user_providers" AS PERMISSIVE FOR DELETE TO public USING ("user_providers"."user_id" = public.miyko_current_user_id());--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_providers" TO "api_role";--> statement-breakpoint
