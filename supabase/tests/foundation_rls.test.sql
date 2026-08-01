begin;

select plan(137);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_memberships', 'memberships exists');
select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_one_active_per_user_idx',
  'memberships enforce one active organization per user'
);
select has_table('public', 'invitations', 'invitations exists');
select has_column(
  'public',
  'invitations',
  'revoked_at',
  'invitations track explicit revocation'
);
select has_index(
  'public',
  'invitations',
  'invitations_one_active_per_organization_email_idx',
  'invitations allow one normalized active usable token per organization and email'
);
select has_table('public', 'feature_flags', 'feature flags exist');
select has_table('public', 'feature_flag_audit_log', 'feature flag audit log exists');

select has_function(
  'public',
  'bootstrap_organization',
  array['text', 'text'],
  'organization bootstrap function exists'
);
select has_function(
  'public',
  'accept_invitation',
  array['text'],
  'invitation acceptance function exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.bootstrap_organization(text, text)',
    'execute'
  ),
  'authenticated users can execute trusted organization bootstrap'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.bootstrap_organization(text, text)',
    'execute'
  ),
  'anonymous users cannot execute organization bootstrap'
);
select ok(has_function_privilege('authenticated', 'public.stage_invitation(text, public.membership_role, text, timestamp with time zone)', 'execute'), 'authenticated can stage through the admin-authorized RPC');
select ok(not has_function_privilege('anon', 'public.stage_invitation(text, public.membership_role, text, timestamp with time zone)', 'execute'), 'anonymous cannot stage invitations');
select ok(has_function_privilege('authenticated', 'public.discard_staged_invitation(uuid)', 'execute'), 'authenticated admins can discard staging');
select ok(not has_function_privilege('anon', 'public.discard_staged_invitation(uuid)', 'execute'), 'anonymous cannot discard staging');
select ok(not has_function_privilege('authenticated', 'public.finalize_invitation_delivery(uuid)', 'execute'), 'authenticated clients cannot finalize delivery');
select ok(has_function_privilege('service_role', 'public.finalize_invitation_delivery(uuid)', 'execute'), 'service role alone can finalize delivery');
select ok(
  has_function_privilege(
    'authenticated',
    'public.accept_invitation(text)',
    'execute'
  ),
  'authenticated users can execute invitation acceptance'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.accept_invitation(text)',
    'execute'
  ),
  'anonymous users cannot execute invitation acceptance'
);

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

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anonymous has no profile table grant'
);
select ok(
  not has_table_privilege('anon', 'public.organizations', 'select'),
  'anonymous has no organization table grant'
);
select ok(
  not has_table_privilege('anon', 'public.organization_memberships', 'select'),
  'anonymous has no membership table grant'
);
select ok(
  not has_table_privilege('anon', 'public.invitations', 'select'),
  'anonymous has no invitation table grant'
);
select ok(
  not has_table_privilege('anon', 'public.feature_flags', 'select'),
  'anonymous has no feature flag table grant'
);
select ok(
  not has_table_privilege('anon', 'public.feature_flag_audit_log', 'select'),
  'anonymous has no feature flag audit table grant'
);
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated can select profiles subject to RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'update'),
  'authenticated has no whole-profile update grant'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'),
  'authenticated can update profile display names'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'id', 'update'),
  'authenticated cannot update profile identity'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'update'),
  'authenticated cannot forge profile timestamps'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'update'),
  'authenticated has no whole-organization update grant'
);
select ok(
  has_column_privilege('authenticated', 'public.organizations', 'name', 'update'),
  'authenticated can update organization names subject to RLS'
);
select ok(
  not has_column_privilege('authenticated', 'public.organizations', 'created_by', 'update'),
  'authenticated cannot update organization provenance'
);
select ok(
  not has_table_privilege('authenticated', 'public.organization_memberships', 'update'),
  'authenticated has no whole-membership update grant'
);
select ok(
  has_column_privilege('authenticated', 'public.organization_memberships', 'role', 'update'),
  'authenticated can update membership roles subject to RLS'
);
select ok(
  not has_column_privilege('authenticated', 'public.organization_memberships', 'user_id', 'update'),
  'authenticated cannot rewrite membership identity'
);
select ok(
  not has_table_privilege('authenticated', 'public.invitations', 'update'),
  'authenticated has no whole-invitation update grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.invitations', 'insert'),
  'authenticated has no whole-invitation insert grant'
);
select ok(
  not has_column_privilege('authenticated', 'public.invitations', 'token_hash', 'insert'),
  'authenticated must stage hashed invitation tokens through the RPC'
);
select ok(
  not has_column_privilege('authenticated', 'public.invitations', 'invited_by', 'insert'),
  'authenticated cannot forge invitation provenance on insert'
);
select ok(
  not has_column_privilege('authenticated', 'public.invitations', 'accepted_at', 'update'),
  'authenticated cannot directly mark invitations accepted'
);
select ok(
  not has_column_privilege('authenticated', 'public.invitations', 'expires_at', 'update')
  and not has_column_privilege('authenticated', 'public.invitations', 'role', 'update')
  and not has_column_privilege('authenticated', 'public.invitations', 'email', 'update')
  and not has_column_privilege('authenticated', 'public.invitations', 'token_hash', 'update')
  and not has_column_privilege('authenticated', 'public.invitations', 'invited_by', 'update'),
  'authenticated cannot directly rewrite invitation state or provenance'
);
select ok(
  not has_table_privilege('authenticated', 'public.feature_flags', 'update'),
  'authenticated has no whole-feature-flag update grant'
);
select ok(
  has_column_privilege('authenticated', 'public.feature_flags', 'enabled', 'update'),
  'authenticated can update mutable flag state subject to RLS'
);
select ok(
  not has_column_privilege('authenticated', 'public.feature_flags', 'key', 'update'),
  'authenticated cannot rewrite feature flag identity'
);
select ok(
  not has_table_privilege('authenticated', 'public.feature_flag_audit_log', 'insert'),
  'authenticated cannot insert feature flag audit records directly'
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'bootstrap@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"can_bootstrap_org":true}',
    '{"display_name":"Bootstrap Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'unverified-bootstrap@example.test',
    crypt('test-password', gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"],"can_bootstrap_org":true}',
    '{"display_name":"Unverified Bootstrap"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000007',
    'authenticated',
    'authenticated',
    'invited@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Invited Employee"}',
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
    repeat('0', 64),
    '10000000-0000-0000-0000-000000000001',
    now() + interval '7 days'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'invite-b@example.test',
    'employee',
    repeat('1', 64),
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
select lives_ok(
  $$
    do $updates_denied$
    begin
      begin
        update public.invitations
        set accepted_at = now()
        where email = 'invite-a@example.test';
        raise exception 'accepted_at update unexpectedly allowed';
      exception when insufficient_privilege then
        null;
      end;

      begin
        update public.invitations
        set expires_at = now() + interval '30 days'
        where email = 'invite-a@example.test';
        raise exception 'expires_at update unexpectedly allowed';
      exception when insufficient_privilege then
        null;
      end;

      begin
        update public.invitations
        set role = 'admin'
        where email = 'invite-a@example.test';
        raise exception 'role update unexpectedly allowed';
      exception when insufficient_privilege then
        null;
      end;
    end
    $updates_denied$
  $$,
  'admins cannot directly mutate invitation acceptance, expiry, or role'
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

select results_eq(
  $$insert into public.organization_memberships (id, organization_id, user_id, role) values ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'employee') returning organization_id::text$$,
  array['20000000-0000-0000-0000-000000000001'],
  'admins can insert memberships in their organization'
);
select throws_like(
  $$insert into public.organization_memberships (organization_id, user_id, role) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'employee')$$,
  '%row-level security%',
  'membership WITH CHECK rejects cross-organization inserts'
);
select throws_like(
  $$insert into public.invitations (organization_id, email, role, token_hash, expires_at) values ('20000000-0000-0000-0000-000000000001', 'same-org@example.test', 'employee', repeat('2', 64), now() + interval '7 days') returning invited_by::text$$,
  '%permission denied%',
  'admins cannot bypass the invitation staging RPC'
);
select throws_like(
  $$insert into public.invitations (organization_id, email, role, token_hash, expires_at) values ('20000000-0000-0000-0000-000000000002', 'cross-org@example.test', 'employee', repeat('3', 64), now() + interval '7 days')$$,
  '%permission denied%',
  'direct invitation insertion is denied before cross-organization probing'
);
select results_eq(
  $$insert into public.feature_flags (organization_id, key, environment, enabled, owner, purpose, rollout_plan, review_on, expires_on) values ('20000000-0000-0000-0000-000000000001', 'same-org-insert', 'development', false, 'admin-a', 'Exercise allowed insertion.', 'Review before enabling.', current_date + 7, current_date + 30) returning organization_id::text$$,
  array['20000000-0000-0000-0000-000000000001'],
  'admins can insert feature flags in their organization'
);
select throws_like(
  $$insert into public.feature_flags (organization_id, key, environment, enabled, owner, purpose, rollout_plan, review_on, expires_on) values ('20000000-0000-0000-0000-000000000002', 'cross-org-insert', 'development', false, 'admin-a', 'Exercise denied insertion.', 'Never enable.', current_date + 7, current_date + 30)$$,
  '%row-level security%',
  'feature flag WITH CHECK rejects cross-organization inserts'
);
select throws_like(
  $$insert into public.feature_flags (organization_id, key, environment, enabled, owner, purpose, rollout_plan, review_on, expires_on) values (null, 'global-insert', 'development', false, 'admin-a', 'Exercise denied global insertion.', 'Service role only.', current_date + 7, current_date + 30)$$,
  '%row-level security%',
  'feature flag WITH CHECK rejects client-created global flags'
);

delete from public.organization_memberships
where id = '30000000-0000-0000-0000-000000000004';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.is_active_member('20000000-0000-0000-0000-000000000001'),
  false,
  'a deactivated identity is no longer an active member'
);
select results_eq(
  $$select display_name from public.profiles order by display_name$$,
  array['Employee A Updated'],
  'deactivated identities retain only self-profile access'
);
select is_empty(
  $$select id from public.organizations$$,
  'deactivated identities cannot read organizations'
);
select is_empty(
  $$select id from public.organization_memberships$$,
  'deactivated identities cannot read memberships'
);
select is_empty(
  $$select id from public.invitations$$,
  'deactivated identities cannot read invitations'
);
select is_empty(
  $$select id from public.feature_flags$$,
  'deactivated identities cannot read raw feature flags'
);
select is_empty(
  $$select id from public.feature_flag_audit_log$$,
  'deactivated identities cannot read feature flag audit records'
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

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"can_bootstrap_org":true}}',
  true
);
select throws_like(
  $$select public.bootstrap_organization('Forged Bootstrap', 'UTC')$$,
  '%BOOTSTRAP_DENIED%',
  'a forged JWT bootstrap claim cannot replace authoritative app metadata'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
select throws_like(
  $$select public.bootstrap_organization('Unverified Bootstrap', 'UTC')$$,
  '%BOOTSTRAP_DENIED%',
  'an unverified identity cannot bootstrap despite trusted app metadata'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select results_eq(
  $$select public.bootstrap_organization('Trusted Bootstrap', 'Asia/Kolkata') is not null$$,
  array[true],
  'a verified identity with authoritative app metadata can bootstrap once'
);
select results_eq(
  $$select role::text from public.organization_memberships where user_id = auth.uid() and status = 'active'$$,
  array['admin'],
  'bootstrap atomically creates the first active admin membership'
);

reset role;

insert into public.invitations (
  organization_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at,
  delivery_status
)
values (
  '20000000-0000-0000-0000-000000000002',
  'INVITED@example.test',
  'admin',
  repeat('a', 64),
  '10000000-0000-0000-0000-000000000003',
  now() + interval '7 days',
  'active'
);
insert into public.invitations (
  organization_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at,
  delivery_status
)
values (
  '20000000-0000-0000-0000-000000000002',
  'invited@example.test',
  'employee',
  repeat('b', 64),
  '10000000-0000-0000-0000-000000000003',
  now() + interval '7 days',
  'pending_delivery'
);
insert into public.invitations (
  organization_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
values
  (
    '20000000-0000-0000-0000-000000000002',
    'expired@example.test',
    'employee',
    repeat('c', 64),
    '10000000-0000-0000-0000-000000000003',
    now() + interval '7 days'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'wrong@example.test',
    'employee',
    repeat('d', 64),
    '10000000-0000-0000-0000-000000000003',
    now() + interval '7 days'
  );

update public.invitations
set expires_at = now() - interval '1 minute'
where token_hash = repeat('c', 64);

select results_eq(
  $$select count(*)::integer from public.invitations where organization_id = '20000000-0000-0000-0000-000000000002' and lower(btrim(email)) = 'invited@example.test' and delivery_status = 'active' and accepted_at is null and revoked_at is null$$,
  array[1],
  'staging a resend leaves the prior active invitation usable'
);
select results_eq(
  $$select revoked_at is null from public.invitations where token_hash = repeat('a', 64)$$,
  array[true],
  'raw staging does not revoke the prior active invitation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
select throws_like(
  $$select * from public.accept_invitation(repeat('b', 64))$$,
  '%INVITATION_INVALID%',
  'a staged but undelivered token cannot be accepted'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select throws_like(
  $$select * from public.stage_invitation('not-an-email', 'employee', repeat('7', 64), now() + interval '7 days')$$,
  '%INVITATION_INVALID%',
  'stage rejects malformed email in the database'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select results_eq(
  $$select public.finalize_invitation_delivery((select id from public.invitations where token_hash = repeat('b', 64)))$$,
  array[true],
  'successful delivery finalization activates the staged resend'
);
select results_eq(
  $$select revoked_at is not null from public.invitations where token_hash = repeat('a', 64)$$,
  array[true],
  'finalization revokes the prior elevated-role token only after delivery'
);
select results_eq(
  $$select delivery_status::text from public.invitations where token_hash = repeat('b', 64)$$,
  array['active'],
  'finalization makes the delivered token active'
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
  $$select public.discard_staged_invitation(id) from public.stage_invitation('invited@example.test', 'admin', repeat('e', 64), now() + interval '7 days')$$,
  array[true],
  'a failed resend can be staged then discarded'
);
select results_eq(
  $$select delivery_status::text from public.invitations where token_hash = repeat('b', 64)$$,
  array['active'],
  'discarding a failed resend preserves the prior active token'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
select throws_like(
  $$select * from public.accept_invitation(repeat('a', 64))$$,
  '%INVITATION_INVALID%',
  'a replaced elevated-role token cannot be accepted'
);
select throws_like(
  $$select * from public.accept_invitation(repeat('c', 64))$$,
  '%INVITATION_INVALID%',
  'an expired invitation fails generically'
);
select throws_like(
  $$select * from public.accept_invitation(repeat('d', 64))$$,
  '%INVITATION_INVALID%',
  'an invitation for another verified email fails generically'
);
select is_empty(
  $$select id from public.organization_memberships where user_id = auth.uid()$$,
  'failed acceptance attempts roll back without activating membership'
);
select results_eq(
  $$select organization_id::text || ':' || role::text from public.accept_invitation(repeat('b', 64))$$,
  array['20000000-0000-0000-0000-000000000002:employee'],
  'the current matching invitation activates its constrained role'
);
select results_eq(
  $$select role::text from public.organization_memberships where user_id = auth.uid() and status = 'active'$$,
  array['employee'],
  'an older admin invitation cannot elevate the accepted employee membership'
);
select throws_like(
  $$select * from public.accept_invitation(repeat('b', 64))$$,
  '%INVITATION_INVALID%',
  'an accepted invitation cannot be replayed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select throws_like(
  $$select * from public.stage_invitation('invited@example.test', 'admin', repeat('f', 64), now() + interval '7 days')$$,
  '%INVITATION_INVALID%',
  'admins cannot invite an email already mapped to an active membership'
);

reset role;
insert into public.invitations (
  organization_id, email, role, token_hash, invited_by, expires_at, delivery_status
) values (
  '20000000-0000-0000-0000-000000000002', 'invited@example.test', 'admin',
  repeat('6', 64), '10000000-0000-0000-0000-000000000003',
  now() + interval '7 days', 'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select results_eq(
  $$update public.organization_memberships set status = 'deactivated' where user_id = '10000000-0000-0000-0000-000000000007' returning status::text$$,
  array['deactivated'],
  'membership deactivation succeeds through the admin policy'
);
select results_eq(
  $$select revoked_at is not null from public.invitations where token_hash = repeat('6', 64)$$,
  array[true],
  'membership deactivation atomically revokes outstanding matching invitations'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
select throws_like(
  $$select * from public.accept_invitation(repeat('6', 64))$$,
  '%INVITATION_INVALID%',
  'a deactivation-revoked token cannot reactivate membership'
);

reset role;
select results_eq(
  $$select count(*)::integer from public.invitations where token_hash = repeat('b', 64) and accepted_at is not null$$,
  array[1],
  'acceptance marks the invitation exactly once'
);

insert into public.feature_flag_audit_log (
  id,
  feature_flag_id,
  organization_id,
  flag_key,
  changed_by,
  action,
  new_record
)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  null,
  'account-deletion-attribution',
  '10000000-0000-0000-0000-000000000004',
  'insert',
  '{"enabled":true}'
);

select lives_ok(
  $$delete from auth.users where id = '10000000-0000-0000-0000-000000000004'$$,
  'deleting an auth identity can cascade its profile without mutating audit history'
);
select results_eq(
  $$select changed_by::text from public.feature_flag_audit_log where id = '60000000-0000-0000-0000-000000000001'$$,
  array['10000000-0000-0000-0000-000000000004'],
  'audit attribution survives account and profile deletion'
);

select * from finish();
rollback;
