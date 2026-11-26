-- =============================================================================
-- P0 — Core foundation
-- BLKPVNTHR LLC Corporate Administration & Grant Readiness Portal
--
-- Schemas, extensions, identity/RBAC, append-only audit log, helper functions,
-- and deny-by-default Row Level Security. Everything here is tenant-isolated and
-- MFA-aware. Business-domain schemas (documents, corporate, finance, research,
-- commercialization, funding) arrive in later phases and reuse these primitives.
--
-- Security model:
--   * RLS enabled + FORCED on every table; no policy => no access (deny-by-default).
--   * Authorization derives from server-controlled rows in
--     core.organization_memberships + core.role_permissions, never from
--     user-editable JWT metadata.
--   * Writes to sensitive tables additionally require MFA assurance (aal2).
--   * Privileged lookups run through SECURITY DEFINER helpers in a private schema
--     that is never exposed to the Data API.
-- =============================================================================

-- ---------------------------------------------------------------- extensions
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;   -- digest() for hashing
create extension if not exists citext   with schema extensions;   -- case-insensitive email
create extension if not exists pg_trgm  with schema extensions;   -- fuzzy / future FTS
grant usage on schema extensions to authenticated, anon;

-- -------------------------------------------------------------------- schemas
create schema if not exists core;           -- identity, org, RBAC
create schema if not exists private;         -- SECURITY DEFINER helpers; NEVER exposed to Data API
create schema if not exists administration;  -- audit_logs (+ tasks/notifications later)

-- Deny-by-default at the schema level. `authenticated` gets USAGE so RLS-gated
-- tables are reachable; `anon` gets nothing; `private` is server-internal only.
revoke all on schema core, private, administration from public;
revoke all on schema private from anon, authenticated;
grant usage on schema core, administration to authenticated;
grant usage on schema private to authenticated;  -- needed to CALL helpers inside RLS (not Data-API exposed)

-- --------------------------------------------------------------------- enums
create type core.user_status       as enum ('invited', 'active', 'disabled');
create type core.membership_status as enum ('invited', 'active', 'suspended', 'revoked');
create type core.record_status     as enum ('active', 'archived');

-- ============================================================================
-- Tables
-- ============================================================================

-- core.organizations ---------------------------------------------------------
create table core.organizations (
  id            uuid primary key default gen_random_uuid(),
  legal_name    text not null,
  display_name  text,
  status        core.record_status not null default 'active',
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users (id),
  row_version   integer not null default 1
);

-- core.user_profiles (1:1 with auth.users) -----------------------------------
create table core.user_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       extensions.citext,
  full_name   text,
  display_name text,
  status      core.user_status not null default 'invited',
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  row_version integer not null default 1
);

-- core.roles / permissions / mapping (reference data) ------------------------
create table core.roles (
  key         text primary key,
  name        text not null,
  description text,
  rank        integer not null            -- higher = more privileged (owner highest)
);

create table core.permissions (
  key         text primary key,           -- e.g. 'finance.write'
  description text
);

create table core.role_permissions (
  role_key       text not null references core.roles (key) on delete cascade,
  permission_key text not null references core.permissions (key) on delete cascade,
  primary key (role_key, permission_key)
);

-- core.organization_memberships (authorization source of truth) --------------
create table core.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role_key        text not null references core.roles (key),
  status          core.membership_status not null default 'invited',
  invited_by      uuid references auth.users (id),
  invited_at      timestamptz,
  activated_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id),
  row_version     integer not null default 1,
  unique (organization_id, user_id)
);

-- administration.audit_logs (append-only) ------------------------------------
create table administration.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references core.organizations (id),
  actor_user_id   uuid references auth.users (id),
  event_type      text not null,
  entity_schema   text,
  entity_table    text,
  entity_id       text,
  before          jsonb,
  after           jsonb,
  outcome         text not null default 'success',   -- success | failure
  request_id      text,
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create index organizations_status_idx           on core.organizations (status) where deleted_at is null;
create index user_profiles_email_idx            on core.user_profiles (email);
create index role_permissions_permission_idx    on core.role_permissions (permission_key);
create index memberships_user_idx               on core.organization_memberships (user_id);
create index memberships_org_idx                on core.organization_memberships (organization_id);
create index memberships_org_user_active_idx    on core.organization_memberships (organization_id, user_id) where status = 'active';
create index memberships_role_idx               on core.organization_memberships (role_key);
create index audit_logs_org_created_idx         on administration.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx               on administration.audit_logs (actor_user_id);
create index audit_logs_entity_idx              on administration.audit_logs (entity_schema, entity_table, entity_id);

