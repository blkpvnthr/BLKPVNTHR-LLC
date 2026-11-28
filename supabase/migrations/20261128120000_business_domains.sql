-- =============================================================================
-- Business record domains: finance, intellectual property, research personnel,
-- research programs (+ scoped initiatives), commercialization, and funding
-- (opportunities → applications → awards). Every table follows the standard
-- record convention and is secured/audited/indexed via private.apply_record_table.
--   standard columns: id, organization_id, status (core.record_status),
--   created_at/by, updated_at/by, deleted_at/by, row_version;
--   domain status columns are named distinctly (e.g. finance_status).
-- No new schemas are introduced; all target schemas are already API-exposed.
-- =============================================================================

-- Financial records -----------------------------------------------------------
create table finance.financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  record_type text not null default 'other',           -- invoice | expense | revenue | account | budget | tax | statement | other
  category text,
  amount numeric(16, 2),
  currency text not null default 'USD',
  counterparty text,
  transaction_date date,
  period text,                                          -- e.g. FY2026-Q1
  finance_status text not null default 'recorded',      -- recorded | pending | reconciled | disputed
  reference text,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Intellectual property -------------------------------------------------------
create table corporate.ip_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  ip_type text not null default 'other',                -- patent | provisional | trademark | copyright | trade_secret | other
  jurisdiction text,
  application_number text,
  registration_number text,
  ip_status text not null default 'conception',         -- conception | disclosed | filed | pending | granted | abandoned | expired
  filing_date date,
  grant_date date,
  expiration_date date,
  inventors text,
  owner_of_record text,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Research personnel ----------------------------------------------------------
create table research.personnel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  full_name text not null,
  role_title text,
  affiliation text,
  personnel_type text not null default 'staff',         -- staff | pi | co_pi | advisor | contractor | student
  email text,
  orcid text,
  clearance text,
  engagement_status text not null default 'active',     -- active | inactive | prospective
  start_date date,
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Research programs (shared table; initiatives are scoped by program_code) -----
-- Adding a new proprietary initiative requires NO schema/code change: insert
-- rows with a new program_code and add one config entry in admin-modules.mjs.
create table research.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  name text not null,
  program_code text not null default 'GENERAL',         -- STRIX | C_ENGINE | AFIIS | ATLAS | <future> | GENERAL
  summary text,
  category text,
  trl integer check (trl is null or trl between 1 and 9),  -- Technology Readiness Level
  lead text,
  program_status text not null default 'concept',       -- concept | active | paused | completed | archived
  start_date date,
  target_date date,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Commercialization -----------------------------------------------------------
create table commercialization.commercialization_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  initiative_type text not null default 'other',        -- license | spinout | partnership | product | market_study | other
  market text,
  partner text,
  commercialization_status text not null default 'exploring', -- exploring | in_negotiation | active | on_hold | closed
  estimated_value numeric(16, 2),
  target_date date,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Funding opportunities -------------------------------------------------------
create table funding.funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  agency text,                                          -- NSF | DOD | NIH | DOE | ...
  program text,                                         -- e.g. SBIR Phase I
  solicitation_number text,
  opportunity_status text not null default 'identified',-- identified | watching | preparing | submitted | closed
  award_ceiling numeric(16, 2),
  open_date date,
  close_date date,
  url text,
  fit_score integer check (fit_score is null or fit_score between 1 and 5),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Funding applications --------------------------------------------------------
create table funding.funding_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  agency text,
  program text,
  solicitation_number text,
  application_status text not null default 'draft',      -- draft | in_review | submitted | awarded | rejected | withdrawn
  requested_amount numeric(16, 2),
  submission_date date,
  decision_date date,
  pi_name text,
  opportunity_id uuid references funding.funding_opportunities (id),
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Awards & reporting ----------------------------------------------------------
create table funding.awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  agency text,
  award_number text,
  award_type text not null default 'grant',             -- grant | contract | cooperative_agreement
  award_status text not null default 'active',          -- active | completed | terminated | closeout
  award_amount numeric(16, 2),
  start_date date,
  end_date date,
  next_report_due date,
  pi_name text,
  application_id uuid references funding.funding_applications (id),
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

-- Stamp RLS (permission + MFA) + audit + concurrency + indexes on each table.
select private.apply_record_table('finance', 'financial_records', 'finance.read', 'finance.write');
select private.apply_record_table('corporate', 'ip_assets', 'ip.read', 'ip.write');
select private.apply_record_table('research', 'personnel', 'personnel.read', 'personnel.write');
select private.apply_record_table('research', 'programs', 'research.read', 'research.write');
select private.apply_record_table('commercialization', 'commercialization_records', 'commercialization.read', 'commercialization.write');
select private.apply_record_table('funding', 'funding_opportunities', 'funding.read', 'funding.write');
select private.apply_record_table('funding', 'funding_applications', 'funding.read', 'funding.write');
select private.apply_record_table('funding', 'awards', 'awards.read', 'awards.write');

-- Scope-filter index for research initiatives (program_code is the scope key).
create index programs_program_code_idx on research.programs (program_code) where deleted_at is null;
