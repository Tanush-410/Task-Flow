begin;

select plan(97);

select has_type(
  'public',
  'azure_devops_connection_status',
  'Azure DevOps connection status enum exists'
);
select is(
  (select string_agg(enumlabel::text, ',' order by enumsortorder)
   from pg_catalog.pg_enum
   where enumtypid = 'public.azure_devops_connection_status'::regtype),
  'pending,configured,paused,disconnected',
  'connection statuses are exact and ordered'
);

select has_table('public', 'azure_devops_connections', 'connections table exists');
select has_table('public', 'azure_devops_oauth_states', 'OAuth states table exists');
select has_table('public', 'azure_devops_team_links', 'team links table exists');

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.azure_devops_connections'::regclass)
  and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.azure_devops_oauth_states'::regclass)
  and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.azure_devops_team_links'::regclass),
  'RLS is enabled on every Azure DevOps table'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename in (
       'azure_devops_connections',
       'azure_devops_oauth_states',
       'azure_devops_team_links'
     )),
  0,
  'private Azure DevOps tables expose no browser policies'
);
select ok(
  not has_table_privilege('anon', 'public.azure_devops_connections', 'select')
  and not has_table_privilege('anon', 'public.azure_devops_oauth_states', 'select')
  and not has_table_privilege('anon', 'public.azure_devops_team_links', 'select')
  and not has_table_privilege('authenticated', 'public.azure_devops_connections', 'select')
  and not has_table_privilege('authenticated', 'public.azure_devops_oauth_states', 'select')
  and not has_table_privilege('authenticated', 'public.azure_devops_team_links', 'select'),
  'browser roles cannot read Azure DevOps tables'
);
select ok(
  not has_table_privilege('anon', 'public.azure_devops_connections', 'insert')
  and not has_table_privilege('anon', 'public.azure_devops_oauth_states', 'insert')
  and not has_table_privilege('anon', 'public.azure_devops_team_links', 'insert')
  and not has_table_privilege('authenticated', 'public.azure_devops_connections', 'insert')
  and not has_table_privilege('authenticated', 'public.azure_devops_oauth_states', 'insert')
  and not has_table_privilege('authenticated', 'public.azure_devops_team_links', 'insert'),
  'browser roles cannot create Azure DevOps records'
);
select ok(
  not has_table_privilege('anon', 'public.azure_devops_connections', 'update')
  and not has_table_privilege('anon', 'public.azure_devops_oauth_states', 'update')
  and not has_table_privilege('anon', 'public.azure_devops_team_links', 'update')
  and not has_table_privilege('authenticated', 'public.azure_devops_connections', 'update')
  and not has_table_privilege('authenticated', 'public.azure_devops_oauth_states', 'update')
  and not has_table_privilege('authenticated', 'public.azure_devops_team_links', 'update'),
  'browser roles cannot update Azure DevOps records'
);
select ok(
  not has_table_privilege('anon', 'public.azure_devops_connections', 'delete')
  and not has_table_privilege('anon', 'public.azure_devops_oauth_states', 'delete')
  and not has_table_privilege('anon', 'public.azure_devops_team_links', 'delete')
  and not has_table_privilege('authenticated', 'public.azure_devops_connections', 'delete')
  and not has_table_privilege('authenticated', 'public.azure_devops_oauth_states', 'delete')
  and not has_table_privilege('authenticated', 'public.azure_devops_team_links', 'delete'),
  'browser roles cannot delete Azure DevOps records'
);
select ok(
  has_table_privilege('service_role', 'public.azure_devops_connections', 'select,insert,update'),
  'service role can read and maintain connection state'
);
select ok(
  not has_table_privilege('service_role', 'public.azure_devops_connections', 'delete'),
  'service role cannot hard-delete connections'
);
select ok(
  has_table_privilege('service_role', 'public.azure_devops_oauth_states', 'select,insert,delete'),
  'service role can create, inspect, and clean up OAuth states'
);
select ok(
  not has_table_privilege('service_role', 'public.azure_devops_oauth_states', 'update'),
  'service role cannot directly update OAuth states'
);
select ok(
  has_table_privilege('service_role', 'public.azure_devops_team_links', 'select'),
  'service role can read configured team links'
);
select ok(
  not has_table_privilege('service_role', 'public.azure_devops_team_links', 'insert')
  and not has_table_privilege('service_role', 'public.azure_devops_team_links', 'update')
  and not has_table_privilege('service_role', 'public.azure_devops_team_links', 'delete'),
  'service role cannot directly write or hard-delete team links'
);

