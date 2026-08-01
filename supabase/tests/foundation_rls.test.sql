begin;

select plan(4);

select has_table(
  'public',
  'organizations',
  'public.organizations should exist'
);

select has_table(
  'public',
  'organization_memberships',
  'public.organization_memberships should exist'
);

select policies_are(
  'public',
  'organizations',
  array['members_view_organization', 'admins_update_organization'],
  'organizations should have exactly the member-view and admin-update policies'
);

select policies_are(
  'public',
  'organization_memberships',
  array['members_view_memberships', 'admins_manage_memberships'],
  'organization_memberships should have exactly the member-view and admin-manage policies'
);

select * from finish();
rollback;
