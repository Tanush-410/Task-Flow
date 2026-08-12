import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('bug work item type migration', () => {
  const enumMigration = read(
    'supabase/migrations/202608130001_bug_work_item_type_enum.sql',
  );
  const migration = read(
    'supabase/migrations/202608130002_bug_work_item_type.sql',
  );
  const types = read('src/lib/supabase/database.types.ts');

  it('adds the enum value in its own migration, before anything references it', () => {
    expect(enumMigration).toMatch(
      /alter type public\.work_item_type add value 'bug'/,
    );
  });

  it('gates the three bug-only columns behind a type-aware check constraint', () => {
    expect(migration).toMatch(
      /add constraint tasks_bug_fields_require_bug_type_check/,
    );
    expect(migration).toMatch(/work_item_type = 'bug'/);
  });

  it('replaces the hierarchy trigger with security definer and a fixed search path', () => {
    expect(migration).toMatch(
      /function public\.validate_work_item_hierarchy\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
    );
    expect(migration).toMatch(/'user_story', 'bug'/);
  });

  it('drops the old create_work_item signature before recreating it with the bug params', () => {
    expect(migration).toMatch(
      /drop function public\.create_work_item\(\s*uuid, public\.work_item_type, text, text, public\.task_priority, uuid, numeric, numeric, numeric\s*\);/,
    );
    expect(migration).toMatch(
      /function public\.create_work_item\([\s\S]*?security definer[\s\S]*?set search_path = ''/,
    );
    expect(migration).toMatch(/item_repro_steps text default null/);
    expect(migration).toMatch(
      /item_severity public\.task_priority default null/,
    );
    expect(migration).toMatch(/item_found_in_build text default null/);
  });

  it('grants the three bug-detail columns directly, with no new RPC needed', () => {
    expect(migration).toMatch(/grant update \(repro_steps\) on public\.tasks/);
    expect(migration).toMatch(/grant update \(severity\) on public\.tasks/);
    expect(migration).toMatch(
      /grant update \(found_in_build\) on public\.tasks/,
    );
  });

  it('tracks the bug work item type in generated types', () => {
    expect(types).toMatch(
      /work_item_type:\s*'epic'\s*\|\s*'feature'\s*\|\s*'user_story'\s*\|\s*'task'\s*\|\s*'bug'/,
    );
    expect(types).toContain('repro_steps');
    expect(types).toContain('severity');
    expect(types).toContain('found_in_build');
    expect(types).toContain('item_repro_steps');
    expect(types).toContain('item_severity');
    expect(types).toContain('item_found_in_build');
  });
});
