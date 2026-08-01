create unique index organization_memberships_one_active_per_user_idx
on public.organization_memberships (user_id)
where status = 'active';
