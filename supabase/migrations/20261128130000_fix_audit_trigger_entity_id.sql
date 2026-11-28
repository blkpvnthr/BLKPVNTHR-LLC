-- Fix: administration.tg_write_audit() inserted into a non-existent column
-- `record_id`; the audit_logs column is `entity_id`. This broke every record
-- INSERT/UPDATE/soft-delete (corporate + all business domains). Correct the name.
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
    (organization_id, actor_user_id, event_type, entity_schema, entity_table, entity_id, before, after, outcome)
  values
    (v_org, (select auth.uid()), v_event, tg_table_schema, tg_table_name, v_record,
     case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
     case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
     'success');

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
