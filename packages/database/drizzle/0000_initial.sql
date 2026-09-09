CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE public.household_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.membership_status AS ENUM ('active', 'removed');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'revoked');
CREATE TYPE public.provider_status AS ENUM ('active', 'inactive');
CREATE TYPE public.provider_auth_method AS ENUM ('oauth');
CREATE TYPE public.provider_account_status AS ENUM ('active', 'expired', 'revoked', 'reconnect_required');
CREATE TYPE public.provider_secret_kind AS ENUM ('access_token', 'refresh_token');
CREATE TYPE public.workflow_status AS ENUM ('pending', 'running', 'interrupted', 'succeeded', 'failed', 'cancelled');
CREATE TYPE public.workflow_kind AS ENUM ('step-order');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'declined');
CREATE TYPE public.workflow_action AS ENUM ('provider_action', 'fulfillment', 'delivery_slot');
CREATE TYPE public.outbox_status AS ENUM ('pending', 'processing', 'published', 'retrying', 'dead_letter');

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  normalized_email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  display_name varchar(200),
  status public.account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT user_sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.household_role NOT NULL DEFAULT 'viewer',
  status public.membership_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT household_members_removed_at_consistency CHECK ((status = 'active' AND removed_at IS NULL) OR (status = 'removed' AND removed_at IS NOT NULL))
);

CREATE TABLE public.household_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  invitee_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invitee_email varchar(320),
  role public.household_role NOT NULL DEFAULT 'viewer',
  token_hash text NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT household_invitations_invitee_identity_check CHECK (invitee_user_id IS NOT NULL OR invitee_email IS NOT NULL)
);

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  slug varchar(80) NOT NULL,
  status public.provider_status NOT NULL DEFAULT 'active',
  capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  provider_subject varchar(255),
  account_login varchar(320),
  auth_method public.provider_auth_method NOT NULL,
  status public.provider_account_status NOT NULL DEFAULT 'active',
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.provider_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_provider_account_id uuid NOT NULL REFERENCES public.user_providers(id) ON DELETE CASCADE,
  kind public.provider_secret_kind NOT NULL,
  encrypted_value bytea NOT NULL,
  key_version varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.connected_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  user_provider_account_id uuid NOT NULL REFERENCES public.user_providers(id) ON DELETE CASCADE,
  authorized_by_member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE RESTRICT,
  status public.provider_account_status NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.provider_oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  state_hash varchar(64) NOT NULL,
  encrypted_session bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  started_by_member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  workflow_kind public.workflow_kind NOT NULL DEFAULT 'step-order',
  status public.workflow_status NOT NULL DEFAULT 'pending',
  thread_id varchar(255) NOT NULL,
  run_id varchar(255),
  provider_basket_id varchar(255),
  provider_order_id varchar(255),
  fulfillment_mode varchar(16),
  scheduled_from timestamptz,
  scheduled_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflows_scheduled_window_check CHECK (scheduled_to IS NULL OR scheduled_from IS NULL OR scheduled_to >= scheduled_from)
);

CREATE TABLE public.workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  requested_by_member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE RESTRICT,
  external_request_id varchar(255),
  action public.workflow_action NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  decided_by_member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_approvals_decision_consistency CHECK ((status = 'pending' AND decided_at IS NULL AND decided_by_member_id IS NULL) OR (status IN ('approved', 'declined') AND decided_at IS NOT NULL AND decided_by_member_id IS NOT NULL))
);

CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(120) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  status public.outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by varchar(120),
  claim_expires_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_events_claim_consistency CHECK ((claimed_at IS NULL AND claimed_by IS NULL AND claim_expires_at IS NULL) OR (claimed_at IS NOT NULL AND claimed_by IS NOT NULL AND claim_expires_at IS NOT NULL))
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_normalized_email_uq ON public.users (normalized_email);
CREATE UNIQUE INDEX user_sessions_token_hash_uq ON public.user_sessions (token_hash);
CREATE INDEX user_sessions_user_active_idx ON public.user_sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX households_owner_id_idx ON public.households (owner_id);
CREATE UNIQUE INDEX household_members_household_user_uq ON public.household_members (household_id, user_id);
CREATE UNIQUE INDEX household_members_one_active_owner_uq ON public.household_members (household_id) WHERE status = 'active' AND role = 'owner';
CREATE INDEX household_members_user_active_idx ON public.household_members (user_id, household_id) WHERE status = 'active';
CREATE INDEX household_members_household_active_idx ON public.household_members (household_id, status);
CREATE UNIQUE INDEX household_invitations_token_hash_uq ON public.household_invitations (token_hash);
CREATE INDEX household_invitations_household_status_idx ON public.household_invitations (household_id, status);
CREATE INDEX household_invitations_invitee_email_idx ON public.household_invitations (invitee_email);
CREATE UNIQUE INDEX providers_slug_uq ON public.providers (slug);
CREATE UNIQUE INDEX providers_name_uq ON public.providers (name);
CREATE UNIQUE INDEX user_providers_user_provider_subject_uq ON public.user_providers (user_id, provider_id, provider_subject);
CREATE INDEX user_providers_user_status_idx ON public.user_providers (user_id, status);
CREATE UNIQUE INDEX provider_secrets_account_kind_uq ON public.provider_secrets (user_provider_account_id, kind);
CREATE UNIQUE INDEX connected_provider_accounts_household_provider_uq ON public.connected_provider_accounts (household_id, provider_id);
CREATE INDEX connected_provider_accounts_household_status_idx ON public.connected_provider_accounts (household_id, status);
CREATE UNIQUE INDEX provider_oauth_sessions_state_hash_uq ON public.provider_oauth_sessions (state_hash);
CREATE INDEX provider_oauth_sessions_expiry_idx ON public.provider_oauth_sessions (expires_at);
CREATE UNIQUE INDEX workflows_thread_uq ON public.workflows (thread_id);
CREATE INDEX workflows_household_status_idx ON public.workflows (household_id, status);
CREATE INDEX workflow_approvals_workflow_status_idx ON public.workflow_approvals (workflow_id, status);
CREATE UNIQUE INDEX workflow_approvals_external_request_uq ON public.workflow_approvals (workflow_id, external_request_id);
CREATE UNIQUE INDEX outbox_events_aggregate_transition_uq ON public.outbox_events (aggregate_type, aggregate_id, event_type, version);
CREATE INDEX outbox_events_claim_idx ON public.outbox_events (status, available_at, claim_expires_at);
CREATE INDEX audit_logs_household_created_idx ON public.audit_logs (household_id, created_at);
CREATE INDEX audit_logs_aggregate_idx ON public.audit_logs (aggregate_type, aggregate_id);

CREATE OR REPLACE FUNCTION public.miyko_current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.miyko_current_user_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT lower(u.email::text) FROM public.users u WHERE u.id = public.miyko_current_user_id() $$;

CREATE OR REPLACE FUNCTION public.miyko_is_household_member(target_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM public.household_members member WHERE member.household_id = target_household_id AND member.user_id = public.miyko_current_user_id() AND member.status = 'active') $$;

CREATE OR REPLACE FUNCTION public.miyko_can_bootstrap_household(target_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM public.households household WHERE household.id = target_household_id AND household.owner_id = public.miyko_current_user_id()) AND NOT EXISTS (SELECT 1 FROM public.household_members member WHERE member.household_id = target_household_id AND member.status = 'active') $$;

CREATE OR REPLACE FUNCTION public.miyko_can_accept_household_invitation(target_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM public.household_invitations invitation LEFT JOIN public.users invitee ON invitee.id = public.miyko_current_user_id() WHERE invitation.household_id = target_household_id AND invitation.status = 'pending' AND invitation.expires_at > now() AND (invitation.invitee_user_id = public.miyko_current_user_id() OR lower(invitation.invitee_email) = lower(invitee.email))) $$;

