-- =============================================================================
-- P2 framework — data-layer primitives shared by every administrative module.
--   * business-domain schemas
--   * administration.tg_write_audit(): generic append-only audit trigger
--   * private.apply_record_table(): stamps standard RLS (permission + MFA),
--     audit-column + audit-log triggers, grants, and indexes onto a table.
-- Every module's records table calls apply_record_table() so authorization,
-- auditing, optimistic concurrency and soft-delete are uniform and centralized.
-- =============================================================================

create schema if not exists corporate;
create schema if not exists finance;
create schema if not exists research;
create schema if not exists commercialization;
create schema if not exists funding;
create schema if not exists documents;
grant usage on schema corporate, finance, research, commercialization, funding, documents to authenticated;

-- Generic append-only audit trigger. SECURITY DEFINER so it always records,
-- regardless of the writer's RLS context. Classifies archive/restore vs update.
create or replace function administration.tg_write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_record text;
  v_event text;
begin
  if (tg_op = 'DELETE') then
    v_org := old.organization_id; v_record := old.id::text;
  else
    v_org := new.organization_id; v_record := new.id::text;
  end if;

  if (tg_op = 'INSERT') then
    v_event := 'create';
  elsif (tg_op = 'DELETE') then
    v_event := 'delete';
  else
    if (old.deleted_at is null and new.deleted_at is not null) then v_event := 'archive';
    elsif (old.deleted_at is not null and new.deleted_at is null) then v_event := 'restore';
    else v_event := 'update';
    end if;
  end if;

  insert into administration.audit_logs
    (organization_id, actor_user_id, event_type, entity_schema, entity_table, record_id, before, after, outcome)
  values
    (v_org, (select auth.uid()), v_event, tg_table_schema, tg_table_name, v_record,
     case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
     case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
     'success');

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Stamp the standard security + audit + concurrency + indexes onto a records
-- table. The table must already have the standard columns: id, organization_id,
-- status, created_at/by, updated_at/by, deleted_at/by, row_version.
create or replace function private.apply_record_table(
  p_schema text, p_table text, p_read text, p_write text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f text := format('%I.%I', p_schema, p_table);
begin
  execute format('alter table %s enable row level security', f);
  execute format('alter table %s force row level security', f);
  execute format('grant select, insert, update on %s to authenticated', f);

  execute format(
    'create policy %I on %s for select to authenticated using ((select private.has_permission(organization_id, %L)) and (select private.is_mfa()))',
    p_table || '_sel', f, p_read);
  execute format(
    'create policy %I on %s for insert to authenticated with check ((select private.has_permission(organization_id, %L)) and (select private.is_mfa()))',
    p_table || '_ins', f, p_write);
  execute format(
    'create policy %I on %s for update to authenticated using ((select private.has_permission(organization_id, %L)) and (select private.is_mfa())) with check ((select private.has_permission(organization_id, %L)) and (select private.is_mfa()))',
    p_table || '_upd', f, p_write, p_write);
  -- No DELETE policy: records are soft-deleted (deleted_at); hard deletes are a
  -- separate owner-authorized retention workflow using the service role.

  execute format('create trigger %I before insert or update on %s for each row execute function core.tg_audit_columns()', p_table || '_auditcols', f);
  execute format('create trigger %I after insert or update or delete on %s for each row execute function administration.tg_write_audit()', p_table || '_audit', f);

  execute format('create index %I on %s (organization_id)', p_table || '_org_idx', f);
  execute format('create index %I on %s (status) where deleted_at is null', p_table || '_status_idx', f);
end;
$$;

revoke all on function private.apply_record_table(text, text, text, text) from public, anon, authenticated;
