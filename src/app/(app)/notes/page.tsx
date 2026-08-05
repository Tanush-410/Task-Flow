import { NotesBoard } from '@/components/notes/notes-board';
import { PageHeader } from '@/components/ui/page-header';
import { requireMembership } from '@/modules/members/queries';
import { listMyNotes } from '@/modules/notes/queries';

export default async function NotesPage() {
  await requireMembership();
  const notes = await listMyNotes();

  return (
    <section aria-labelledby="notes-heading" className="space-y-6">
      <PageHeader
        description="Personal notes — only visible to you."
        eyebrow="Notes"
        headingId="notes-heading"
        title="Notes"
      />

      <NotesBoard initialNotes={notes} />
    </section>
  );
}
