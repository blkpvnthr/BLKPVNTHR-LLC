-- Private document storage: a non-public bucket with deny-by-default Storage RLS.
-- Object paths are org-scoped: "<organization_id>/<folder>/<uuid>-<filename>".
-- Every operation requires an active membership with the right permission AND MFA.

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800) -- 50 MiB
on conflict (id) do nothing;

-- Safely extract the org id from the first path segment (null if malformed).
create or replace function private.object_org(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;
revoke all on function private.object_org(text) from public, anon;
grant execute on function private.object_org(text) to authenticated;

-- Deny-by-default: storage.objects has RLS enabled by Supabase with no policies.
-- Add org + permission + MFA gated policies for the documents bucket.
create policy documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_permission(private.object_org(name), 'documents.read'))
    and (select private.is_mfa())
  );

create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select private.has_permission(private.object_org(name), 'documents.write'))
    and (select private.is_mfa())
  );

create policy documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_permission(private.object_org(name), 'documents.write'))
    and (select private.is_mfa())
  )
  with check (
    bucket_id = 'documents'
    and (select private.has_permission(private.object_org(name), 'documents.write'))
    and (select private.is_mfa())
  );

create policy documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_permission(private.object_org(name), 'documents.write'))
    and (select private.is_mfa())
  );
