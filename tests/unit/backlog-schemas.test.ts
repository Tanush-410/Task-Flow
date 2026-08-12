import { describe, expect, it } from 'vitest';

import {
  moveWorkItemSchema,
  rankBacklogItemSchema,
  workItemCreateSchema,
  workItemPlanningFieldsUpdateSchema,
} from '@/modules/backlog/schemas';

const planningTeamId = '10000000-0000-4000-8000-000000000001';
const parentTaskId = '20000000-0000-4000-8000-000000000002';
const taskId = '30000000-0000-4000-8000-000000000003';

describe('workItemCreateSchema', () => {
  it('accepts a story-point-bearing epic with no hours', () => {
    const result = workItemCreateSchema.safeParse({
      planningTeamId,
      type: 'epic',
      title: 'Ship the thing',
      storyPoints: 5,
    });
    expect(result).toMatchObject({
      success: true,
      data: { parentTaskId: null, description: '', priority: 'medium' },
    });
  });

  it('accepts an hour-bearing task with no story points', () => {
    const result = workItemCreateSchema.safeParse({
      planningTeamId,
      parentTaskId,
      type: 'task',
      title: 'Wire up the button',
      originalHours: 4,
      remainingHours: 4,
    });
    expect(result.success).toBe(true);
  });

  it('rejects story points on a task', () => {
    const result = workItemCreateSchema.safeParse({
      planningTeamId,
      type: 'task',
      title: 'Invalid',
      storyPoints: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects hour estimates on a non-task', () => {
    const result = workItemCreateSchema.safeParse({
      planningTeamId,
      type: 'feature',
      parentTaskId,
      title: 'Invalid',
      originalHours: 2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid title and a malformed team id', () => {
    expect(
      workItemCreateSchema.safeParse({
        planningTeamId,
        type: 'epic',
        title: '',
      }).success,
    ).toBe(false);
    expect(
      workItemCreateSchema.safeParse({
        planningTeamId: 'not-a-uuid',
        type: 'epic',
        title: 'Valid title',
      }).success,
    ).toBe(false);
  });
});

describe('workItemPlanningFieldsUpdateSchema', () => {
  it('accepts a single changed field', () => {
    const result = workItemPlanningFieldsUpdateSchema.safeParse({
      taskId,
      title: 'Renamed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty patch', () => {
    const result = workItemPlanningFieldsUpdateSchema.safeParse({ taskId });
    expect(result.success).toBe(false);
  });

  it('requires remainingHours whenever originalHours changes', () => {
    const result = workItemPlanningFieldsUpdateSchema.safeParse({
      taskId,
      originalHours: 8,
    });
    expect(result.success).toBe(false);
  });

  it('accepts originalHours paired with remainingHours', () => {
    const result = workItemPlanningFieldsUpdateSchema.safeParse({
      taskId,
      originalHours: 8,
      remainingHours: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe('moveWorkItemSchema', () => {
  it('defaults includeDescendants to false', () => {
    const result = moveWorkItemSchema.safeParse({
      taskId,
      newParentTaskId: parentTaskId,
      newPlanningTeamId: planningTeamId,
    });
    expect(result).toMatchObject({
      success: true,
      data: { includeDescendants: false },
    });
  });

  it('allows detaching to a top-level position with a null parent', () => {
    const result = moveWorkItemSchema.safeParse({
      taskId,
      newParentTaskId: null,
      newPlanningTeamId: planningTeamId,
      includeDescendants: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed task id', () => {
    const result = moveWorkItemSchema.safeParse({
      taskId: 'invalid',
      newParentTaskId: null,
      newPlanningTeamId: planningTeamId,
    });
    expect(result.success).toBe(false);
  });
});

describe('rankBacklogItemSchema', () => {
  it('defaults both neighbors to null', () => {
    const result = rankBacklogItemSchema.safeParse({ taskId });
    expect(result).toMatchObject({
      success: true,
      data: { beforeTaskId: null, afterTaskId: null },
    });
  });

  it('accepts explicit neighbors', () => {
    const result = rankBacklogItemSchema.safeParse({
      taskId,
      beforeTaskId: parentTaskId,
      afterTaskId: planningTeamId,
    });
    expect(result.success).toBe(true);
  });
});
