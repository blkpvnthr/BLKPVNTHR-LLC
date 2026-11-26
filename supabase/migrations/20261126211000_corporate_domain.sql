-- Corporate Governance domain. Convention for ALL record tables:
--   standard columns: id, organization_id, status (core.record_status:
--   active|archived), created_at/by, updated_at/by, deleted_at/by, row_version;
--   domain-specific status columns are named distinctly (e.g. approval_status).
-- private.apply_record_table() stamps RLS (permission + MFA) + audit + indexes.

create table corporate.governance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  record_type text not null default 'other',          -- articles | operating_agreement | resolution | certificate | ein | bylaws | other
  description text,
  effective_date date,
  renewal_date date,
  approval_status text not null default 'draft',       -- draft | under_review | approved | requires_revision
  reference text,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table corporate.ownership_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  member_name text not null,
  member_type text not null default 'individual',      -- individual | entity
  ownership_percentage numeric(7, 4),
  voting_authority text,
  capital_contribution numeric(14, 2),
  effective_date date,
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table corporate.legal_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  agreement_type text not null default 'other',
  counterparty text,
  agreement_status text not null default 'draft',
  effective_date date,
  expiration_date date,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table corporate.federal_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  authority text not null,                              -- SAM.gov | UEI | CAGE | SBIR | State | Other
  registration_type text,
  registration_identifier text,                        -- masked in UI unless revealed
  registration_status text not null default 'not_registered', -- not_registered | pending | active | expired
  effective_date date,
  expiration_date date,
  renewal_date date,
  verification_date date,
  official_source text,
  responsible_party text,
  document_id uuid references documents.documents (id),
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table corporate.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  title text not null,
  obligation_type text,
  authority text,
  due_date date,
  frequency text,                                       -- once | annual | quarterly | monthly
  obligation_status text not null default 'open',       -- open | in_progress | satisfied | overdue
  responsible_party text,
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

select private.apply_record_table('corporate', 'governance_records', 'governance.read', 'governance.write');
select private.apply_record_table('corporate', 'ownership_records', 'governance.read', 'governance.write');
select private.apply_record_table('corporate', 'legal_records', 'governance.read', 'governance.write');
select private.apply_record_table('corporate', 'federal_registrations', 'registrations.read', 'registrations.write');
select private.apply_record_table('corporate', 'compliance_obligations', 'registrations.read', 'registrations.write');
