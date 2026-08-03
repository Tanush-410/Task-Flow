import { TaskForm } from '@/components/task-form';
import { listOrganizationMembers } from '@/modules/members/queries';

export default async function NewTaskPage() {
  const members = await listOrganizationMembers();
  const employees = members.filter(
    (member) => member.role === 'employee' && member.status === 'active',
  );

  return (
    <section aria-labelledby="new-task-heading">
      <p className="text-sm font-medium text-slate-500">Create</p>
      <h1
        className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
        id="new-task-heading"
      >
        Create Task
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
        Fill in the details and assign it to one or more employees. They are
        notified as soon as you submit.
      </p>

      <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)] sm:p-8">
        <TaskForm employees={employees} />
      </div>
    </section>
  );
}
