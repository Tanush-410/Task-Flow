import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('local Supabase configuration', () => {
  it('uses a Docker-DNS-safe project id', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'supabase/config.toml'),
      'utf8',
    );

    expect(config).toMatch(/^project_id = "taskmanager"$/m);
  });

  it('seeds profiles with the required connect code', () => {
    const seed = readFileSync(
      resolve(process.cwd(), 'supabase/seed.sql'),
      'utf8',
    );
    const profileColumns = seed.match(
      /insert into public\.profiles\s*\(([\s\S]*?)\)\s*values/i,
    )?.[1];

    expect(profileColumns).toBeDefined();
    expect(profileColumns).toMatch(/\bconnect_code\b/i);
  });
});
