import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const sprintNameSchema = z.string().trim().min(1).max(100);
const sprintStatusSchema = z.enum(['planned', 'active', 'completed']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const sprintFields = {
  name: sprintNameSchema,
  startDate: dateSchema,
  endDate: dateSchema,
};

function endsAfterStart(value: { startDate: string; endDate: string }) {
  return value.endDate >= value.startDate;
}

export const sprintCreateSchema = z
  .object({
    planningTeamId: uuidSchema,
    ...sprintFields,
  })
  .refine(endsAfterStart, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const sprintUpdateSchema = z
  .object({
    sprintId: uuidSchema,
    ...sprintFields,
  })
  .refine(endsAfterStart, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const sprintStatusUpdateSchema = z.object({
  sprintId: uuidSchema,
  status: sprintStatusSchema,
});

export const sprintDeleteSchema = z.object({
  sprintId: uuidSchema,
});

export type SprintStatus = z.infer<typeof sprintStatusSchema>;
export type SprintCreateInput = z.infer<typeof sprintCreateSchema>;
export type SprintUpdateInput = z.infer<typeof sprintUpdateSchema>;
export type SprintStatusUpdateInput = z.infer<typeof sprintStatusUpdateSchema>;