select col_is_pk('public', 'azure_devops_connections', 'id', 'connection id is the primary key');
select col_is_unique(
  'public',
  'azure_devops_connections',
  'organization_id',
  'an organization has at most one connection'
);
select col_not_null('public', 'azure_devops_connections', 'tenant_id', 'tenant id is required');
select col_not_null(
  'public',
  'azure_devops_connections',
  'authorized_user_id',
  'authorized Azure user is required'
);
select col_not_null(
  'public',
  'azure_devops_connections',
  'granted_scopes',
  'granted scopes are always an array'
);
select col_not_null('public', 'azure_devops_connections', 'created_by', 'connection creator is required');
select col_type_is(
  'public',
  'azure_devops_connections',
  'status',
  'azure_devops_connection_status',
  'connections use the status enum'
);

select col_is_pk('public', 'azure_devops_oauth_states', 'state_hash', 'OAuth state hash is the primary key');
select col_not_null(
  'public',
  'azure_devops_oauth_states',
  'pkce_verifier_ciphertext',
  'encrypted PKCE verifier is required'
);
select col_not_null('public', 'azure_devops_oauth_states', 'expires_at', 'OAuth state expiry is required');

select col_is_pk('public', 'azure_devops_team_links', 'id', 'team link id is the primary key');
select col_is_unique(
  'public',
  'azure_devops_team_links',
  'planning_team_id',
  'a planning team has at most one Azure mapping'
);
select col_type_is(
  'public',
  'azure_devops_team_links',
  'status',
  'azure_devops_connection_status',
  'team links use the status enum'
);
select has_index(
  'public',
  'azure_devops_oauth_states',
  'azure_devops_oauth_states_expiry_idx',
  'OAuth state expiry cleanup is indexed'
);
select has_index(
  'public',
  'azure_devops_team_links',
  'azure_devops_team_links_org_connection_idx',
  'organization connection mappings are indexed'
);
select has_index(
  'public',
  'azure_devops_team_links',
  'azure_devops_team_links_azure_team_unique_idx',
  'Azure team mappings are unique per connection'
);

select has_function(
  'public',
  'protect_azure_devops_connection_lifecycle',
  array[]::text[],
  'connection lifecycle protection trigger exists'
);
select has_function(
  'public',
  'protect_azure_devops_oauth_state_lifecycle',
  array[]::text[],
  'OAuth state lifecycle protection trigger exists'
);
select has_function(
  'public',
  'consume_azure_devops_oauth_state',
  array['text', 'uuid', 'uuid'],
  'OAuth state consumption function exists'
);
select has_function(
  'public',
  'configure_azure_devops_team_link',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'uuid'],
  'team link configuration function exists'
);
select has_function(
  'public',
  'disconnect_azure_devops_connection',
  array['uuid', 'uuid'],
  'disconnect function exists'
);
select ok(
  (select count(*) = 7
     and bool_and(procedure.prosecdef and coalesce(procedure.proconfig, '{}') @> array['search_path=""'])
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace
     on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'public'
     and procedure.proname in (
       'protect_azure_devops_connection_lifecycle',
       'protect_azure_devops_oauth_state_lifecycle',
       'validate_azure_devops_team_link_organization',
       'prevent_azure_devops_team_link_provenance_change',
       'consume_azure_devops_oauth_state',
       'configure_azure_devops_team_link',
       'disconnect_azure_devops_connection'
     )),
  'all Azure DevOps functions are security definer with an empty search path'
);
select ok(
  coalesce(has_function_privilege('service_role', to_regprocedure('public.protect_azure_devops_connection_lifecycle()'), 'execute'), false)
  and coalesce(has_function_privilege('service_role', to_regprocedure('public.protect_azure_devops_oauth_state_lifecycle()'), 'execute'), false)
  and has_function_privilege('service_role', 'public.validate_azure_devops_team_link_organization()', 'execute')
  and has_function_privilege('service_role', 'public.prevent_azure_devops_team_link_provenance_change()', 'execute')
  and has_function_privilege('service_role', 'public.consume_azure_devops_oauth_state(text,uuid,uuid)', 'execute')
  and has_function_privilege('service_role', 'public.configure_azure_devops_team_link(uuid,uuid,uuid,text,text,text,text,uuid)', 'execute')
  and has_function_privilege('service_role', 'public.disconnect_azure_devops_connection(uuid,uuid)', 'execute'),
  'service role can execute Azure DevOps RPCs'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.protect_azure_devops_connection_lifecycle()'), 'execute'), true)
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('public.protect_azure_devops_connection_lifecycle()'), 'execute'), true)
  and not coalesce(has_function_privilege('anon', to_regprocedure('public.protect_azure_devops_oauth_state_lifecycle()'), 'execute'), true)
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('public.protect_azure_devops_oauth_state_lifecycle()'), 'execute'), true)
  and not has_function_privilege('anon', 'public.validate_azure_devops_team_link_organization()', 'execute')
  and not has_function_privilege('authenticated', 'public.validate_azure_devops_team_link_organization()', 'execute')
  and not has_function_privilege('anon', 'public.prevent_azure_devops_team_link_provenance_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.prevent_azure_devops_team_link_provenance_change()', 'execute')
  and not has_function_privilege('anon', 'public.consume_azure_devops_oauth_state(text,uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.consume_azure_devops_oauth_state(text,uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.configure_azure_devops_team_link(uuid,uuid,uuid,text,text,text,text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.configure_azure_devops_team_link(uuid,uuid,uuid,text,text,text,text,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.disconnect_azure_devops_connection(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.disconnect_azure_devops_connection(uuid,uuid)', 'execute'),
  'browser roles cannot execute Azure DevOps RPCs'
);

