import { z } from 'zod';

const assignmentStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'delayed',
  'completed',
]);

export const assignmentCreateSchema = z.object({
  taskId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  assignedBy: z.string().uuid(),
});

export const assignmentProgressSchema = z.object({
  assignmentId: z.string().uuid(),
  progress: z.union([
    z.literal(0),
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(100),
  ]),
});

export const assignmentStatusChangeSchema = z.object({
  assignmentId: z.string().uuid(),
  status: assignmentStatusSchema,
  reason: z.string().trim().min(1).max(2_000).optional(),
});

export const assignmentReopenSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2_000),
  progress: z
    .union([z.literal(0), z.literal(25), z.literal(50), z.literal(75)])
    .default(75),
});

export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentProgressInput = z.infer<typeof assignmentProgressSchema>;
export type AssignmentStatusChangeInput = z.infer<
  typeof assignmentStatusChangeSchema
>;
export type AssignmentReopenInput = z.infer<typeof assignmentReopenSchema>;