-- ============================================================================
-- Helper functions (private schema; SECURITY DEFINER; search_path = '')
-- Each validates the caller's own identity via auth.uid(). Safe to expose to
-- `authenticated` for RLS evaluation; never added to the Data API schema list.
-- ============================================================================

-- MFA assurance level from the verified JWT (not user-editable metadata).
create or replace function private.is_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- Active membership in an org for the current user.
create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from core.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = p_org
      and m.status = 'active'
  );
$$;

-- Current user holds a permission in an org (via active membership's role).
create or replace function private.has_permission(p_org uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from core.organization_memberships m
    join core.role_permissions rp on rp.role_key = m.role_key
    where m.user_id = (select auth.uid())
      and m.organization_id = p_org
      and m.status = 'active'
      and rp.permission_key = p_perm
  );
$$;

-- Current user's role rank in an org (null if not an active member).
create or replace function private.role_rank(p_org uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select r.rank
  from core.organization_memberships m
  join core.roles r on r.key = m.role_key
  where m.user_id = (select auth.uid())
    and m.organization_id = p_org
    and m.status = 'active';
$$;

revoke all on function private.is_mfa(), private.is_org_member(uuid),
  private.has_permission(uuid, text), private.role_rank(uuid) from public, anon;
grant execute on function private.is_mfa(), private.is_org_member(uuid),
  private.has_permission(uuid, text), private.role_rank(uuid) to authenticated;

-- ============================================================================
-- Trigger functions
-- ============================================================================

-- Maintain created/updated audit columns + optimistic-concurrency row_version.
create or replace function core.tg_audit_columns()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    new.created_at  := coalesce(new.created_at, now());
    new.created_by  := coalesce(new.created_by, (select auth.uid()));
    new.updated_at  := new.created_at;
    new.updated_by  := new.created_by;
    new.row_version := coalesce(new.row_version, 1);
  elsif (tg_op = 'UPDATE') then
    new.created_at  := old.created_at;      -- immutable
    new.created_by  := old.created_by;      -- immutable
    new.updated_at  := now();
    new.updated_by  := coalesce((select auth.uid()), new.updated_by);
    new.row_version := old.row_version + 1;
  end if;
  return new;
end;
$$;

-- Simpler variant for tables without created_by/updated_by (user_profiles).
create or replace function core.tg_touch_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.created_at  := coalesce(old.created_at, new.created_at, now());
  new.updated_at  := now();
  new.row_version := coalesce(old.row_version, 0) + 1;
  return new;
end;
$$;

-- Prevent privilege escalation on memberships:
--   * a user may never change their OWN membership (role or status);
--   * only an owner may create/modify an 'owner' membership;
--   * a user may never grant a role outranking their own.
create or replace function core.tg_membership_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := private.role_rank(new.organization_id);
  v_target_rank integer;
begin
  select rank into v_target_rank from core.roles where key = new.role_key;

  -- Self-modification of one's own membership is forbidden (no self-elevation).
  if v_actor is not null and new.user_id = v_actor then
    if (tg_op = 'UPDATE' and (new.role_key is distinct from old.role_key
                              or new.status is distinct from old.status))
       or tg_op = 'INSERT' then
      raise exception 'A user cannot create or alter their own membership';
    end if;
  end if;

  -- Cannot assign a role that outranks (or equals, unless owner) the actor's role.
  -- The bootstrap/service path (v_actor is null) is exempt; it runs server-side only.
  if v_actor is not null then
    if v_actor_rank is null then
      raise exception 'Only an active member may manage memberships';
    end if;
    if v_target_rank > v_actor_rank then
      raise exception 'Cannot assign a role above your own privilege level';
    end if;
    if new.role_key = 'owner' and v_actor_rank < (select rank from core.roles where key = 'owner') then
      raise exception 'Only an owner may grant the owner role';
    end if;
  end if;

  return new;
end;
$$;

-- Attach triggers
create trigger t_audit_columns before insert or update on core.organizations
  for each row execute function core.tg_audit_columns();
create trigger t_audit_columns before insert or update on core.organization_memberships
  for each row execute function core.tg_audit_columns();
create trigger t_membership_guard before insert or update on core.organization_memberships
  for each row execute function core.tg_membership_guard();
create trigger t_touch before update on core.user_profiles
  for each row execute function core.tg_touch_row();

-- ============================================================================
-- Row Level Security — enable + FORCE on every table, then explicit policies.
-- ============================================================================
alter table core.organizations            enable row level security;
alter table core.organizations            force  row level security;
alter table core.user_profiles            enable row level security;
alter table core.user_profiles            force  row level security;
alter table core.roles                    enable row level security;
alter table core.roles                    force  row level security;
alter table core.permissions              enable row level security;
alter table core.permissions              force  row level security;
alter table core.role_permissions         enable row level security;
alter table core.role_permissions         force  row level security;
alter table core.organization_memberships enable row level security;
alter table core.organization_memberships force  row level security;
alter table administration.audit_logs     enable row level security;
alter table administration.audit_logs     force  row level security;

-- Minimal table privileges (RLS still governs row visibility). No DELETE: records
-- are soft-deleted/archived, never hard-deleted through the Data API.
grant select, insert, update on core.organizations            to authenticated;
grant select, update          on core.user_profiles           to authenticated;
grant select                  on core.roles                   to authenticated;
grant select                  on core.permissions             to authenticated;
grant select                  on core.role_permissions        to authenticated;
grant select, insert, update  on core.organization_memberships to authenticated;
grant select, insert          on administration.audit_logs    to authenticated;

-- organizations --------------------------------------------------------------
create policy organizations_select on core.organizations
  for select to authenticated
  using ((select private.is_org_member(id)));
create policy organizations_update on core.organizations
  for update to authenticated
  using ((select private.has_permission(id, 'org.manage')) and (select private.is_mfa()))
  with check ((select private.has_permission(id, 'org.manage')) and (select private.is_mfa()));

-- user_profiles: a user sees/edits only their own profile -------------------
create policy user_profiles_select_own on core.user_profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy user_profiles_update_own on core.user_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- roles / permissions / role_permissions: readable reference data -----------
create policy roles_select on core.roles
  for select to authenticated using (true);
create policy permissions_select on core.permissions
  for select to authenticated using (true);
create policy role_permissions_select on core.role_permissions
  for select to authenticated using (true);
-- (no write policies: catalog is managed by migrations only)

-- organization_memberships ---------------------------------------------------
-- Read: own memberships always; all org memberships with members.read.
create policy memberships_select on core.organization_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_permission(organization_id, 'members.read'))
  );