select is(
  (select count(*)::integer from public.feature_flags where key = 'azure_devops_integration'),
  3,
  'exactly three Azure DevOps rollout rows exist'
);
select results_eq(
  $$select environment::text || ':' || enabled::text || ':' || rollout_percentage::text
    from public.feature_flags
    where key = 'azure_devops_integration'
    order by environment::text$$,
  array[
    'development:true:100',
    'production:false:0',
    'staging:false:0'
  ],
  'Azure DevOps rollout defaults are environment-safe'
);

insert into public.organizations (id, name, timezone, created_by)
values
  (
    '10000000-0000-0000-0000-000000000098',
    'Azure DevOps immutable-org fixture',
    'UTC',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000099',
    'Azure DevOps cross-org fixture',
    'UTC',
    '00000000-0000-0000-0000-000000000001'
  );

insert into public.planning_teams (id, organization_id, name, created_by)
values
  (
    '40000000-0000-0000-0000-000000000091',
    '10000000-0000-0000-0000-000000000001',
    'Azure DevOps mapped team',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000092',
    '10000000-0000-0000-0000-000000000001',
    'Azure DevOps second team',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000099',
    '10000000-0000-0000-0000-000000000099',
    'Azure DevOps cross-org team',
    '00000000-0000-0000-0000-000000000001'
  );

