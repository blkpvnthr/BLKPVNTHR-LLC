-- Privileged bootstrap used ONLY by the bootstrap-owner Edge Function (service
-- role). Writes the profile + active membership into core.* (bypassing RLS as a
-- SECURITY DEFINER), exempt from the self-escalation guard because auth.uid() is
-- null in the service-role context. Callable by service_role only.
create or replace function public.bootstrap_owner(p_user_id uuid, p_email text, p_role text default 'owner')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := '0b1c0000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from core.roles where key = p_role) then
    raise exception 'unknown role %', p_role;
  end if;

  insert into core.user_profiles (id, email, status)
    values (p_user_id, p_email, 'active')
    on conflict (id) do update set email = excluded.email, status = 'active';

  insert into core.organization_memberships (organization_id, user_id, role_key, status, activated_at)
    values (v_org, p_user_id, p_role, 'active', now())
    on conflict (organization_id, user_id)
      do update set role_key = excluded.role_key, status = 'active', activated_at = now();
end;
$$;

revoke all on function public.bootstrap_owner(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(uuid, text, text) to service_role;
