begin;

select plan(54);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_memberships', 'memberships exists');
select has_table('public', 'invitations', 'invitations exists');
select has_table('public', 'feature_flags', 'feature flags exist');
select has_table('public', 'feature_flag_audit_log', 'feature flag audit log exists');

select policies_are(
  'public',
  'organizations',
  array['members_view_organization', 'admins_update_organization'],
  'organizations have exactly the member-view and admin-update policies'
);

select policies_are(
  'public',
  'organization_memberships',
  array['members_view_memberships', 'admins_manage_memberships'],
  'memberships have exactly the member-view and admin-manage policies'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin-a@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'employee-a@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Employee A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'admin-b@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin B"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Outsider"}',
    now(),
    now()
  );

insert into public.organizations (id, name, timezone, created_by)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Organization A',
    'Asia/Kolkata',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Organization B',
    'UTC',
    '10000000-0000-0000-0000-000000000003'
  );

insert into public.organization_memberships (
  id,
  organization_id,
  user_id,
  role,
  status
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'admin',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'employee',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'admin',
    'active'
  );

insert into public.invitations (
  id,
  organization_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'invite-a@example.test',
    'employee',
    'hash-a',
    '10000000-0000-0000-0000-000000000001',
    now() + interval '7 days'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'invite-b@example.test',
    'employee',
    'hash-b',
    '10000000-0000-0000-0000-000000000003',
    now() + interval '7 days'
  );

insert into public.feature_flags (
  id,
  organization_id,
  key,
  environment,
  role_scope,
  enabled,
  rollout_percentage,
  owner,
  purpose,
  rollout_plan,
  review_on,
  expires_on
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    null,
    'global-flag',
    'production',
    null,
    true,
    100,
    'platform',
    'Exercise a global rollout.',
    'Enable for all organizations.',
    current_date + 7,
    current_date + 30
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'organization-a-flag',
    'production',
    'employee',
    true,
    50,
    'admin-a',
    'Exercise an organization rollout.',
    'Increase after review.',
    current_date + 7,
    current_date + 30
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    'organization-b-flag',
    'staging',
    'admin',
    false,
    0,
    'admin-b',
    'Exercise a second organization rollout.',
    'Keep disabled until review.',
    current_date + 7,
    current_date + 30
  );

