-- Align household authorization with role-only permissions and keep auth
-- bootstrap operations available before app.user_id is set.
ALTER ROLE "api_role"
  WITH LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    NOBYPASSRLS;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_enum value
    JOIN pg_catalog.pg_type type ON type.oid = value.enumtypid
    WHERE type.typnamespace = 'public'::regnamespace
      AND type.typname = 'household_role'
      AND value.enumlabel = 'member'
  ) THEN
    ALTER TABLE public.household_members ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.household_invitations ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.household_members ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE public.household_invitations ALTER COLUMN role TYPE text USING role::text;
    UPDATE public.household_members SET role = 'viewer' WHERE role = 'member';
    UPDATE public.household_invitations SET role = 'viewer' WHERE role = 'member';
    CREATE TYPE public.household_role_v2 AS ENUM ('owner', 'admin', 'editor', 'viewer');
    ALTER TABLE public.household_members ALTER COLUMN role TYPE public.household_role_v2 USING role::public.household_role_v2;
    ALTER TABLE public.household_invitations ALTER COLUMN role TYPE public.household_role_v2 USING role::public.household_role_v2;
    DROP TYPE public.household_role;
    ALTER TYPE public.household_role_v2 RENAME TO household_role;
    ALTER TABLE public.household_members ALTER COLUMN role SET DEFAULT 'viewer';
    ALTER TABLE public.household_invitations ALTER COLUMN role SET DEFAULT 'viewer';
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "household_members" DROP CONSTRAINT IF EXISTS "household_members_owner_decision_consistency";--> statement-breakpoint
ALTER TABLE "household_members" DROP COLUMN IF EXISTS "can_make_decisions";--> statement-breakpoint
ALTER TABLE "household_invitations" DROP COLUMN IF EXISTS "can_make_decisions";--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_can_bootstrap_household(target_household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.households household
    WHERE household.id = target_household_id
      AND household.owner_id = public.miyko_current_user_id()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.household_members member
    WHERE member.household_id = target_household_id AND member.status = 'active'
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_current_user_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT lower(u.email::text)
  FROM public.users u
  WHERE u.id = public.miyko_current_user_id()
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_can_accept_household_invitation(target_household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_invitations invitation
    LEFT JOIN public.users invitee ON invitee.id = public.miyko_current_user_id()
    WHERE invitation.household_id = target_household_id
      AND invitation.status = 'pending'
      AND invitation.expires_at > now()
      AND (
        invitation.invitee_user_id = public.miyko_current_user_id()
        OR lower(invitation.invitee_email) = lower(invitee.email)
      )
  )
$$;--> statement-breakpoint

DROP POLICY IF EXISTS "household_invitations_select" ON "household_invitations";--> statement-breakpoint
CREATE POLICY "household_invitations_select" ON "household_invitations" AS PERMISSIVE FOR SELECT TO public USING (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id() OR "household_invitations"."invitee_email" = public.miyko_current_user_email());--> statement-breakpoint
DROP POLICY IF EXISTS "household_invitations_update" ON "household_invitations";--> statement-breakpoint
CREATE POLICY "household_invitations_update" ON "household_invitations" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id() OR "household_invitations"."invitee_email" = public.miyko_current_user_email()) WITH CHECK (public.miyko_is_household_member("household_invitations"."household_id") OR "household_invitations"."invitee_user_id" = public.miyko_current_user_id() OR "household_invitations"."invitee_email" = public.miyko_current_user_email());--> statement-breakpoint
DROP POLICY IF EXISTS "household_members_insert" ON "household_members";--> statement-breakpoint
CREATE POLICY "household_members_insert" ON "household_members" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((public.miyko_is_household_member("household_members"."household_id") OR public.miyko_can_accept_household_invitation("household_members"."household_id") OR (public.miyko_can_bootstrap_household("household_members"."household_id") AND "household_members"."user_id" = public.miyko_current_user_id())));--> statement-breakpoint
DROP POLICY IF EXISTS "household_members_update" ON "household_members";--> statement-breakpoint
CREATE POLICY "household_members_update" ON "household_members" AS PERMISSIVE FOR UPDATE TO public USING (public.miyko_is_household_member("household_members"."household_id") OR ("household_members"."user_id" = public.miyko_current_user_id() AND public.miyko_can_accept_household_invitation("household_members"."household_id"))) WITH CHECK (public.miyko_is_household_member("household_members"."household_id") OR ("household_members"."user_id" = public.miyko_current_user_id() AND public.miyko_can_accept_household_invitation("household_members"."household_id")));--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_auth_create_session(target_user_id uuid, target_token_hash text, target_expires_at timestamptz)
RETURNS TABLE (session_id uuid)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  INSERT INTO public.user_sessions (user_id, token_hash, expires_at)
  SELECT u.id, target_token_hash, target_expires_at
  FROM public.users u
  WHERE u.id = target_user_id AND u.status = 'active'
  RETURNING user_sessions.id
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.miyko_auth_create_session(uuid, text, timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_current_user_email() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_can_accept_household_invitation(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_auth_create_session(uuid, text, timestamptz) TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_current_user_email() TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_can_accept_household_invitation(uuid) TO "api_role";--> statement-breakpoint
