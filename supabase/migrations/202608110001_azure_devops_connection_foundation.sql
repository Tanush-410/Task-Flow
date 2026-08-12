create type public.azure_devops_connection_status as enum (
  'pending',
  'configured',
  'paused',
  'disconnected'
);

create table public.azure_devops_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations (id) on delete cascade,
  tenant_id text not null
    check (char_length(btrim(tenant_id)) between 1 and 256),
  authorized_user_id text not null
    check (char_length(btrim(authorized_user_id)) between 1 and 256),
  authorized_user_display_name text not null default ''
    check (char_length(authorized_user_display_name) <= 200),
  authorized_user_email text
    check (
      authorized_user_email is null
      or char_length(btrim(authorized_user_email)) between 3 and 320
    ),
  granted_scopes text[] not null default '{}'
    check (cardinality(granted_scopes) <= 100),
  access_token_ciphertext text
    check (
      access_token_ciphertext is null
      or char_length(btrim(access_token_ciphertext)) between 1 and 16384
    ),
  refresh_token_ciphertext text
    check (
      refresh_token_ciphertext is null
      or char_length(btrim(refresh_token_ciphertext)) between 1 and 16384
    ),
  token_expires_at timestamptz,
  azure_organization_id text
    check (
      azure_organization_id is null
      or char_length(btrim(azure_organization_id)) between 1 and 256
    ),
  azure_organization_name text
    check (
      azure_organization_name is null
      or char_length(btrim(azure_organization_name)) between 1 and 256
    ),
  azure_organization_url text
    check (
      azure_organization_url is null
      or char_length(btrim(azure_organization_url)) between 1 and 2048
    ),
  status public.azure_devops_connection_status not null default 'pending',
  safe_error_code text
    check (
      safe_error_code is null
      or safe_error_code ~ '^[A-Z][A-Z0-9_]{0,99}$'
    ),
  last_verified_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint azure_devops_connections_token_pair_check check (
    (access_token_ciphertext is null) = (refresh_token_ciphertext is null)
  ),
  constraint azure_devops_connections_disconnected_tokens_check check (
    status <> 'disconnected'
    or (
      access_token_ciphertext is null
      and refresh_token_ciphertext is null
    )
  )
);

create trigger azure_devops_connections_set_updated_at
before update on public.azure_devops_connections
for each row execute function public.set_updated_at();