select throws_ok(
  $$insert into public.azure_devops_connections (
      organization_id, tenant_id, authorized_user_id, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001', '', 'azure-user',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'blank tenant ids are rejected'
);
select throws_ok(
  $$insert into public.azure_devops_connections (
      organization_id, tenant_id, authorized_user_id,
      access_token_ciphertext, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001', 'tenant', 'azure-user',
      'access-only', '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'token ciphertexts must be present or absent together'
);
select throws_ok(
  $$insert into public.azure_devops_connections (
      organization_id, tenant_id, authorized_user_id,
      access_token_ciphertext, refresh_token_ciphertext, status, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001', 'tenant', 'azure-user',
      'access', 'refresh', 'disconnected',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  null,
  'disconnected connections cannot retain tokens'
);

insert into public.azure_devops_connections (
  id,
  organization_id,
  tenant_id,
  authorized_user_id,
  authorized_user_display_name,
  authorized_user_email,
  granted_scopes,
  access_token_ciphertext,
  refresh_token_ciphertext,
  token_expires_at,
  azure_organization_id,
  azure_organization_name,
  azure_organization_url,
  created_by
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'tenant-one',
    'azure-admin',
    'Azure Admin',
    'azure-admin@example.test',
    array['vso.project', 'vso.work_write'],
    'encrypted-access',
    'encrypted-refresh',
    now() + interval '1 hour',
    'azure-org-one',
    'Azure Organization',
    'https://dev.azure.com/example',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '70000000-0000-0000-0000-000000000099',
    '10000000-0000-0000-0000-000000000099',
    'tenant-two',
    'azure-admin',
    '',
    null,
    '{}',
    null,
    null,
    null,
    null,
    null,
    null,
    '00000000-0000-0000-0000-000000000001'
  );

select lives_ok(
  $$update public.azure_devops_connections
    set safe_error_code = 'AZURE_RECONNECT_REQUIRED'
    where id = '70000000-0000-0000-0000-000000000001'$$,
  'approved uppercase safe error codes are persisted'
);
select throws_ok(
  $$update public.azure_devops_connections
    set safe_error_code = 'reconnect_required'
    where id = '70000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'lowercase safe error codes are rejected'
);

select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_connections
      set organization_id = '10000000-0000-0000-0000-000000000098'
      where id = '70000000-0000-0000-0000-000000000001';
      raise exception 'connection organization update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps connection provenance is immutable',
  'connection organization provenance cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_connections
      set created_by = '00000000-0000-0000-0000-000000000002'
      where id = '70000000-0000-0000-0000-000000000001';
      raise exception 'connection creator update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps connection provenance is immutable',
  'connection creator provenance cannot be rewritten'
);

select throws_ok(
  $$insert into public.azure_devops_oauth_states (
      state_hash, organization_id, user_id, pkce_verifier_ciphertext, expires_at
    ) values (
      repeat('A', 64), '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001', 'ciphertext', now() + interval '5 minutes'
    )$$,
  '23514',
  null,
  'OAuth state hashes must be exact lowercase SHA-256 hex'
);
select throws_ok(
  $$insert into public.azure_devops_oauth_states (
      state_hash, organization_id, user_id, pkce_verifier_ciphertext, expires_at
    ) values (
      repeat('d', 64), '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001', ' ', now() + interval '5 minutes'
    )$$,
  '23514',
  null,
  'blank encrypted PKCE verifiers are rejected'
);

insert into public.azure_devops_oauth_states (
  state_hash, organization_id, user_id, pkce_verifier_ciphertext, return_path, expires_at
)
values
  (
    repeat('a', 64), '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', 'encrypted-verifier',
    '/settings/integrations/azure-devops?connected=1', now() + interval '5 minutes'
  ),
  (
    repeat('b', 64), '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', 'expired-verifier',
    '/settings/integrations/azure-devops', now() - interval '1 minute'
  ),
  (
    repeat('c', 64), '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002', 'wrong-owner-verifier',
    '/settings/integrations/azure-devops', now() + interval '5 minutes'
  );

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$select pkce_verifier_ciphertext || ':' || return_path
    from public.consume_azure_devops_oauth_state(
      repeat('a', 64),
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  array['encrypted-verifier:/settings/integrations/azure-devops?connected=1'],
  'an unexpired matching OAuth state is consumed once'
);
select is_empty(
  $$select * from public.consume_azure_devops_oauth_state(
      repeat('a', 64),
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'a consumed OAuth state cannot be reused'
);
select is_empty(
  $$select * from public.consume_azure_devops_oauth_state(
      repeat('b', 64),
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'an expired OAuth state cannot be consumed'
);
select is_empty(
  $$select * from public.consume_azure_devops_oauth_state(
      repeat('c', 64),
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  'an OAuth state cannot be consumed by the wrong user'
);
select is(
  (select consumed_at is not null from public.azure_devops_oauth_states where state_hash = repeat('a', 64)),
  true,
  'successful OAuth state consumption records the timestamp'
);

reset role;

select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set state_hash = repeat('d', 64)
      where state_hash = repeat('a', 64);
      raise exception 'OAuth state hash update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state hashes cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set organization_id = '10000000-0000-0000-0000-000000000098'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth state organization update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state organization ownership cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set user_id = '00000000-0000-0000-0000-000000000002'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth state user update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state user ownership cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set pkce_verifier_ciphertext = 'rewritten-verifier'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth state secret update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state PKCE secrets cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set return_path = '/rewritten'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth return path update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth return paths cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set expires_at = expires_at + interval '1 hour'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth expiry update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state expiry cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set created_at = created_at + interval '1 second'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth creation timestamp update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state fields are immutable',
  'OAuth state creation timestamps cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set consumed_at = consumed_at + interval '1 second'
      where state_hash = repeat('a', 64);
      raise exception 'OAuth consumption timestamp update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state consumption is immutable',
  'consumed OAuth timestamps cannot be rewritten'
);
select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_oauth_states
      set consumed_at = null
      where state_hash = repeat('a', 64);
      raise exception 'OAuth state resurrection unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps OAuth state consumption is immutable',
  'consumed OAuth states cannot be resurrected'
);

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

reset role;
update public.azure_devops_connections
set
  access_token_ciphertext = null,
  refresh_token_ciphertext = null,
  token_expires_at = null,
  status = 'pending'
where id = '70000000-0000-0000-0000-000000000001';
set local role service_role;
select throws_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Azure Project', 'team-one', 'Azure Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '55000',
  'Azure DevOps connection is not ready',
  'credentialless pending connections cannot configure team links'
);
select results_eq(
  $$select connection.status::text || ':' || count(link.id)::text
    from public.azure_devops_connections as connection
    left join public.azure_devops_team_links as link
      on link.connection_id = connection.id
    where connection.id = '70000000-0000-0000-0000-000000000001'
    group by connection.status$$,
  array['pending:0'],
  'credential readiness rejection leaves connection and links unchanged'
);
reset role;
delete from public.azure_devops_team_links
where connection_id = '70000000-0000-0000-0000-000000000001';
update public.azure_devops_connections
set
  access_token_ciphertext = 'encrypted-access',
  refresh_token_ciphertext = 'encrypted-refresh',
  token_expires_at = now() + interval '1 hour',
  status = 'paused'
where id = '70000000-0000-0000-0000-000000000001';
set local role service_role;
select throws_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Azure Project', 'team-one', 'Azure Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '55000',
  'Azure DevOps connection is not ready',
  'paused connections cannot configure team links'
);
select results_eq(
  $$select connection.status::text || ':' || count(link.id)::text
    from public.azure_devops_connections as connection
    left join public.azure_devops_team_links as link
      on link.connection_id = connection.id
    where connection.id = '70000000-0000-0000-0000-000000000001'
    group by connection.status$$,
  array['paused:0'],
  'paused readiness rejection leaves connection and links unchanged'
);
reset role;
delete from public.azure_devops_team_links
where connection_id = '70000000-0000-0000-0000-000000000001';
update public.azure_devops_connections
set
  access_token_ciphertext = null,
  refresh_token_ciphertext = null,
  token_expires_at = null,
  status = 'disconnected'
where id = '70000000-0000-0000-0000-000000000001';
set local role service_role;
select throws_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Azure Project', 'team-one', 'Azure Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '55000',
  'Azure DevOps connection is not ready',
  'disconnected connections cannot configure team links'
);
select results_eq(
  $$select connection.status::text || ':' || count(link.id)::text
    from public.azure_devops_connections as connection
    left join public.azure_devops_team_links as link
      on link.connection_id = connection.id
    where connection.id = '70000000-0000-0000-0000-000000000001'
    group by connection.status$$,
  array['disconnected:0'],
  'disconnected readiness rejection leaves connection and links unchanged'
);
reset role;
delete from public.azure_devops_team_links
where connection_id = '70000000-0000-0000-0000-000000000001';
update public.azure_devops_connections
set
  access_token_ciphertext = 'encrypted-access',
  refresh_token_ciphertext = 'encrypted-refresh',
  token_expires_at = now() + interval '1 hour',
  status = 'pending'
