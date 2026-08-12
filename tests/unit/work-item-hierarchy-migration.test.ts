import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('work item hierarchy migration', () => {
  const migration = read(
    'supabase/migrations/202608120001_work_item_hierarchy_and_backlog.sql',
  );
  const types = read('src/lib/supabase/database.types.ts');

  it('protects every new RPC with security definer and a fixed search path', () => {
    for (const fn of [
      'validate_work_item_hierarchy',
      'is_task_planning_team_member',
      'backlog_rank_midpoint',
      'create_work_item',
      'assign_backlog_rank',
      'rebalance_backlog_siblings',
      'count_work_item_descendants',
      'move_work_item',
      'reestimate_work_item_hours',
    ]) {
      const pattern = new RegExp(
        `function public\\.${fn}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      );
      expect(migration).toMatch(pattern);
    }
  });

  it('never grants the five structurally sensitive columns to authenticated', () => {
    for (const column of [
      'work_item_type',
      'parent_task_id',
      'planning_team_id',
      'backlog_rank',
      'original_hours',
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`grant (insert|update) \\([^)]*\\b${column}\\b[^)]*\\)`),
      );
    }
  });

  it('grants only story_points and remaining_hours as directly writable', () => {
    expect(migration).toMatch(/grant update \(story_points\) on public\.tasks/);
    expect(migration).toMatch(
      /grant update \(remaining_hours\) on public\.tasks/,
    );
  });

  it('extends tasks/task_activity_events RLS additively', () => {
    expect(migration).toMatch(
      /create policy tasks_select_planning_team_member/,
    );
    expect(migration).toMatch(
      /create policy tasks_update_planning_team_member/,
    );
    expect(migration).toMatch(
      /create policy task_activity_view_planning_team_member/,
    );
    expect(migration).not.toMatch(/drop policy.*tasks_view_participants/);
  });

  it('tracks the work item hierarchy schema in generated types', () => {
    expect(types).toMatch(
      /work_item_type:\s*'epic'\s*\|\s*'feature'\s*\|\s*'user_story'\s*\|\s*'task'/,
    );
    expect(types).toContain('parent_task_id');
    expect(types).toContain('planning_team_id');
    expect(types).toContain('backlog_rank');
    expect(types).toContain('create_work_item');
    expect(types).toContain('move_work_item');
    expect(types).toContain('assign_backlog_rank');
    expect(types).toContain('reestimate_work_item_hours');
  });
});
