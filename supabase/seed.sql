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
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.test',
    crypt('Password123!', gen_salt('bf')),
    '2026-08-01 00:00:00+00',
    $json${"provider":"email","providers":["email"]}$json$::jsonb,
    $json${"display_name":"Asha Admin"}$json$::jsonb,
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee@example.test',
    crypt('Password123!', gen_salt('bf')),
    '2026-08-01 00:00:00+00',
    $json${"provider":"email","providers":["email"]}$json$::jsonb,
    $json${"display_name":"Eshan Employee"}$json$::jsonb,
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
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

insert into public.profiles (id, display_name, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Asha Admin',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Eshan Employee',
    '2026-08-01 00:00:00+00',
    '2026-08-01 00:00:00+00'
  )
on conflict (id) do update
set display_name = excluded.display_name;

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
