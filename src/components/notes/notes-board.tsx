'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  createNote as createNoteAction,
  deleteNote as deleteNoteAction,
  saveChecklistItems as saveChecklistItemsAction,
  setChecklistItemChecked as setChecklistItemCheckedAction,
  setNoteArchived as setNoteArchivedAction,
  setNotePinned as setNotePinnedAction,
  updateNote as updateNoteAction,
} from '@/modules/notes/actions';
import type { Note } from '@/modules/notes/queries';
import { Input } from '@/components/ui/input';

import { NoteComposer } from './note-composer';
import { NotesGrid } from './notes-grid';

export function NotesBoard({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'archived'>('all');

  function patchNote(id: string, patch: Partial<Note>) {
    setNotes((previous) =>
      previous.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    );
  }

  async function handleCreate(input: {
    noteType: 'text' | 'checklist';
    title: string;
    body: string;
    color: string;
    items: { text: string; checked: boolean }[];
  }) {
    const result = await createNoteAction({
      noteType: input.noteType,
      title: input.title,
      body: input.body,
      color: input.color,
    });
    if (!result.ok) return;

    const id = result.data.id;
    const now = new Date().toISOString();
    let items: Note['items'] = [];

    if (input.noteType === 'checklist' && input.items.length > 0) {
      const saved = await saveChecklistItemsAction({
        noteId: id,
        items: input.items,
      });
      if (saved.ok) {
        items = saved.data.items;
      }
    }

    setNotes((previous) => [
      {
        id,
        noteType: input.noteType,
        title: input.title,
        body: input.body,
        color: input.color,
        pinned: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
        items,
      },
      ...previous,
    ]);
  }

  function handleUpdate(
    id: string,
    patch: { title: string; body: string; color: string },
  ) {
    patchNote(id, patch);
    void updateNoteAction({ id, ...patch });
  }

  function handleTogglePinned(id: string, pinned: boolean) {
    patchNote(id, { pinned });
    void setNotePinnedAction({ id, pinned });
  }

  function handleToggleArchived(id: string, archived: boolean) {
    patchNote(id, { archived });
    void setNoteArchivedAction({ id, archived });
  }

  function handleDelete(id: string) {
    setNotes((previous) => previous.filter((note) => note.id !== id));
    void deleteNoteAction({ id });
  }

  function handleToggleChecklistItem(
    noteId: string,
    itemId: string,
    checked: boolean,
  ) {
    setNotes((previous) =>
      previous.map((note) =>
        note.id === noteId
          ? {
              ...note,
              items: note.items.map((item) =>
                item.id === itemId ? { ...item, checked } : item,
              ),
            }
          : note,
      ),
    );
    void setChecklistItemCheckedAction({ itemId, checked });
  }

  async function handleSaveChecklistItems(
    noteId: string,
    items: { text: string; checked: boolean }[],
  ) {
    const result = await saveChecklistItemsAction({ noteId, items });
    if (result.ok) {
      patchNote(noteId, { items: result.data.items });
    }
  }

  const handlers = {
    onUpdate: handleUpdate,
    onTogglePinned: handleTogglePinned,
    onToggleArchived: handleToggleArchived,
    onDelete: handleDelete,
    onToggleChecklistItem: handleToggleChecklistItem,
    onSaveChecklistItems: handleSaveChecklistItems,
  };

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes
      .filter((note) => (view === 'archived' ? note.archived : !note.archived))
      .filter((note) => {
        if (query.length === 0) return true;
        return (
          note.title.toLowerCase().includes(query) ||
          note.body.toLowerCase().includes(query) ||
          note.items.some((item) => item.text.toLowerCase().includes(query))
        );
      });
  }, [notes, search, view]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            aria-hidden
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes"
            value={search}
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-[3px]">
          {(['all', 'archived'] as const).map((option) => (
            <button
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === option
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              key={option}
              onClick={() => setView(option)}
              type="button"
            >
              {option === 'all' ? 'Notes' : 'Archived'}
            </button>
          ))}
        </div>
      </div>

      {view === 'all' ? (
        <div className="max-w-2xl">
          <NoteComposer onCreate={handleCreate} />
        </div>
      ) : null}

      <NotesGrid handlers={handlers} notes={visibleNotes} />
    </div>
  );
}
