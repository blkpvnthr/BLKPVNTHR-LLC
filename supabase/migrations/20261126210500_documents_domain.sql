-- Document Vault domain: folders, documents (metadata over the private Storage
-- bucket), immutable version history, and polymorphic links to any record.

create table documents.folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  parent_id uuid references documents.folders (id),
  name text not null,
  path text not null default '/',
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table documents.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  folder_id uuid references documents.folders (id),
  title text not null,
  original_filename text,
  file_type text,
  mime_type text,
  file_size bigint,
  sha256 text,
  storage_object_path text,                       -- path within the private 'documents' bucket
  category text,
  confidentiality text not null default 'internal',   -- public | internal | confidential | restricted
  version integer not null default 1,
  approval_status text not null default 'missing',     -- missing | draft | under_review | approved | requires_revision | expired | not_applicable
  verification_status text not null default 'unverified',
  effective_date date,
  expiration_date date,
  tags text[] not null default '{}',
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table documents.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  document_id uuid not null references documents.documents (id) on delete cascade,
  version integer not null,
  storage_object_path text,
  sha256 text,
  file_size bigint,
  notes text,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create table documents.document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references core.organizations (id) default '0b1c0000-0000-0000-0000-000000000001',
  document_id uuid not null references documents.documents (id) on delete cascade,
  entity_schema text not null,
  entity_table text not null,
  record_id text not null,
  status core.record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users (id),
  deleted_at timestamptz, deleted_by uuid references auth.users (id),
  row_version integer not null default 1
);

create index documents_folder_idx on documents.documents (folder_id);
create index document_versions_doc_idx on documents.document_versions (document_id);
create index document_links_doc_idx on documents.document_links (document_id);
create index document_links_entity_idx on documents.document_links (entity_schema, entity_table, record_id);

select private.apply_record_table('documents', 'folders', 'documents.read', 'documents.write');
select private.apply_record_table('documents', 'documents', 'documents.read', 'documents.write');
select private.apply_record_table('documents', 'document_versions', 'documents.read', 'documents.write');
select private.apply_record_table('documents', 'document_links', 'documents.read', 'documents.write');