CREATE OR REPLACE FUNCTION public.miyko_auth_find_user_by_email(target_email varchar)
RETURNS TABLE (id uuid, email varchar, normalized_email varchar, password_hash text, first_name varchar, last_name varchar, display_name varchar, status public.account_status, last_login_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT u.id, u.email, u.normalized_email, u.password_hash, u.first_name, u.last_name, u.display_name, u.status, u.last_login_at FROM public.users u WHERE u.normalized_email = target_email AND u.status = 'active' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.miyko_auth_find_session(target_token_hash text)
RETURNS TABLE (session_id uuid, user_id uuid, expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.last_used_at FROM public.user_sessions s WHERE s.token_hash = target_token_hash AND s.revoked_at IS NULL AND s.expires_at > now() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.miyko_provider_oauth_find_session(target_state_hash varchar)
RETURNS TABLE (session_id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT session.id, session.user_id FROM public.provider_oauth_sessions session WHERE session.state_hash = target_state_hash AND session.completed_at IS NULL AND session.expires_at > now() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.miyko_auth_create_user(target_email varchar, target_normalized_email varchar, target_password_hash text, target_first_name varchar, target_last_name varchar, target_display_name varchar)
RETURNS TABLE (id uuid, email varchar, normalized_email varchar, password_hash text, first_name varchar, last_name varchar, display_name varchar, status public.account_status, last_login_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ INSERT INTO public.users (email, normalized_email, password_hash, first_name, last_name, display_name) VALUES (target_email, target_normalized_email, target_password_hash, target_first_name, target_last_name, target_display_name) ON CONFLICT (normalized_email) DO NOTHING RETURNING users.id, users.email, users.normalized_email, users.password_hash, users.first_name, users.last_name, users.display_name, users.status, users.last_login_at $$;

CREATE OR REPLACE FUNCTION public.miyko_auth_create_session(target_user_id uuid, target_token_hash text, target_expires_at timestamptz)
RETURNS TABLE (session_id uuid)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ INSERT INTO public.user_sessions (user_id, token_hash, expires_at) SELECT u.id, target_token_hash, target_expires_at FROM public.users u WHERE u.id = target_user_id AND u.status = 'active' RETURNING user_sessions.id $$;

CREATE OR REPLACE FUNCTION public.miyko_household_members(target_household_id uuid)
RETURNS TABLE (
  member_id uuid,
  household_id uuid,
  user_id uuid,
  role public.household_role,
  status public.membership_status,
  joined_at timestamptz,
  removed_at timestamptz,
  email varchar,
  display_name varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT member.id,
         member.household_id,
         member.user_id,
         member.role,
         member.status,
         member.joined_at,
         member.removed_at,
         account.email,
         COALESCE(
           NULLIF(account.display_name, ''),
           NULLIF(concat_ws(' ', account.first_name, account.last_name), '')
         )::varchar
  FROM public.household_members member
  JOIN public.users account ON account.id = member.user_id
  WHERE member.household_id = target_household_id
    AND public.miyko_is_household_member(target_household_id)
  ORDER BY member.joined_at, member.id
$$;

CREATE OR REPLACE FUNCTION public.miyko_claim_outbox_events(target_worker_id varchar, target_limit integer, target_lease_ms integer)
RETURNS TABLE (
  user_id uuid,
  member_id uuid,
  id uuid,
  household_id uuid,
  aggregate_type varchar,
  aggregate_id uuid,
  event_type varchar,
  version integer,
  payload jsonb,
  status public.outbox_status,
  attempts integer,
  available_at timestamptz,
  claimed_at timestamptz,
  claimed_by varchar,
  claim_expires_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF target_worker_id IS NULL OR btrim(target_worker_id) = '' THEN
    RAISE EXCEPTION 'worker id is required' USING ERRCODE = '22023';
  END IF;
  IF target_limit < 1 OR target_limit > 100 THEN
    RAISE EXCEPTION 'claim limit is out of range' USING ERRCODE = '22023';
  END IF;
  IF target_lease_ms < 1000 OR target_lease_ms > 3600000 THEN
    RAISE EXCEPTION 'lease duration is out of range' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id, member.id AS member_id
    FROM public.outbox_events e
    JOIN LATERAL (
      SELECT m.id
      FROM public.household_members m
      WHERE m.household_id = e.household_id
        AND m.status = 'active'
      ORDER BY
        (m.id::text = e.payload ->> 'requestedByMemberId') DESC,
        (m.role = 'owner') DESC,
        m.joined_at,
        m.id
      LIMIT 1
    ) member ON true
    WHERE (
      e.status IN ('pending', 'retrying')
      AND e.available_at <= clock_timestamp()
    ) OR (
      e.status = 'processing'
      AND e.claim_expires_at <= clock_timestamp()
    )
    ORDER BY e.available_at, e.created_at, e.id
    LIMIT target_limit
    FOR UPDATE OF e SKIP LOCKED
  ), claimed AS (
    UPDATE public.outbox_events e
    SET status = 'processing',
        attempts = e.attempts + 1,
        claimed_at = clock_timestamp(),
        claimed_by = target_worker_id,
        claim_expires_at = clock_timestamp() + (target_lease_ms * interval '1 millisecond'),
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE e.id = c.id
    RETURNING e.*, c.member_id
  )
  SELECT member.user_id, c.member_id, c.id, c.household_id, c.aggregate_type,
         c.aggregate_id, c.event_type, c.version, c.payload, c.status,
         c.attempts, c.available_at, c.claimed_at, c.claimed_by,
         c.claim_expires_at, c.processed_at, c.last_error, c.created_at,
         c.updated_at
  FROM claimed c
  JOIN public.household_members member ON member.id = c.member_id
  WHERE member.status = 'active';
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT USING (id = public.miyko_current_user_id());
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (id = public.miyko_current_user_id()) WITH CHECK (id = public.miyko_current_user_id());
CREATE POLICY user_sessions_select_own ON public.user_sessions FOR SELECT USING (user_id = public.miyko_current_user_id());
CREATE POLICY user_sessions_insert_own ON public.user_sessions FOR INSERT WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY user_sessions_update_own ON public.user_sessions FOR UPDATE USING (user_id = public.miyko_current_user_id()) WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY user_sessions_delete_own ON public.user_sessions FOR DELETE USING (user_id = public.miyko_current_user_id());
CREATE POLICY households_select ON public.households FOR SELECT USING (owner_id = public.miyko_current_user_id() OR public.miyko_is_household_member(id));
CREATE POLICY households_insert ON public.households FOR INSERT WITH CHECK (owner_id = public.miyko_current_user_id());
CREATE POLICY households_update ON public.households FOR UPDATE USING (public.miyko_is_household_member(id)) WITH CHECK (public.miyko_is_household_member(id));
CREATE POLICY households_delete ON public.households FOR DELETE USING (public.miyko_is_household_member(id));
CREATE POLICY household_members_select ON public.household_members FOR SELECT USING (user_id = public.miyko_current_user_id() OR public.miyko_is_household_member(household_id));
CREATE POLICY household_members_insert ON public.household_members FOR INSERT WITH CHECK (public.miyko_is_household_member(household_id) OR public.miyko_can_accept_household_invitation(household_id) OR (public.miyko_can_bootstrap_household(household_id) AND user_id = public.miyko_current_user_id()));
CREATE POLICY household_members_update ON public.household_members FOR UPDATE USING (public.miyko_is_household_member(household_id) OR (user_id = public.miyko_current_user_id() AND public.miyko_can_accept_household_invitation(household_id))) WITH CHECK (public.miyko_is_household_member(household_id) OR (user_id = public.miyko_current_user_id() AND public.miyko_can_accept_household_invitation(household_id)));
CREATE POLICY household_members_delete ON public.household_members FOR DELETE USING (public.miyko_is_household_member(household_id));
CREATE POLICY household_invitations_select ON public.household_invitations FOR SELECT USING (public.miyko_is_household_member(household_id) OR invitee_user_id = public.miyko_current_user_id() OR invitee_email = public.miyko_current_user_email());
CREATE POLICY household_invitations_insert ON public.household_invitations FOR INSERT WITH CHECK (public.miyko_is_household_member(household_id));
CREATE POLICY household_invitations_update ON public.household_invitations FOR UPDATE USING (public.miyko_is_household_member(household_id) OR invitee_user_id = public.miyko_current_user_id() OR invitee_email = public.miyko_current_user_email()) WITH CHECK (public.miyko_is_household_member(household_id) OR invitee_user_id = public.miyko_current_user_id() OR invitee_email = public.miyko_current_user_email());
CREATE POLICY household_invitations_delete ON public.household_invitations FOR DELETE USING (public.miyko_is_household_member(household_id));
CREATE POLICY providers_select_active ON public.providers FOR SELECT USING (status = 'active');

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['connected_provider_accounts', 'workflows', 'workflow_approvals', 'outbox_events', 'audit_logs'] LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.miyko_is_household_member(household_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.miyko_is_household_member(household_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.miyko_is_household_member(household_id)) WITH CHECK (public.miyko_is_household_member(household_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (public.miyko_is_household_member(household_id))', table_name, table_name);
  END LOOP;
END $$;

CREATE POLICY user_providers_select_own ON public.user_providers FOR SELECT USING (user_id = public.miyko_current_user_id());
CREATE POLICY user_providers_insert_own ON public.user_providers FOR INSERT WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY user_providers_update_own ON public.user_providers FOR UPDATE USING (user_id = public.miyko_current_user_id()) WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY user_providers_delete_own ON public.user_providers FOR DELETE USING (user_id = public.miyko_current_user_id());

CREATE POLICY provider_secrets_select_bound_household ON public.provider_secrets FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = user_provider_account_id AND account.user_id = public.miyko_current_user_id()) OR EXISTS (SELECT 1 FROM public.connected_provider_accounts connection WHERE connection.user_provider_account_id = user_provider_account_id AND connection.status = 'active' AND public.miyko_is_household_member(connection.household_id)));
CREATE POLICY provider_secrets_insert_own ON public.provider_secrets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = user_provider_account_id AND account.user_id = public.miyko_current_user_id()));
CREATE POLICY provider_secrets_update_own ON public.provider_secrets FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = user_provider_account_id AND account.user_id = public.miyko_current_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = user_provider_account_id AND account.user_id = public.miyko_current_user_id()));
CREATE POLICY provider_secrets_delete_own ON public.provider_secrets FOR DELETE USING (EXISTS (SELECT 1 FROM public.user_providers account WHERE account.id = user_provider_account_id AND account.user_id = public.miyko_current_user_id()));

CREATE POLICY provider_oauth_sessions_select_own ON public.provider_oauth_sessions FOR SELECT USING (user_id = public.miyko_current_user_id());
CREATE POLICY provider_oauth_sessions_insert_own ON public.provider_oauth_sessions FOR INSERT WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY provider_oauth_sessions_update_own ON public.provider_oauth_sessions FOR UPDATE USING (user_id = public.miyko_current_user_id()) WITH CHECK (user_id = public.miyko_current_user_id());
CREATE POLICY provider_oauth_sessions_delete_own ON public.provider_oauth_sessions FOR DELETE USING (user_id = public.miyko_current_user_id());

GRANT USAGE ON SCHEMA public TO api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_role;
REVOKE ALL ON FUNCTION public.miyko_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_current_user_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_is_household_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_can_bootstrap_household(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_can_accept_household_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_auth_find_user_by_email(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_auth_find_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_provider_oauth_find_session(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_auth_create_user(varchar, varchar, text, varchar, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_auth_create_session(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_household_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.miyko_claim_outbox_events(varchar, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.miyko_current_user_id() TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_current_user_email() TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_is_household_member(uuid) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_can_bootstrap_household(uuid) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_can_accept_household_invitation(uuid) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_auth_find_user_by_email(varchar) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_auth_find_session(text) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_provider_oauth_find_session(varchar) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_auth_create_user(varchar, varchar, text, varchar, varchar, varchar) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_auth_create_session(uuid, text, timestamptz) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_household_members(uuid) TO api_role;
GRANT EXECUTE ON FUNCTION public.miyko_claim_outbox_events(varchar, integer, integer) TO api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO api_role;
