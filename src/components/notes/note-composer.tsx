'use client';

import { ListChecks, Plus, Type, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { ColorSwatchPicker } from './color-swatch-picker';
import { noteCardClassName } from './note-colors';

type EditableItem = { text: string; checked: boolean };

export function NoteComposer({
  onCreate,
}: {
  onCreate: (input: {
    noteType: 'text' | 'checklist';
    title: string;
    body: string;
    color: string;
    items: EditableItem[];
  }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteType, setNoteType] = useState<'text' | 'checklist'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState('default');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  function reset() {
    setExpanded(false);
    setNoteType('text');
    setTitle('');
    setBody('');
    setColor('default');
    setItems([]);
    setNewItemText('');
  }

  function handleClose() {
    const finalItems = [...items];
    if (newItemText.trim().length > 0) {
      finalItems.push({ text: newItemText.trim(), checked: false });
    }
    const hasContent =
      title.trim().length > 0 ||
      body.trim().length > 0 ||
      finalItems.some((item) => item.text.length > 0);

    if (hasContent) {
      onCreate({
        noteType,
        title: title.trim(),
        body: body.trim(),
        color,
        items: finalItems,
      });
    }
    reset();
  }

  function addItemFromInput() {
    const text = newItemText.trim();
    if (text.length === 0) return;
    setItems((previous) => [...previous, { text, checked: false }]);
    setNewItemText('');
  }

  if (!expanded) {
    return (
      <Card
        className="cursor-text p-3 ring-1 ring-border sm:p-3"
        onClick={() => setExpanded(true)}
      >
        <p className="text-sm text-muted-foreground">Take a note…</p>
      </Card>
    );
  }

  return (
    <div
      className={`rounded-xl ring-1 ${noteCardClassName(color) || 'ring-border'}`}
    >
      <Card className={`p-3 ring-0 sm:p-3 ${noteCardClassName(color)}`}>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            className="flex-1 border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            value={title}
          />
          <Button
            aria-label={
              noteType === 'text' ? 'Switch to checklist' : 'Switch to text'
            }
            onClick={() =>
              setNoteType((previous) =>
                previous === 'text' ? 'checklist' : 'text',
              )
            }
            size="icon"
            type="button"
            variant="ghost"
          >
            {noteType === 'text' ? (
              <ListChecks aria-hidden className="size-4" />
            ) : (
              <Type aria-hidden className="size-4" />
            )}
          </Button>
        </div>

        {noteType === 'text' ? (
          <Textarea
            className="mt-1 min-h-20 resize-none border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
            onChange={(event) => setBody(event.target.value)}
            placeholder="Take a note…"
            value={body}
          />
        ) : (
          <div className="mt-2 space-y-1.5">
            {items.map((item, index) => (
              <div className="flex items-center gap-2" key={index}>
                <span className="size-4 shrink-0 rounded-[4px] border border-input" />
                <Input
                  className="h-8 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
                  onChange={(event) =>
                    setItems((previous) =>
                      previous.map((it, i) =>
                        i === index ? { ...it, text: event.target.value } : it,
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
          <Button onClick={handleClose} size="sm" type="button">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