-- Write: members.manage + MFA. Escalation guarded by tg_membership_guard.
create policy memberships_insert on core.organization_memberships
  for insert to authenticated
  with check ((select private.has_permission(organization_id, 'members.manage')) and (select private.is_mfa()));
create policy memberships_update on core.organization_memberships
  for update to authenticated
  using ((select private.has_permission(organization_id, 'members.manage')) and (select private.is_mfa()))
  with check ((select private.has_permission(organization_id, 'members.manage')) and (select private.is_mfa()));

-- audit_logs: append-only. Members insert their own events; audit.read sees them.
create policy audit_insert on administration.audit_logs
  for insert to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and (select private.is_org_member(organization_id))
  );
create policy audit_select on administration.audit_logs
  for select to authenticated
  using ((select private.has_permission(organization_id, 'audit.read')));
-- (no update/delete policies: audit log is immutable through the Data API)

-- ============================================================================
-- Seed: reference data + the BLKPVNTHR LLC organization
-- (No users/credentials are seeded; the owner is invited via a later bootstrap.)
-- ============================================================================

-- Fixed org id so later phases and environments reference it deterministically.
insert into core.organizations (id, legal_name, display_name, created_at, updated_at)
values ('0b1c0000-0000-0000-0000-000000000001', 'BLKPVNTHR LLC', 'BLKPVNTHR LLC', now(), now())
on conflict (id) do nothing;

