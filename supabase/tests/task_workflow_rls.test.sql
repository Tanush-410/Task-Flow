begin;

select plan(33);

select has_table('public', 'tasks', 'tasks exist');
select has_table('public', 'task_assignments', 'task assignments exist');
select has_table('public', 'task_activity_events', 'task activity events exist');
select has_table('public', 'task_acknowledgements', 'task acknowledgements exist');
select has_table('public', 'task_notifications', 'task notifications exist');

select has_column('public', 'tasks', 'acknowledgement_required', 'tasks track acknowledgement requirements');
select has_column('public', 'tasks', 'status', 'tasks track publication state');
select has_column('public', 'tasks', 'priority', 'tasks track priority');
select has_column('public', 'task_assignments', 'status', 'assignments track status');
select has_column('public', 'task_assignments', 'progress', 'assignments track progress');
select has_column('public', 'task_assignments', 'delay_reason', 'assignments track delay reasons');
select has_column('public', 'task_activity_events', 'event_type', 'activity records type');
select has_column('public', 'task_acknowledgements', 'activity_event_id', 'acknowledgements reference activity events');
select has_column('public', 'task_notifications', 'read_at', 'notifications track read state');

select has_function('public', 'is_task_admin', array['uuid'], 'task admin helper exists');
select has_function('public', 'is_task_participant', array['uuid'], 'task participant helper exists');
select has_function('public', 'is_task_assignment_owner', array['uuid'], 'task assignment owner helper exists');

select ok(
  has_function_privilege('authenticated', 'public.is_task_admin(uuid)', 'execute'),
  'authenticated users can execute task admin checks'
);
select ok(
  has_function_privilege('authenticated', 'public.is_task_participant(uuid)', 'execute'),
  'authenticated users can execute task participant checks'
);
select ok(
  has_function_privilege('authenticated', 'public.is_task_assignment_owner(uuid)', 'execute'),
  'authenticated users can execute task assignment owner checks'
);

select policies_are(
  'public',
  'tasks',
  array[
    'tasks_delete_admins',
    'tasks_insert_members',
    'tasks_select_admins_by_org',
    'tasks_select_creator',
    'tasks_update_admins',
    'tasks_view_participants'
  ],
  'tasks have the current member and admin policies'
);

select policies_are(
  'public',
  'task_assignments',
  array[
    'task_assignments_view_participants',
    'task_assignments_manage_self_or_admin',
    'task_assignments_insert_members',
    'task_assignments_delete_members',
    'task_assignments_view_org_members'
  ],
  'assignments have the participant and organization member policies'
);

select policies_are(
  'public',
  'task_activity_events',
  array['task_activity_view_participants'],
  'activity events are visible to task participants'
);

select policies_are(
  'public',
  'task_acknowledgements',
  array['task_acknowledgements_view_participants', 'task_acknowledgements_insert_participants'],
  'acknowledgements are visible and writable to participants'
);

select policies_are(
  'public',
  'task_notifications',
  array[
    'task_notifications_view_recipient_or_admin',
    'task_notifications_manage_recipient_or_admin',
    'task_notifications_insert_org_members',
    'task_notifications_insert_participants'
  ],
  'notifications are visible and manageable to recipients or admins'
);

select ok(
  not has_table_privilege('anon', 'public.tasks', 'select')
  and not has_table_privilege('anon', 'public.task_assignments', 'select')
  and not has_table_privilege('anon', 'public.task_activity_events', 'select')
  and not has_table_privilege('anon', 'public.task_acknowledgements', 'select')
  and not has_table_privilege('anon', 'public.task_notifications', 'select'),
  'anonymous users have no direct access to task tables'
);

select ok(
  has_table_privilege('authenticated', 'public.tasks', 'select')
  and has_table_privilege('authenticated', 'public.task_assignments', 'select')
  and has_table_privilege('authenticated', 'public.task_activity_events', 'select')
  and has_table_privilege('authenticated', 'public.task_acknowledgements', 'select')
  and has_table_privilege('authenticated', 'public.task_notifications', 'select'),
  'authenticated users can select from task workflow tables'
);

select ok(
  has_column_privilege('authenticated', 'public.tasks', 'title', 'insert')
  and has_column_privilege('authenticated', 'public.tasks', 'priority', 'update')
  and has_column_privilege('authenticated', 'public.task_assignments', 'status', 'update')
  and has_column_privilege('authenticated', 'public.task_assignments', 'progress', 'update')
  and has_column_privilege('authenticated', 'public.task_notifications', 'read_at', 'update'),
  'authenticated users can touch the mutable workflow columns'
);

select ok(
  not has_column_privilege('authenticated', 'public.tasks', 'organization_id', 'update')
  and not has_column_privilege('authenticated', 'public.tasks', 'created_by', 'update')
  and not has_column_privilege('authenticated', 'public.task_assignments', 'task_id', 'update')
  and not has_column_privilege('authenticated', 'public.task_assignments', 'assignee_id', 'update')
  and not has_column_privilege('authenticated', 'public.task_notifications', 'organization_id', 'update'),
  'authenticated users cannot rewrite workflow provenance columns'
);

select has_index('public', 'tasks', 'tasks_organization_status_due_idx', 'tasks index by organization/status/due exists');
select has_index('public', 'task_assignments', 'task_assignments_task_id_idx', 'assignment task index exists');
select has_index('public', 'task_activity_events', 'task_activity_events_task_created_idx', 'activity task index exists');
select has_index('public', 'task_notifications', 'task_notifications_recipient_read_idx', 'notification inbox index exists');

rollback;
