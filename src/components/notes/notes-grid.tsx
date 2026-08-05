import type { Note } from '@/modules/notes/queries';

import { NoteCard } from './note-card';

type NoteCardHandlers = {
  onUpdate: (
    id: string,
    patch: { title: string; body: string; color: string },
  ) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onToggleArchived: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onToggleChecklistItem: (
    noteId: string,
    itemId: string,
    checked: boolean,
  ) => void;
  onSaveChecklistItems: (
    noteId: string,
    items: { text: string; checked: boolean }[],
  ) => void;
};

function Columns({
  notes,
  handlers,
}: {
  notes: Note[];
  handlers: NoteCardHandlers;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} {...handlers} />
      ))}
    </div>
  );
}

export function NotesGrid({
  notes,
  handlers,
}: {
  notes: Note[];
  handlers: NoteCardHandlers;
}) {
  const pinned = notes.filter((note) => note.pinned);
  const others = notes.filter((note) => !note.pinned);

  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  }

  return (
    <div className="space-y-6">
      {pinned.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Pinned
          </h2>
          <Columns handlers={handlers} notes={pinned} />
        </div>
      ) : null}
      {others.length > 0 ? (
        <div>
          {pinned.length > 0 ? (
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Others
            </h2>
          ) : null}
          <Columns handlers={handlers} notes={others} />
        </div>
      ) : null}
    </div>
  );
}
