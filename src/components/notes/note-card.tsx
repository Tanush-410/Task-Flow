'use client';

import {
  Archive,
  ArchiveRestore,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type { Note, NoteChecklistItem } from '@/modules/notes/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { ColorSwatchPicker } from './color-swatch-picker';
import { noteCardClassName } from './note-colors';

type EditableItem = { id?: string; text: string; checked: boolean };

export function NoteCard({
  note,
  onUpdate,
  onTogglePinned,
  onToggleArchived,
  onDelete,
  onToggleChecklistItem,
  onSaveChecklistItems,
}: {
  note: Note;
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
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [color, setColor] = useState(note.color);
  const [items, setItems] = useState<EditableItem[]>(note.items);
  const [newItemText, setNewItemText] = useState('');

  function openEditor() {
    setTitle(note.title);
    setBody(note.body);
    setColor(note.color);
    setItems(note.items);
    setNewItemText('');
    setEditing(true);
  }

  function closeEditor() {
    setEditing(false);
    onUpdate(note.id, { title, body, color });
    if (note.noteType === 'checklist') {
      const finalItems = [...items];
      if (newItemText.trim().length > 0) {
        finalItems.push({ text: newItemText.trim(), checked: false });
      }
      onSaveChecklistItems(
        note.id,
        finalItems.map((item) => ({ text: item.text, checked: item.checked })),
      );
    }
  }

  function addItemFromInput() {
    const text = newItemText.trim();
    if (text.length === 0) return;
    setItems((previous) => [...previous, { text, checked: false }]);
    setNewItemText('');
  }

  const cardClassName = noteCardClassName(color);

  if (editing) {
    return (
      <div className="mb-4 break-inside-avoid">
        <Card className={`p-3 ring-1 sm:p-3 ${cardClassName || 'ring-border'}`}>
          <Input
            className="border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            value={title}
          />
          {note.noteType === 'text' ? (
            <Textarea
              className="mt-1 min-h-24 resize-none border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Take a note…"
              value={body}
            />
          ) : (
            <div className="mt-2 space-y-1.5">
              {items.map((item, index) => (
                <div className="flex items-center gap-2" key={item.id ?? index}>
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) =>
                      setItems((previous) =>
                        previous.map((it, i) =>
                          i === index
                            ? { ...it, checked: checked === true }
                            : it,
                        ),
                      )
                    }
                  />
                  <Input
                    className="h-8 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
                    onChange={(event) =>
                      setItems((previous) =>
                        previous.map((it, i) =>
                          i === index
                            ? { ...it, text: event.target.value }
                            : it,
                        ),
                      )
                    }
                    value={item.text}
                  />
                  <button
                    aria-label="Remove item"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setItems((previous) =>
                        previous.filter((_, i) => i !== index),
                      )
                    }
                    type="button"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Plus aria-hidden className="size-4 text-muted-foreground" />
                <Input
                  className="h-8 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
                  onChange={(event) => setNewItemText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addItemFromInput();
                    }
                  }}
                  placeholder="List item"
                  value={newItemText}
                />
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <ColorSwatchPicker onChange={setColor} value={color} />
            <Button onClick={closeEditor} size="sm" type="button">
              Close
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="group mb-4 break-inside-avoid">
      <Card
        className={`cursor-text p-3 ring-1 sm:p-3 ${cardClassName || 'ring-border'}`}
        onClick={openEditor}
      >
        {note.title ? (
          <p className="truncate text-sm font-semibold text-foreground">
            {note.title}
          </p>
        ) : null}
        {note.noteType === 'text' ? (
          note.body ? (
            <p className="mt-1 line-clamp-6 text-sm whitespace-pre-wrap text-muted-foreground">
              {note.body}
            </p>
          ) : null
        ) : (
          <ChecklistPreview
            items={note.items}
            noteId={note.id}
            onToggleChecklistItem={onToggleChecklistItem}
          />
        )}

        <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePinned(note.id, !note.pinned);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            {note.pinned ? (
              <PinOff aria-hidden className="size-4" />
            ) : (
              <Pin aria-hidden className="size-4" />
            )}
          </Button>
          <div onClick={(event) => event.stopPropagation()}>
            <ColorSwatchPicker
              onChange={(next) =>
                onUpdate(note.id, {
                  title: note.title,
                  body: note.body,
                  color: next,
                })
              }
              value={note.color}
            />
          </div>
          <Button
            aria-label={note.archived ? 'Unarchive note' : 'Archive note'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleArchived(note.id, !note.archived);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            {note.archived ? (
              <ArchiveRestore aria-hidden className="size-4" />
            ) : (
              <Archive aria-hidden className="size-4" />
            )}
          </Button>
          <Button
            aria-label="Delete note"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm('Delete this note? This cannot be undone.')) {
                onDelete(note.id);
              }
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ChecklistPreview({
  items,
  noteId,
  onToggleChecklistItem,
}: {
  items: NoteChecklistItem[];
  noteId: string;
  onToggleChecklistItem: (
    noteId: string,
    itemId: string,
    checked: boolean,
  ) => void;
}) {
  const visible = items.slice(0, 6);
  const remaining = items.length - visible.length;

  return (
    <div className="mt-1.5 space-y-1">
      {visible.map((item) => (
        <label
          className="flex items-start gap-2 text-sm"
          key={item.id}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={item.checked}
            onCheckedChange={(checked) =>
              onToggleChecklistItem(noteId, item.id, checked === true)
            }
          />
          <span
            className={
              item.checked
                ? 'text-muted-foreground line-through'
                : 'text-foreground'
            }
          >
            {item.text}
          </span>
        </label>
      ))}
      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">+{remaining} more</p>
      ) : null}
    </div>
  );
}
