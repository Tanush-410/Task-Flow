update public.invitations
set delivery_status = 'failed'
where revoked_at is not null
  and delivery_status = 'active';