where id = '70000000-0000-0000-0000-000000000001';
set local role service_role;

select results_eq(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Azure Project', 'team-one', 'Azure Team',
      '00000000-0000-0000-0000-000000000001'
    ) is not null$$,
  array[true],
  'an active organization admin can configure a team link'
);
select results_eq(
  $$select status::text from public.azure_devops_connections
    where id = '70000000-0000-0000-0000-000000000001'$$,
  array['configured'],
  'configuring a team link marks its connection configured'
);
select results_eq(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Renamed Azure Project', 'team-one', 'Renamed Azure Team',
      '00000000-0000-0000-0000-000000000001'
    ) is not null$$,
  array[true],
  'reconfiguration upserts mutable Azure display names'
);
select is(
  (select count(*)::integer
   from public.azure_devops_team_links
   where planning_team_id = '40000000-0000-0000-0000-000000000091'),
  1,
  'reconfiguring the same Azure mapping does not duplicate the link'
);
select results_eq(
  $$select azure_project_name || ':' || azure_team_name
    from public.azure_devops_team_links
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  array['Renamed Azure Project:Renamed Azure Team'],
  'upserted display names are persisted'
);
select throws_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000092',
      'project-two', 'Azure Project Two', 'team-two', 'Azure Team Two',
      '00000000-0000-0000-0000-000000000002'
    )$$,
  '42501',
  'active organization admin required',
  'non-admin creators cannot configure team links'
);
select throws_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000099',
      'project-cross', 'Cross Project', 'team-cross', 'Cross Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  'Azure DevOps organization mismatch',
  'configuration rejects a cross-organization planning team'
);

