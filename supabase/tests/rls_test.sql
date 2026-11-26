-- RLS verification: simulates each role via SET ROLE + request.jwt.claims and
-- asserts deny-by-default isolation, member access, self-escalation prevention,
-- MFA(aal2)-gated writes, and anon lockdown. Raises on any failure.
do $$
declare
  v_qa       uuid := 'de640dc4-013f-4d44-a2be-0548cc4c2b25'; -- qa-admin (administrator)
  v_owner    uuid := '7b3d9591-01c1-497f-9d62-c12d2da5879d'; -- owner
  v_stranger uuid := '11111111-1111-4111-8111-111111111111'; -- non-member
  v_org      uuid := '0b1c0000-0000-0000-0000-000000000001';
  n int;
begin
  -- 1) Non-member (authenticated, aal2): deny-by-default, sees nothing org-scoped.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from core.organization_memberships; assert n = 0, 'non-member memberships='||n;
  select count(*) into n from core.organizations;            assert n = 0, 'non-member orgs='||n;
  select count(*) into n from administration.audit_logs;     assert n = 0, 'non-member audit='||n;

  -- 2) Member (administrator, aal2): sees own membership + org + role catalog.
  perform set_config('request.jwt.claims', json_build_object('sub', v_qa, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from core.organization_memberships where user_id = v_qa; assert n = 1, 'admin own membership='||n;
  select count(*) into n from core.organizations;  assert n = 1, 'admin orgs='||n;
  select count(*) into n from core.roles;          assert n = 6, 'roles catalog='||n;

  -- 3) Self-escalation blocked: admin cannot change own role to owner.
  begin
    update core.organization_memberships set role_key = 'owner' where user_id = v_qa;
    raise exception 'SECURITY: self-escalation was NOT blocked';
  exception when others then
    if sqlerrm like 'SECURITY:%' then raise; end if; -- expected: trigger/RLS blocked it
  end;

  -- 4) MFA required for member writes: owner at aal1 cannot insert a membership.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    insert into core.organization_memberships (organization_id, user_id, role_key, status)
      values (v_org, v_stranger, 'auditor', 'invited');
    raise exception 'SECURITY: aal1 membership insert was NOT blocked';
  exception when others then
    if sqlerrm like 'SECURITY:%' then raise; end if; -- expected: RLS WITH CHECK (is_mfa) blocked it
  end;

  -- 5) Anonymous: no access at all.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  begin
    select count(*) into n from core.roles;
    assert n = 0, 'anon roles='||n;
  exception when insufficient_privilege then
    null; -- permission denied is also a correct lockdown
  end;

  reset role;
  raise notice 'ALL RLS ASSERTIONS PASSED';
end $$;
