do $$
begin
  if not exists (
    select 1 from public.organizations
    where id = '91000000-0000-0000-0000-000000000001'
      and name = 'Legacy Workspace'
  ) then
    raise exception 'upgrade lost the legacy organization';
  end if;

  if not exists (
    select 1 from public.organization_memberships
    where id = '92000000-0000-0000-0000-000000000001'
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception 'upgrade lost the legacy administrator';
  end if;

  if not exists (
    select 1 from public.invitations
    where id = '93000000-0000-0000-0000-000000000002'
      and delivery_status = 'active'
      and revoked_at is null
  ) then
    raise exception 'upgrade did not preserve the newest invitation';
  end if;

  if not exists (
    select 1 from public.invitations
    where id = '93000000-0000-0000-0000-000000000001'
      and delivery_status = 'failed'
      and revoked_at is not null
  ) then
    raise exception 'upgrade did not retire the replaced invitation';
  end if;

  if not exists (
    select 1 from public.feature_flags
    where id = '94000000-0000-0000-0000-000000000001'
      and key = 'legacy_rollout'
  ) then
    raise exception 'upgrade lost the legacy feature flag';
  end if;

  if to_regclass('public.feature_flags_evaluation_lookup_idx') is null then
    raise exception 'upgrade did not create the feature flag lookup index';
  end if;
end;
$$;