reset role;
update public.organization_memberships
set role = 'admin'
where organization_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';
set local role service_role;
select lives_ok(
  $$select public.configure_azure_devops_team_link(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000091',
      'project-one', 'Maintained Project', 'team-one', 'Maintained Team',
      '00000000-0000-0000-0000-000000000002'
    )$$,
  'a second active admin can maintain an existing team link'
);
select results_eq(
  $$select created_by::text || ':' || azure_project_name || ':' || azure_team_name
    from public.azure_devops_team_links
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  array['00000000-0000-0000-0000-000000000001:Maintained Project:Maintained Team'],
  'second-admin maintenance preserves original creator provenance'
);

reset role;

select throws_ok(
  $sql$do $mutation$
    begin
      update public.azure_devops_connections
      set azure_organization_id = 'rewritten-azure-org'
      where id = '70000000-0000-0000-0000-000000000001';
      raise exception 'mapped Azure organization update unexpectedly allowed';
    end
    $mutation$;$sql$,
  '23514',
  'Azure DevOps organization selection is immutable once mapped',
  'mapped connections cannot switch Azure organizations'
);

select throws_ok(
  $$insert into public.azure_devops_team_links (
      organization_id, connection_id, planning_team_id,
      azure_project_id, azure_project_name, azure_team_id, azure_team_name, created_by
    ) values (
      '10000000-0000-0000-0000-000000000099',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000099',
      'project-cross', 'Cross Project', 'team-cross', 'Cross Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  'Azure DevOps organization mismatch',
  'the validation trigger rejects cross-organization links'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set planning_team_id = '40000000-0000-0000-0000-000000000092'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'planning team provenance cannot be rewritten'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set azure_project_id = 'rewritten-project'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'Azure project identifiers cannot be rewritten'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set organization_id = '10000000-0000-0000-0000-000000000099'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'team link organization provenance cannot be rewritten'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set connection_id = '70000000-0000-0000-0000-000000000099'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'team link connection provenance cannot be rewritten'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set azure_team_id = 'rewritten-team'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'Azure team identifiers cannot be rewritten'
);
select throws_ok(
  $$update public.azure_devops_team_links
    set created_by = '00000000-0000-0000-0000-000000000002'
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  '23514',
  'Azure DevOps team link provenance is immutable',
  'team link creator provenance cannot be rewritten'
);
select throws_ok(
  $$insert into public.azure_devops_team_links (
      organization_id, connection_id, planning_team_id,
      azure_project_id, azure_project_name, azure_team_id, azure_team_name, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000092',
      'project-one', 'Duplicate Project', 'team-one', 'Duplicate Team',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23505',
  null,
  'an Azure team cannot map to multiple planning teams on one connection'
);

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$select public.disconnect_azure_devops_connection(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001'
    )$$,
  array[true],
  'an existing Azure DevOps connection disconnects successfully'
);
select results_eq(
  $$select
      status::text || ':' ||
      (access_token_ciphertext is null)::text || ':' ||
      (refresh_token_ciphertext is null)::text || ':' ||
      (token_expires_at is null)::text
    from public.azure_devops_connections
    where id = '70000000-0000-0000-0000-000000000001'$$,
  array['disconnected:true:true:true'],
  'disconnect clears both token ciphertexts and expiry'
);
select results_eq(
  $$select status::text from public.azure_devops_team_links
    where planning_team_id = '40000000-0000-0000-0000-000000000091'$$,
  array['disconnected'],
  'disconnect marks every preserved mapping disconnected'
);
select is(
  (select count(*)::integer from public.azure_devops_connections
   where id = '70000000-0000-0000-0000-000000000001'),
  1,
  'disconnect preserves the connection row'
);
select is(
  (select count(*)::integer from public.azure_devops_team_links
   where planning_team_id = '40000000-0000-0000-0000-000000000091'),
  1,
  'disconnect preserves team link rows'
);
select results_eq(
  $$select public.disconnect_azure_devops_connection(
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001'
    )$$,
  array[true],
  'disconnect is idempotently true for an existing connection'
);
select results_eq(
  $$select public.disconnect_azure_devops_connection(
      '10000000-0000-0000-0000-000000000099',
      '70000000-0000-0000-0000-000000000001'
    )$$,
  array[false],
  'disconnect is false when organization and connection do not match'
);

reset role;

select * from finish();
rollback;
