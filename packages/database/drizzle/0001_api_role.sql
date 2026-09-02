-- api_role is created exactly once by packages/database/docker/init/001-create-api-role.sh.
-- This migration only grants runtime privileges and installs controlled auth helpers.
GRANT USAGE ON SCHEMA public TO "api_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "api_role";--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "api_role";--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_auth_find_user_by_email(target_email varchar)
RETURNS TABLE (id uuid, email varchar, normalized_email varchar, password_hash text, first_name varchar, last_name varchar, display_name varchar, status public.account_status, last_login_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT u.id, u.email, u.normalized_email, u.password_hash, u.first_name, u.last_name, u.display_name, u.status, u.last_login_at
  FROM public.users u
  WHERE u.normalized_email = target_email AND u.status = 'active'
  LIMIT 1
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_auth_find_session(target_token_hash text)
RETURNS TABLE (session_id uuid, user_id uuid, expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.last_used_at
  FROM public.user_sessions s
  WHERE s.token_hash = target_token_hash AND s.revoked_at IS NULL AND s.expires_at > now()
  LIMIT 1
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.miyko_auth_create_user(target_email varchar, target_normalized_email varchar, target_password_hash text, target_first_name varchar, target_last_name varchar, target_display_name varchar)
RETURNS TABLE (id uuid, email varchar, normalized_email varchar, password_hash text, first_name varchar, last_name varchar, display_name varchar, status public.account_status, last_login_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  INSERT INTO public.users (email, normalized_email, password_hash, first_name, last_name, display_name)
  VALUES (target_email, target_normalized_email, target_password_hash, target_first_name, target_last_name, target_display_name)
  ON CONFLICT (normalized_email) DO NOTHING
  RETURNING users.id, users.email, users.normalized_email, users.password_hash, users.first_name, users.last_name, users.display_name, users.status, users.last_login_at
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.miyko_current_user_id() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_is_household_member(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_can_bootstrap_household(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_auth_find_user_by_email(varchar) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_auth_find_session(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.miyko_auth_create_user(varchar, varchar, text, varchar, varchar, varchar) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_current_user_id() TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_is_household_member(uuid) TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_can_bootstrap_household(uuid) TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_auth_find_user_by_email(varchar) TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_auth_find_session(text) TO "api_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.miyko_auth_create_user(varchar, varchar, text, varchar, varchar, varchar) TO "api_role";--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "api_role";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "api_role";