insert into core.roles (key, name, description, rank) values
  ('owner',            'Owner',            'Full corporate administrative authority',                 100),
  ('administrator',    'Administrator',    'General administrative management',                         80),
  ('finance_manager',  'Finance Manager',  'Financial records, expenditures and budgets',              60),
  ('research_manager', 'Research Manager', 'Research programs and funding applications',                60),
  ('legal_reviewer',   'Legal Reviewer',   'Corporate governance, legal records and compliance',       60),
  ('auditor',          'Auditor',          'Authorized read-only access',                               20)
on conflict (key) do nothing;

insert into core.permissions (key, description) values
  ('org.manage','Manage organization settings'),
  ('members.read','View organization members'),
  ('members.manage','Invite and manage members and roles'),
  ('audit.read','View audit logs'),
  ('settings.manage','Manage administrative settings'),
  ('exports.run','Generate exports and reports'),
  ('documents.read','View documents'),('documents.write','Create/edit documents'),
  ('governance.read','View corporate governance'),('governance.write','Edit corporate governance'),
  ('finance.read','View financial records'),('finance.write','Edit financial records'),
  ('registrations.read','View federal registrations'),('registrations.write','Edit federal registrations'),
  ('ip.read','View intellectual property'),('ip.write','Edit intellectual property'),
  ('personnel.read','View research personnel'),('personnel.write','Edit research personnel'),
  ('research.read','View research programs'),('research.write','Edit research programs'),
  ('commercialization.read','View commercialization'),('commercialization.write','Edit commercialization'),
  ('funding.read','View funding opportunities/applications'),('funding.write','Edit funding opportunities/applications'),
  ('awards.read','View awards'),('awards.write','Edit awards'),
  ('readiness.read','View grant readiness'),('readiness.write','Edit grant readiness'),
  ('reports.read','View reports')
on conflict (key) do nothing;

-- owner: every permission.
insert into core.role_permissions (role_key, permission_key)
  select 'owner', key from core.permissions
on conflict do nothing;

-- administrator: everything except org-level control reserved to owner.
insert into core.role_permissions (role_key, permission_key)
  select 'administrator', key from core.permissions where key <> 'org.manage'
on conflict do nothing;

-- auditor: every read permission + audit.read + exports.run (strictly read-only).
insert into core.role_permissions (role_key, permission_key)
  select 'auditor', key from core.permissions
  where key like '%.read' or key in ('audit.read','exports.run')
on conflict do nothing;

-- finance_manager
insert into core.role_permissions (role_key, permission_key) values
  ('finance_manager','finance.read'),('finance_manager','finance.write'),
  ('finance_manager','documents.read'),('finance_manager','documents.write'),
  ('finance_manager','readiness.read'),('finance_manager','reports.read'),
  ('finance_manager','exports.run')
on conflict do nothing;

-- research_manager
insert into core.role_permissions (role_key, permission_key) values
  ('research_manager','research.read'),('research_manager','research.write'),
  ('research_manager','funding.read'),('research_manager','funding.write'),
  ('research_manager','awards.read'),('research_manager','awards.write'),
  ('research_manager','ip.read'),('research_manager','personnel.read'),
  ('research_manager','documents.read'),('research_manager','documents.write'),
  ('research_manager','readiness.read'),('research_manager','readiness.write'),
  ('research_manager','reports.read'),('research_manager','exports.run')
on conflict do nothing;

-- legal_reviewer
insert into core.role_permissions (role_key, permission_key) values
  ('legal_reviewer','governance.read'),('legal_reviewer','governance.write'),
  ('legal_reviewer','registrations.read'),('legal_reviewer','registrations.write'),
  ('legal_reviewer','ip.read'),('legal_reviewer','ip.write'),
  ('legal_reviewer','documents.read'),('legal_reviewer','documents.write'),
  ('legal_reviewer','readiness.read'),('legal_reviewer','reports.read'),
  ('legal_reviewer','exports.run')
on conflict do nothing;
