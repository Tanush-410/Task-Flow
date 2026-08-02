-- Representative records created against the initial foundation schema.
-- CI loads this after resetting to migration 202608010001, then applies every
-- later migration to prove the upgrade path preserves and normalizes data.

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
values (
  '90000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'legacy-admin@example.test',
  crypt('Password123!', gen_salt('bf')),
  '2026-08-01 00:00:00+00',
  '',
  '',
  '',
  '',
  '',
  0,
  '',
  '',
  '',
  false,
  false,
  $json${"provider":"email","providers":["email"]}$json$::jsonb,
  $json${"display_name":"Legacy Admin"}$json$::jsonb,
  '2026-08-01 00:00:00+00',
  '2026-08-01 00:00:00+00'
);

insert into public.organizations (
  id, name, timezone, created_by, created_at, updated_at
)
values (
  '91000000-0000-0000-0000-000000000001',
  'Legacy Workspace',
  'Asia/Kolkata',
  '90000000-0000-0000-0000-000000000001',
  '2026-08-01 00:00:00+00',
  '2026-08-01 00:00:00+00'
);

insert into public.organization_memberships (
  id, organization_id, user_id, role, status, created_at
)
values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  'admin',
  'active',
  '2026-08-01 00:00:00+00'
);

insert into public.invitations (
  id, organization_id, email, role, token_hash, invited_by, expires_at,
  created_at
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'legacy-invitee@example.test',
    'employee',
    repeat('a', 64),
    '90000000-0000-0000-0000-000000000001',
    '2099-08-08 00:00:00+00',
    '2026-08-01 01:00:00+00'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    'legacy-invitee@example.test',
    'employee',
    repeat('b', 64),
    '90000000-0000-0000-0000-000000000001',
    '2099-08-08 00:00:00+00',
    '2026-08-01 02:00:00+00'
  );

insert into public.feature_flags (
  id, organization_id, key, environment, role_scope, enabled,
  rollout_percentage, owner, purpose, rollout_plan, review_on, expires_on,
  created_at, updated_at
)
values (
  '94000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'legacy_rollout',
  'development',
  'admin',
  true,
  100,
  'platform-team',
  'Prove feature flags survive incremental upgrades.',
  'Keep enabled only in the deterministic upgrade fixture.',
  '2026-08-02',
  '2099-08-08',
  '2026-08-01 00:00:00+00',
  '2026-08-01 00:00:00+00'
);