select throws_like(
  $$update public.feature_flag_audit_log set flag_key = 'rewritten-audit-key'$$,
  '%append-only%',
  'feature flag audit records are append-only even for privileged callers'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select ok(
  public.is_active_member('20000000-0000-0000-0000-000000000001'),
  'an active employee is an active member'
);
select is(
  public.is_active_member('20000000-0000-0000-0000-000000000002'),
  false,
  'an employee is not active in another organization'
);
select is(
  public.is_admin('20000000-0000-0000-0000-000000000001'),
  false,
  'an employee is not an admin'
);
select is(
  public.is_active_admin(),
  false,
  'an employee is not an active admin in any organization'
);

select results_eq(
  $$select display_name from public.profiles order by display_name$$,
  array['Admin A', 'Employee A'],
  'employees see only themselves and active coworkers'
);
select results_eq(
  $$select name from public.organizations order by name$$,
  array['Organization A'],
  'employees read only their organization'
);
select results_eq(
  $$select count(*)::integer from public.organization_memberships$$,
  array[2],
  'employees read memberships only in their organization'
);
select is_empty(
  $$select id from public.invitations$$,
  'employees cannot read invitation metadata'
);
select is_empty(
  $$select id from public.feature_flags$$,
  'employees cannot read raw global or scoped feature flags'
);
select is_empty(
  $$update public.organizations set name = 'Employee edit' where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  'employees cannot update their organization'
);
select is_empty(
  $$update public.organization_memberships set role = 'admin' where user_id = auth.uid() returning id$$,
  'employees cannot escalate their own role'
);
select is_empty(
  $$update public.organization_memberships set status = 'deactivated' where user_id = auth.uid() returning id$$,
  'employees cannot deactivate themselves'
);
select results_eq(
  $$update public.profiles set display_name = 'Employee A Updated' where id = auth.uid() returning updated_at > created_at$$,
  array[true],
  'profiles allow self updates and advance updated_at automatically'
);
select is_empty(
  $$select id from public.feature_flag_audit_log$$,
  'employees cannot read feature flag audit records'
);

reset role;
set local role anon;

select throws_like(
  $$select id from public.profiles$$,
  '%permission denied%',
  'anonymous users cannot read profiles'
);
select throws_like(
  $$select id from public.organizations$$,
  '%permission denied%',
  'anonymous users cannot read organizations'
);
select throws_like(
  $$select id from public.organization_memberships$$,
  '%permission denied%',
  'anonymous users cannot read memberships'
);
select throws_like(
  $$select id from public.invitations$$,
  '%permission denied%',
  'anonymous users cannot read invitations'
);
select throws_like(
  $$select id from public.feature_flags$$,
  '%permission denied%',
  'anonymous users cannot read feature flags'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select ok(
  public.is_admin('20000000-0000-0000-0000-000000000001'),
  'an active admin is recognized as an admin'
);
select ok(
  public.is_active_admin(),
  'an active organization admin is recognized globally as an admin'
);
select results_eq(
  $$update public.organizations set name = 'Organization A Updated' where id = '20000000-0000-0000-0000-000000000001' returning name = 'Organization A Updated' and updated_at > created_at$$,
  array[true],
  'admins can update allowed organization columns and updated_at advances'
);
select throws_like(
  $$update public.organizations set timezone = 'Not/A_Timezone' where id = '20000000-0000-0000-0000-000000000001'$$,
  '%invalid organization timezone%',
  'organization timezone must exist in pg_timezone_names'
);
select throws_like(
  $$update public.organizations set created_by = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$$,
  '%permission denied%',
  'admins cannot rewrite organization provenance'
);
select results_eq(
  $$update public.organization_memberships set status = 'deactivated' where user_id = '10000000-0000-0000-0000-000000000002' returning status::text$$,
  array['deactivated'],
  'admins can deactivate employees in their organization'
);
select throws_like(
  $$update public.organization_memberships set user_id = '10000000-0000-0000-0000-000000000004' where id = '30000000-0000-0000-0000-000000000002'$$,
  '%permission denied%',
  'admins cannot rewrite membership identity columns'
);
select results_eq(
  $$select email from public.invitations order by email$$,
  array['invite-a@example.test'],
  'admins see invitations only in their organization'
);
select results_eq(
  $$update public.invitations set accepted_at = now() where email = 'invite-a@example.test' returning accepted_at is not null$$,
  array[true],
  'admins can update mutable invitation state in their organization'
);
select results_eq(
  $$select key from public.feature_flags order by key$$,
  array['global-flag', 'organization-a-flag'],
  'active admins see global and own-organization raw flags'
);
select results_eq(
  $$update public.feature_flags set rollout_percentage = 75 where key = 'organization-a-flag' returning rollout_percentage = 75 and updated_at > created_at$$,
  array[true],
  'admins can update mutable flag fields and updated_at advances'
);
select throws_like(
  $$update public.feature_flags set key = 'rewritten-key' where key = 'organization-a-flag'$$,
  '%permission denied%',
  'admins cannot rewrite feature flag identity columns'
);
select is_empty(
  $$update public.feature_flags set enabled = true where key = 'organization-b-flag' returning id$$,
  'admins cannot update another organization flag'
);
select results_eq(
  $$select distinct flag_key from public.feature_flag_audit_log order by flag_key$$,
  array['global-flag', 'organization-a-flag'],
  'admins see global and own-organization feature flag audit records'
);
select throws_like(
  $$insert into public.feature_flag_audit_log (action, flag_key) values ('insert', 'forged')$$,
  '%permission denied%',
  'clients cannot forge feature flag audit records'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select results_eq(
  $$select name from public.organizations order by name$$,
  array['Organization B'],
  'cross-organization admins cannot read other organizations'
);
select results_eq(
  $$select display_name from public.profiles order by display_name$$,
  array['Admin B'],
  'cross-organization admins cannot read other profiles'
);
select results_eq(
  $$select email from public.invitations order by email$$,
  array['invite-b@example.test'],
  'cross-organization admins cannot read other invitations'
);
select results_eq(
  $$select key from public.feature_flags order by key$$,
  array['global-flag', 'organization-b-flag'],
  'cross-organization admins see only global and own scoped flags'
);
select throws_like(
  $$update public.organization_memberships set status = 'deactivated' where user_id = auth.uid()$$,
  '%retain at least one active admin%',
  'the last active admin cannot deactivate themselves'
);
select throws_like(
  $$delete from public.organization_memberships where user_id = auth.uid()$$,
  '%retain at least one active admin%',
  'the last active admin cannot delete their membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select results_eq(
  $$select display_name from public.profiles order by display_name$$,
  array['Outsider'],
  'unaffiliated identities can read only their own profile'
);
select is_empty(
  $$select id from public.organizations$$,
  'unaffiliated identities cannot read organizations'
);
select is_empty(
  $$select id from public.organization_memberships$$,
  'unaffiliated identities cannot read memberships'
);
select is_empty(
  $$select id from public.invitations$$,
  'unaffiliated identities cannot read invitations'
);
select is_empty(
  $$select id from public.feature_flags$$,
  'unaffiliated identities cannot read global feature flag metadata'
);

select * from finish();
rollback;