create table public.azure_devops_oauth_states (
  state_hash text primary key
    check (state_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  pkce_verifier_ciphertext text not null
    check (char_length(btrim(pkce_verifier_ciphertext)) between 1 and 8192),
  return_path text not null default '/settings/integrations/azure-devops'
    check (char_length(btrim(return_path)) between 1 and 2048),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index azure_devops_oauth_states_expiry_idx
on public.azure_devops_oauth_states (expires_at)
where consumed_at is null;

create index azure_devops_oauth_states_org_user_idx
on public.azure_devops_oauth_states (organization_id, user_id, created_at);

create table public.azure_devops_team_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  connection_id uuid not null
    references public.azure_devops_connections (id) on delete cascade,
  planning_team_id uuid not null unique
    references public.planning_teams (id) on delete restrict,
  azure_project_id text not null
    check (char_length(btrim(azure_project_id)) between 1 and 256),
  azure_project_name text not null
    check (char_length(btrim(azure_project_name)) between 1 and 256),
  azure_team_id text not null
    check (char_length(btrim(azure_team_id)) between 1 and 256),
  azure_team_name text not null
    check (char_length(btrim(azure_team_name)) between 1 and 256),
  status public.azure_devops_connection_status not null default 'configured',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint azure_devops_team_links_azure_team_unique_idx unique (
    connection_id,
    azure_project_id,
    azure_team_id
  )
);

create index azure_devops_team_links_org_connection_idx
on public.azure_devops_team_links (organization_id, connection_id);

create trigger azure_devops_team_links_set_updated_at
before update on public.azure_devops_team_links
for each row execute function public.set_updated_at();

create or replace function public.protect_azure_devops_connection_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps connection provenance is immutable';
  end if;

  if new.azure_organization_id is distinct from old.azure_organization_id
    and exists (
      select 1
      from public.azure_devops_team_links as link
      where link.connection_id = old.id
    ) then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps organization selection is immutable once mapped';
  end if;

  return new;
end;
$$;

create trigger azure_devops_connections_protect_lifecycle
before update of organization_id, created_by, azure_organization_id
on public.azure_devops_connections
for each row execute function public.protect_azure_devops_connection_lifecycle();

create or replace function public.protect_azure_devops_oauth_state_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state_hash is distinct from old.state_hash
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
    or new.pkce_verifier_ciphertext is distinct from old.pkce_verifier_ciphertext
    or new.return_path is distinct from old.return_path
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps OAuth state fields are immutable';
  end if;

  if old.consumed_at is not null
    and new.consumed_at is distinct from old.consumed_at then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps OAuth state consumption is immutable';
  end if;

  return new;
end;
$$;

create trigger azure_devops_oauth_states_protect_lifecycle
before update on public.azure_devops_oauth_states
for each row execute function public.protect_azure_devops_oauth_state_lifecycle();

create or replace function public.validate_azure_devops_team_link_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_organization_id uuid;
  team_organization_id uuid;
begin
  select connection.organization_id
  into connection_organization_id
  from public.azure_devops_connections as connection
  where connection.id = new.connection_id;

  select team.organization_id
  into team_organization_id
  from public.planning_teams as team
  where team.id = new.planning_team_id;

  if connection_organization_id is null
    or team_organization_id is null
    or connection_organization_id <> new.organization_id
    or team_organization_id <> new.organization_id then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps organization mismatch';
  end if;

  return new;
end;
$$;

create trigger azure_devops_team_links_validate_organization
before insert or update of organization_id, connection_id, planning_team_id
on public.azure_devops_team_links
for each row execute function public.validate_azure_devops_team_link_organization();

create or replace function public.prevent_azure_devops_team_link_provenance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.connection_id is distinct from old.connection_id
    or new.planning_team_id is distinct from old.planning_team_id
    or new.azure_project_id is distinct from old.azure_project_id
    or new.azure_team_id is distinct from old.azure_team_id
    or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps team link provenance is immutable';
  end if;

  return new;
end;
$$;

create trigger azure_devops_team_links_immutable_provenance
before update of
  organization_id,
  connection_id,
  planning_team_id,
  azure_project_id,
  azure_team_id,
  created_by
on public.azure_devops_team_links
for each row execute function public.prevent_azure_devops_team_link_provenance_change();

create or replace function public.consume_azure_devops_oauth_state(
  target_state_hash text,
  target_organization_id uuid,
  target_user_id uuid
)
returns table (
  pkce_verifier_ciphertext text,
  return_path text
)
language sql
security definer
set search_path = ''
as $$
  update public.azure_devops_oauth_states as oauth_state
  set consumed_at = statement_timestamp()
  where oauth_state.state_hash = target_state_hash
    and oauth_state.organization_id = target_organization_id
    and oauth_state.user_id = target_user_id
    and oauth_state.consumed_at is null
    and oauth_state.expires_at > statement_timestamp()
  returning oauth_state.pkce_verifier_ciphertext, oauth_state.return_path;
$$;

create or replace function public.configure_azure_devops_team_link(
  target_organization_id uuid,
  target_connection_id uuid,
  target_planning_team_id uuid,
  target_azure_project_id text,
  target_azure_project_name text,
  target_azure_team_id text,
  target_azure_team_name text,
  target_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_organization_id uuid;
  connection_access_token_ciphertext text;
  connection_refresh_token_ciphertext text;
  connection_azure_organization_id text;
  connection_azure_organization_name text;
  connection_azure_organization_url text;
  connection_status public.azure_devops_connection_status;
  team_organization_id uuid;
  configured_link_id uuid;
  existing_link public.azure_devops_team_links%rowtype;
begin
  select
    connection.organization_id,
    connection.access_token_ciphertext,
    connection.refresh_token_ciphertext,
    connection.azure_organization_id,
    connection.azure_organization_name,
    connection.azure_organization_url,
    connection.status
  into
    connection_organization_id,
    connection_access_token_ciphertext,
    connection_refresh_token_ciphertext,
    connection_azure_organization_id,
    connection_azure_organization_name,
    connection_azure_organization_url,
    connection_status
  from public.azure_devops_connections as connection
  where connection.id = target_connection_id
  for update;

  select team.organization_id
  into team_organization_id
  from public.planning_teams as team
  where team.id = target_planning_team_id;

  if connection_organization_id is null
    or team_organization_id is null
    or connection_organization_id <> target_organization_id
    or team_organization_id <> target_organization_id then
    raise exception using
      errcode = '23514',
      message = 'Azure DevOps organization mismatch';
  end if;

  if connection_access_token_ciphertext is null
    or connection_refresh_token_ciphertext is null
    or connection_azure_organization_id is null
    or connection_azure_organization_name is null
    or connection_azure_organization_url is null
    or connection_status not in ('pending', 'configured') then
    raise exception using
      errcode = '55000',
      message = 'Azure DevOps connection is not ready';
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_created_by
      and membership.role = 'admin'
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'active organization admin required';
  end if;

  select link.*
  into existing_link
  from public.azure_devops_team_links as link
  where link.planning_team_id = target_planning_team_id
  for update;

  if found then
    if existing_link.organization_id <> target_organization_id
      or existing_link.connection_id <> target_connection_id
      or existing_link.azure_project_id <> target_azure_project_id
      or existing_link.azure_team_id <> target_azure_team_id then
      raise exception using
        errcode = '23514',
        message = 'Azure DevOps team link provenance is immutable';
    end if;

    update public.azure_devops_team_links as link
    set
      azure_project_name = target_azure_project_name,
      azure_team_name = target_azure_team_name,
      status = 'configured'
    where link.id = existing_link.id
    returning link.id into configured_link_id;
  else
    insert into public.azure_devops_team_links (
      organization_id,
      connection_id,
      planning_team_id,
      azure_project_id,
      azure_project_name,
      azure_team_id,
      azure_team_name,
      status,
      created_by
    )
    values (
      target_organization_id,
      target_connection_id,
      target_planning_team_id,
      target_azure_project_id,
      target_azure_project_name,
      target_azure_team_id,
      target_azure_team_name,
      'configured',
      target_created_by
    )
    returning id into configured_link_id;
  end if;

  update public.azure_devops_connections as connection
  set status = 'configured'
  where connection.id = target_connection_id;

  return configured_link_id;
end;
$$;

create or replace function public.disconnect_azure_devops_connection(
  target_organization_id uuid,
  target_connection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.azure_devops_connections as connection
  where connection.id = target_connection_id
    and connection.organization_id = target_organization_id
  for update;

  if not found then
    return false;
  end if;

  update public.azure_devops_connections as connection
  set
    access_token_ciphertext = null,
    refresh_token_ciphertext = null,
    token_expires_at = null,
    status = 'disconnected'
  where connection.id = target_connection_id
    and connection.organization_id = target_organization_id;

  update public.azure_devops_team_links as link
  set status = 'disconnected'
  where link.connection_id = target_connection_id
    and link.organization_id = target_organization_id;

  return true;
end;
$$;

alter table public.azure_devops_connections enable row level security;
alter table public.azure_devops_oauth_states enable row level security;
alter table public.azure_devops_team_links enable row level security;

revoke all on table public.azure_devops_connections from public, anon, authenticated;
revoke all on table public.azure_devops_oauth_states from public, anon, authenticated;
revoke all on table public.azure_devops_team_links from public, anon, authenticated;

grant select, insert, update
on table public.azure_devops_connections to service_role;
grant select, insert, delete
on table public.azure_devops_oauth_states to service_role;
grant select
on table public.azure_devops_team_links to service_role;

revoke all on function public.protect_azure_devops_connection_lifecycle()
from public, anon, authenticated;
revoke all on function public.protect_azure_devops_oauth_state_lifecycle()
from public, anon, authenticated;
revoke all on function public.validate_azure_devops_team_link_organization()
from public, anon, authenticated;
revoke all on function public.prevent_azure_devops_team_link_provenance_change()
from public, anon, authenticated;
revoke all on function public.consume_azure_devops_oauth_state(text, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.configure_azure_devops_team_link(
  uuid, uuid, uuid, text, text, text, text, uuid
)
from public, anon, authenticated;
revoke all on function public.disconnect_azure_devops_connection(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.protect_azure_devops_connection_lifecycle()
to service_role;
grant execute on function public.protect_azure_devops_oauth_state_lifecycle()
to service_role;
grant execute on function public.validate_azure_devops_team_link_organization()
to service_role;
grant execute on function public.prevent_azure_devops_team_link_provenance_change()
to service_role;
grant execute on function public.consume_azure_devops_oauth_state(text, uuid, uuid)
to service_role;
grant execute on function public.configure_azure_devops_team_link(
  uuid, uuid, uuid, text, text, text, text, uuid
)
to service_role;
grant execute on function public.disconnect_azure_devops_connection(uuid, uuid)
to service_role;

insert into public.feature_flags (
  key,
  environment,
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
    'azure_devops_integration', 'development', true, 100,
    'product-engineering', 'Gate Azure DevOps integration',
    'Enabled for local connection verification', '2026-09-11', '2027-08-11'
  ),
  (
    'azure_devops_integration', 'staging', false, 0,
    'product-engineering', 'Gate Azure DevOps integration',
    'Enable after connection security acceptance', '2026-09-11', '2027-08-11'
  ),
  (
    'azure_devops_integration', 'production', false, 0,
    'product-engineering', 'Gate Azure DevOps integration',
    'Organization-scoped rollout after staging approval', '2026-09-11', '2027-08-11'
  )
on conflict (organization_id, environment, role_scope, key) do nothing;
