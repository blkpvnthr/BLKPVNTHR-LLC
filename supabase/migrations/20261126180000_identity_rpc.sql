-- public.me(): the single Data-API-exposed entry point for "who am I".
-- SECURITY INVOKER (runs as the caller) so RLS applies and it can only ever
-- return the calling user's own profile + active memberships + effective
-- permissions. This keeps the core/administration schemas unexposed to PostgREST
-- while giving the frontend/server a safe identity endpoint via supabase.rpc('me').
create or replace function public.me()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', (select auth.uid()),
    'aal', coalesce((select auth.jwt() ->> 'aal'), 'aal1'),
    'email', (select auth.jwt() ->> 'email'),
    'profile', (
      select jsonb_build_object(
        'full_name', p.full_name,
        'display_name', p.display_name,
        'status', p.status,
        'timezone', p.timezone
      )
      from core.user_profiles p
      where p.id = (select auth.uid())
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization_id', m.organization_id,
        'organization_name', o.display_name,
        'role', m.role_key,
        'status', m.status,
        'permissions', (
          select coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
          from core.role_permissions rp
          where rp.role_key = m.role_key
        )
      ))
      from core.organization_memberships m
      join core.organizations o on o.id = m.organization_id
      where m.user_id = (select auth.uid())
        and m.status = 'active'
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.me() from public, anon;
grant execute on function public.me() to authenticated;
