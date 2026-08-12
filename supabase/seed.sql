-- Deterministic, fictional identities for local development and acceptance tests.
-- These accounts are intentionally created at the Auth storage layer because
-- self-sign-up remains disabled in every environment.

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  email_change_confirm_status,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  fixture.id::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated'::text,
  'authenticated'::text,
  fixture.email::text,
  crypt('Password123!', gen_salt('bf')),
  '2026-08-01 00:00:00+00'::timestamptz,
  ''::text as confirmation_token,
  ''::text as recovery_token,
  ''::text as email_change,
  ''::text as email_change_token_new,
  ''::text as email_change_token_current,
  0::smallint as email_change_confirm_status,
  ''::text as phone_change,
  ''::text as phone_change_token,
  ''::text as reauthentication_token,
  false as is_sso_user,
  false as is_anonymous,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('display_name', fixture.display_name),
  '2026-08-01 00:00:00+00'::timestamptz,
  '2026-08-01 00:00:00+00'::timestamptz
from (
  values
    (
      '00000000-0000-0000-0000-000000000001',
      'admin@example.test',
      'Asha Admin'
    ),
    (
      '00000000-0000-0000-0000-000000000002',
      'employee@example.test',
      'Eshan Employee'
    )
) as fixture (id, email, display_name)
on conflict (id) do update
set
  instance_id = excluded.instance_id,
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change = excluded.email_change,
  email_change_token_new = excluded.email_change_token_new,
  email_change_token_current = excluded.email_change_token_current,
  email_change_confirm_status = excluded.email_change_confirm_status,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  is_sso_user = excluded.is_sso_user,
  is_anonymous = excluded.is_anonymous,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    $json${"sub":"00000000-0000-0000-0000-000000000001","email":"admin@example.test","email_verified":true,"phone_verified":false}$json$::jsonb,
    'email',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    $json${"sub":"00000000-0000-0000-0000-000000000002","email":"employee@example.test","email_verified":true,"phone_verified":false}$json$::jsonb,
    'email',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  )
on conflict (id) do update
set
  provider_id = excluded.provider_id,
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  provider = excluded.provider,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = excluded.updated_at;

insert into public.profiles (
  id,
  display_name,
  connect_code,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Asha Admin',
    'ASHA22',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Eshan Employee',
    'ESHAN2',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  connect_code = excluded.connect_code;

insert into public.organizations (
  id,
  name,
  timezone,
  created_by,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  'TaskFlow Demo',
  'Asia/Kolkata',
  '00000000-0000-0000-0000-000000000001',
  '2026-08-01 00:00:00+00',
  '2026-08-01 00:00:00+00'
)
on conflict (id) do update
set
  name = excluded.name,
  timezone = excluded.timezone,
  created_by = excluded.created_by;

insert into public.organization_memberships (
  id,
  organization_id,
  user_id,
  role,
  status,
  created_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin'::public.membership_role,
    'active'::public.membership_status,
    '2026-08-01 00:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'employee'::public.membership_role,
    'active'::public.membership_status,
    '2026-08-01 00:00:00+00'
  )
on conflict (organization_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status;
