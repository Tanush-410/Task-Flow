import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

export const noteColorSchema = z.enum([
  'default',
  'coral',
  'peach',
  'sand',
  'sage',
  'fog',
  'storm',
  'dusk',
]);

export const createNoteSchema = z.object({
  noteType: z.enum(['text', 'checklist']),
  title: z.string().trim().max(200).default(''),
  body: z.string().trim().max(20_000).default(''),
  color: noteColorSchema.default('default'),
});

export const updateNoteSchema = z.object({
  id: uuidSchema,
  title: z.string().trim().max(200),
  body: z.string().trim().max(20_000),
  color: noteColorSchema,
});

export const setNotePinnedSchema = z.object({
  id: uuidSchema,
  pinned: z.boolean(),
});

export const setNoteArchivedSchema = z.object({
  id: uuidSchema,
  archived: z.boolean(),
});

export const noteIdSchema = z.object({
  id: uuidSchema,
});

export const setChecklistItemCheckedSchema = z.object({
  itemId: uuidSchema,
  checked: z.boolean(),
});

export const saveChecklistItemsSchema = z.object({
  noteId: uuidSchema,
  items: z
    .array(
      z.object({
        text: z.string().trim().max(500),
        checked: z.boolean(),
      }),
    )
    .max(200),
});
