create index feature_flags_evaluation_lookup_idx
on public.feature_flags (key, environment, organization_id, role_scope);
