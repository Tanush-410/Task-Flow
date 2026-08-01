# Foundation and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the production-shaped Next.js and Supabase foundation with tested organization-scoped identity, invitation, authorization, application-shell, feature-flag, and observability behavior.

**Architecture:** A Next.js App Router application uses Supabase Auth and PostgreSQL. Proxy refreshes sessions but server layouts/actions perform authorization; row-level security remains the final data boundary. Domain modules own validation and operations, while shared adapters own Supabase, telemetry, and feature-flag access.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, Zod, Vitest, Testing Library, Playwright, ESLint, Prettier, Husky, lint-staged, npm.

---

## Planned file map

```text
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/invite/[token]/page.tsx
│   ├── (app)/layout.tsx
│   ├── (app)/dashboard/page.tsx
│   ├── (app)/my-day/page.tsx
│   ├── auth/callback/route.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── app-shell.tsx
│   ├── button.tsx
│   ├── field.tsx
│   └── login-form.tsx
├── lib/
│   ├── env.ts
│   ├── result.ts
│   ├── telemetry.ts
│   └── supabase/{browser,proxy,server}.ts
├── modules/
│   ├── auth/{actions,schemas}.ts
│   ├── organizations/{actions,queries,schemas}.ts
│   ├── members/{actions,queries,schemas}.ts
│   └── operations/feature-flags.ts
└── proxy.ts
supabase/
├── config.toml
├── migrations/202608010001_foundation.sql
├── seed.sql
└── tests/foundation_rls.test.sql
tests/
├── setup.ts
├── unit/{auth-schemas,organization-schemas,feature-flags}.test.ts
└── e2e/{auth,authorization}.spec.ts
```

### Task 1: Scaffold the application and quality toolchain

**Files:**
- Create: Next.js scaffold at repository root
- Modify: `package.json`
- Create: `.prettierrc.json`
- Create: `.lintstagedrc.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Scaffold Next.js with strict defaults**

Run:

```bash
npx create-next-app@latest . --ts --eslint --tailwind --app --src-dir --import-alias '@/*' --use-npm
```

Expected: the command creates the App Router scaffold without replacing `docs/` or `.git/`.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```bash
npm install @supabase/ssr @supabase/supabase-js zod clsx tailwind-merge lucide-react sonner
npm install --save-dev vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test prettier husky lint-staged
```

Expected: npm exits 0 and records one lockfile.

- [ ] **Step 3: Add deterministic scripts and staged checks**

Set these `package.json` fields:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:start": "npx supabase start",
    "db:reset": "npx supabase db reset --local",
    "db:test": "npx supabase test db",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm test && npm run build",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css,sql}": ["prettier --write"]
  }
}
```

Create `.prettierrc.json`:

```json
{"semi": true, "singleQuote": true, "trailingComma": "all"}
```

Create `.lintstagedrc.json`:

```json
{"*.{ts,tsx}": ["eslint --fix", "prettier --write"], "*.{json,md,css,sql}": ["prettier --write"]}
```

- [ ] **Step 4: Configure unit and browser tests**

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], coverage: { reporter: ['text', 'html'] } },
});
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

- [ ] **Step 5: Verify and commit the scaffold**

Run:

```bash
npm run lint
npm run typecheck
npm test
```

Expected: lint and typecheck pass; Vitest exits 0 with no failing tests.

Commit:

```bash
git add .
git commit -m "chore: scaffold task management application"
```

### Task 2: Add typed environment and result boundaries

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/result.ts`
- Test: `tests/unit/env.test.ts`

- [ ] **Step 1: Write failing environment tests**

Create `tests/unit/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from '@/lib/env';

describe('parsePublicEnv', () => {
  it('accepts valid Supabase browser configuration', () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key' })).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key',
    });
  });

  it('rejects an invalid URL', () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'bad', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx vitest run tests/unit/env.test.ts`

Expected: FAIL because `@/lib/env` does not exist.

- [ ] **Step 3: Implement the boundary types**

Create `src/lib/env.ts`:

```ts
import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export const parsePublicEnv = (value: unknown): PublicEnv => publicEnvSchema.parse(value);
export const publicEnv = () => parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
```

Create `src/lib/result.ts`:

```ts
export type ActionError = { code: string; message: string; traceId: string; fields?: Record<string, string[]> };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
```

- [ ] **Step 4: Run and commit**

Run: `npx vitest run tests/unit/env.test.ts && npm run typecheck`

Expected: 2 tests pass and TypeScript exits 0.

```bash
git add src/lib tests/unit/env.test.ts
git commit -m "feat: add typed application boundaries"
```

### Task 3: Create the organization identity schema and RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608010001_foundation.sql`
- Create: `supabase/tests/foundation_rls.test.sql`

- [ ] **Step 1: Initialize Supabase locally**

Run: `npx supabase init`

Expected: `supabase/config.toml` exists and contains no secrets.

- [ ] **Step 2: Write the failing RLS contract**

Create `supabase/tests/foundation_rls.test.sql`:

```sql
begin;
select plan(4);
select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_memberships', 'memberships exists');
select policies_are('public', 'organizations', array['members_view_organization', 'admins_update_organization']);
select policies_are('public', 'organization_memberships', array['members_view_memberships', 'admins_manage_memberships']);
select * from finish();
rollback;
```

- [ ] **Step 3: Run the database test and verify failure**

Run: `npm run db:start && npm run db:test`

Expected: FAIL because the foundation tables are absent.

- [ ] **Step 4: Implement schema, helpers, bootstrap transaction, and policies**

Create `supabase/migrations/202608010001_foundation.sql`:

```sql
create extension if not exists pgcrypto;
create type public.membership_role as enum ('admin', 'employee');
create type public.membership_status as enum ('active', 'deactivated');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'Asia/Kolkata',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.membership_role not null,
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  owner text not null,
  review_on date not null,
  unique nulls not distinct (organization_id, key)
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id = target_organization_id and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_admin(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id = target_organization_id and m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active');
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.feature_flags enable row level security;

create policy profiles_view_self_or_coworker on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.organization_memberships mine join public.organization_memberships theirs using (organization_id)
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = profiles.id and theirs.status = 'active'
  )
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy members_view_organization on public.organizations for select using (public.is_active_member(id));
create policy admins_update_organization on public.organizations for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy members_view_memberships on public.organization_memberships for select using (public.is_active_member(organization_id));
create policy admins_manage_memberships on public.organization_memberships for all using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
create policy admins_manage_invitations on public.invitations for all using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
create policy members_view_flags on public.feature_flags for select using (organization_id is null or public.is_active_member(organization_id));
create policy admins_manage_flags on public.feature_flags for all using (organization_id is not null and public.is_admin(organization_id)) with check (organization_id is not null and public.is_admin(organization_id));
```

- [ ] **Step 5: Reset, test, generate types, and commit**

Run:

```bash
npm run db:reset
npm run db:test
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Expected: reset succeeds; 4 pgTAP assertions pass; generated types include `organizations`.

```bash
git add supabase src/lib/supabase/database.types.ts
git commit -m "feat: add organization identity schema"
```

### Task 4: Add SSR clients, session refresh, and authenticated context

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Create: `src/modules/members/queries.ts`
- Test: `tests/unit/membership-query.test.ts`

- [ ] **Step 1: Write the membership-result test**

Create `tests/unit/membership-query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { requireSingleMembership } from '@/modules/members/queries';

describe('requireSingleMembership', () => {
  it('returns the only active membership', () => {
    const membership = { organizationId: 'org', userId: 'user', role: 'admin' as const };
    expect(requireSingleMembership([membership])).toEqual(membership);
  });
  it('rejects missing membership', () => expect(() => requireSingleMembership([])).toThrow('ACTIVE_MEMBERSHIP_REQUIRED'));
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/membership-query.test.ts`

Expected: FAIL because the query module is absent.

- [ ] **Step 3: Implement Supabase client factories**

Create `src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

export const createBrowserSupabase = () => {
  const env = publicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
};
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

export async function createServerSupabase() {
  const store = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
    },
  });
}
```

Create `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getClaims();
  return response;
}
```

Create `src/proxy.ts`:

```ts
import type { NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/proxy';

export const proxy = (request: NextRequest) => refreshSession(request);
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

- [ ] **Step 4: Implement the membership boundary**

Create `src/modules/members/queries.ts`:

```ts
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export type MembershipContext = { organizationId: string; userId: string; role: 'admin' | 'employee' };
export function requireSingleMembership(items: MembershipContext[]): MembershipContext {
  if (items.length !== 1) throw new Error('ACTIVE_MEMBERSHIP_REQUIRED');
  return items[0];
}
export async function requireMembership(): Promise<MembershipContext> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect('/login');
  const { data, error } = await supabase.from('organization_memberships').select('organization_id,user_id,role').eq('user_id', userId).eq('status', 'active');
  if (error || !data) redirect('/login');
  return requireSingleMembership(data.map((item) => ({ organizationId: item.organization_id, userId: item.user_id, role: item.role })));
}
export async function requireAdmin() {
  const membership = await requireMembership();
  if (membership.role !== 'admin') redirect('/my-day');
  return membership;
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/unit/membership-query.test.ts && npm run typecheck`

Expected: 2 tests pass and typecheck succeeds.

```bash
git add src tests/unit/membership-query.test.ts
git commit -m "feat: add authenticated membership context"
```

### Task 5: Implement login, callback, and role-aware application shell

**Files:**
- Create: `src/modules/auth/schemas.ts`
- Create: `src/modules/auth/actions.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/components/login-form.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/my-day/page.tsx`
- Test: `tests/unit/auth-schemas.test.ts`

- [ ] **Step 1: Write the failing login-schema test**

Create `tests/unit/auth-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/modules/auth/schemas';

describe('loginSchema', () => {
  it('normalizes a valid email', () => expect(loginSchema.parse({ email: ' ADMIN@EXAMPLE.COM ', password: 'password123' }).email).toBe('admin@example.com'));
  it('rejects short passwords', () => expect(loginSchema.safeParse({ email: 'a@example.com', password: 'short' }).success).toBe(false));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/unit/auth-schemas.test.ts`

Expected: FAIL because the auth schema is absent.

- [ ] **Step 3: Implement schema and action**

Create `src/modules/auth/schemas.ts`:

```ts
import { z } from 'zod';
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(128) });
```

Create `src/modules/auth/actions.ts`:

```ts
'use server';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/result';
import { loginSchema } from './schemas';

export async function login(_: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: { code: 'INVALID_LOGIN', message: 'Enter a valid email and password.', traceId, fields: parsed.error.flatten().fieldErrors } };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: { code: 'INVALID_LOGIN', message: 'Email or password is incorrect.', traceId } };
  redirect('/dashboard');
}
```

- [ ] **Step 4: Implement callback, login page, and shell**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) await (await createServerSupabase()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

Create `src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from '@/components/login-form';
export default function LoginPage() {
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><LoginForm /></main>;
}
```

Create `src/components/login-form.tsx`:

```tsx
'use client';
import { useActionState } from 'react';
import { login } from '@/modules/auth/actions';
export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return <form action={action} className="w-full space-y-4"><h1 className="text-3xl font-semibold">Welcome back</h1><label className="block">Email<input className="mt-1 w-full rounded-lg border p-3" name="email" type="email" required /></label><label className="block">Password<input className="mt-1 w-full rounded-lg border p-3" name="password" type="password" minLength={8} required /></label>{state && !state.ok ? <p role="alert" className="text-sm text-red-700">{state.error.message} Reference: {state.error.traceId}</p> : null}<button className="w-full rounded-lg bg-slate-950 p-3 text-white" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form>;
}
```

Create `src/components/app-shell.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
export function AppShell({ role, children }: { role: 'admin' | 'employee'; children: ReactNode }) {
  const items = role === 'admin' ? [['Dashboard', '/dashboard'], ['All Tasks', '/tasks'], ['Employees', '/employees'], ['Reports', '/reports']] : [['My Day', '/my-day'], ['My Tasks', '/my-tasks']];
  return <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[240px_1fr]"><aside className="border-r bg-white p-6"><Link href={role === 'admin' ? '/dashboard' : '/my-day'} className="text-xl font-semibold">TaskFlow</Link><nav className="mt-8 grid gap-2">{items.map(([label, href]) => <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href={href} key={href}>{label}</Link>)}</nav></aside><main className="p-5 md:p-8">{children}</main></div>;
}
```

Create `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { requireMembership } from '@/modules/members/queries';
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();
  return <AppShell role={membership.role}>{children}</AppShell>;
}
```

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
import { requireAdmin } from '@/modules/members/queries';
export default async function DashboardPage() {
  await requireAdmin();
  return <section><h1 className="text-3xl font-semibold">Dashboard</h1><p className="mt-2 text-slate-600">Organization work will appear here.</p></section>;
}
```

Create `src/app/(app)/my-day/page.tsx`:

```tsx
import { requireMembership } from '@/modules/members/queries';
export default async function MyDayPage() {
  await requireMembership();
  return <section><h1 className="text-3xl font-semibold">My Day</h1><p className="mt-2 text-slate-600">Your focused work will appear here.</p></section>;
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/unit/auth-schemas.test.ts && npm run typecheck && npm run build`

Expected: 2 tests pass; typecheck and build succeed.

```bash
git add src tests/unit/auth-schemas.test.ts
git commit -m "feat: add secure login and application shell"
```

### Task 6: Add organization bootstrap and invitation contracts

**Files:**
- Create: `src/modules/organizations/schemas.ts`
- Create: `src/modules/organizations/actions.ts`
- Create: `src/modules/members/schemas.ts`
- Create: `src/modules/members/actions.ts`
- Create: `supabase/migrations/202608010002_identity_functions.sql`
- Test: `tests/unit/organization-schemas.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `tests/unit/organization-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { organizationSchema } from '@/modules/organizations/schemas';
import { invitationSchema } from '@/modules/members/schemas';
describe('identity schemas', () => {
  it('accepts an IANA timezone', () => expect(organizationSchema.parse({ name: 'Acme', timezone: 'Asia/Kolkata' }).name).toBe('Acme'));
  it('rejects an invalid invitation role', () => expect(invitationSchema.safeParse({ email: 'e@example.com', role: 'owner' }).success).toBe(false));
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/organization-schemas.test.ts`

Expected: FAIL because both schema modules are absent.

- [ ] **Step 3: Implement validation**

Create `src/modules/organizations/schemas.ts`:

```ts
import { z } from 'zod';
export const organizationSchema = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().refine((value) => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid timezone') });
```

Create `src/modules/members/schemas.ts`:

```ts
import { z } from 'zod';
export const invitationSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['admin', 'employee']) });
```

- [ ] **Step 4: Add transactional SQL functions**

Create `supabase/migrations/202608010002_identity_functions.sql`:

```sql
create or replace function public.bootstrap_organization(organization_name text, organization_timezone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.organization_memberships where user_id = auth.uid() and status = 'active') then raise exception 'MEMBERSHIP_EXISTS'; end if;
  insert into public.organizations(name, timezone, created_by) values (organization_name, organization_timezone, auth.uid()) returning id into new_id;
  insert into public.organization_memberships(organization_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end;
$$;
grant execute on function public.bootstrap_organization(text, text) to authenticated;
```

- [ ] **Step 5: Implement organization and invitation actions**

Create `src/modules/organizations/actions.ts`:

```ts
'use server';
import { randomUUID } from 'node:crypto';
import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { organizationSchema } from './schemas';
export async function createOrganization(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  const traceId = randomUUID();
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'INVALID_ORGANIZATION', message: 'Check the organization details.', traceId, fields: parsed.error.flatten().fieldErrors } };
  const { data, error } = await (await createServerSupabase()).rpc('bootstrap_organization', { organization_name: parsed.data.name, organization_timezone: parsed.data.timezone });
  return error || !data ? { ok: false, error: { code: 'ORGANIZATION_CREATE_FAILED', message: 'The organization could not be created.', traceId } } : { ok: true, data: { organizationId: data } };
}
```

Create `src/modules/members/actions.ts`:

```ts
'use server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAdmin } from './queries';
import { invitationSchema } from './schemas';
export async function inviteMember(input: unknown): Promise<ActionResult<{ token: string }>> {
  const traceId = randomUUID();
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'INVALID_INVITATION', message: 'Check the invitation details.', traceId, fields: parsed.error.flatten().fieldErrors } };
  const admin = await requireAdmin();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { error } = await (await createServerSupabase()).from('invitations').insert({ organization_id: admin.organizationId, email: parsed.data.email, role: parsed.data.role, token_hash: tokenHash, invited_by: admin.userId, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  return error ? { ok: false, error: { code: 'INVITATION_CREATE_FAILED', message: 'The invitation could not be created.', traceId } } : { ok: true, data: { token } };
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run db:reset && npx vitest run tests/unit/organization-schemas.test.ts && npm run typecheck`

Expected: database reset succeeds; 2 tests pass; typecheck succeeds.

```bash
git add src/modules supabase/migrations tests/unit/organization-schemas.test.ts
git commit -m "feat: add organization and invitation contracts"
```

### Task 7: Add feature flags and privacy-safe telemetry

**Files:**
- Create: `src/modules/operations/feature-flags.ts`
- Create: `src/lib/telemetry.ts`
- Test: `tests/unit/feature-flags.test.ts`

- [ ] **Step 1: Write failing deterministic-rollout tests**

Create `tests/unit/feature-flags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isInRollout } from '@/modules/operations/feature-flags';
describe('isInRollout', () => {
  it('includes everyone at 100 percent', () => expect(isInRollout('user', 'reports', 100)).toBe(true));
  it('excludes everyone at 0 percent', () => expect(isInRollout('user', 'reports', 0)).toBe(false));
  it('is deterministic', () => expect(isInRollout('user', 'reports', 50)).toBe(isInRollout('user', 'reports', 50)));
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/feature-flags.test.ts`

Expected: FAIL because the feature-flag module is absent.

- [ ] **Step 3: Implement rollout and telemetry contracts**

Create `src/modules/operations/feature-flags.ts`:

```ts
import { createHash } from 'node:crypto';
export function isInRollout(userId: string, key: string, percentage: number) {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  const bucket = Number.parseInt(createHash('sha256').update(`${key}:${userId}`).digest('hex').slice(0, 8), 16) % 100;
  return bucket < percentage;
}
```

Create `src/lib/telemetry.ts`:

```ts
type SafeContext = Record<string, string | number | boolean | null>;
export function recordError(error: unknown, traceId: string, context: SafeContext = {}) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(JSON.stringify({ level: 'error', traceId, message, context, timestamp: new Date().toISOString() }));
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run tests/unit/feature-flags.test.ts && npm run typecheck`

Expected: 3 tests pass and typecheck succeeds.

```bash
git add src/lib/telemetry.ts src/modules/operations tests/unit/feature-flags.test.ts
git commit -m "feat: add feature rollout and telemetry boundaries"
```

### Task 8: Add deterministic demo data and authorization acceptance tests

**Files:**
- Create: `supabase/seed.sql`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/authorization.spec.ts`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add deterministic local identities and organization seed**

Create `supabase/seed.sql`:

```sql
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', crypt('Password123!', gen_salt('bf')), now(), '{"display_name":"Asha Admin"}', now(), now()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employee@example.test', crypt('Password123!', gen_salt('bf')), now(), '{"display_name":"Eshan Employee"}', now(), now());

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@example.test"}', 'email', now(), now(), now()),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '{"sub":"00000000-0000-0000-0000-000000000002","email":"employee@example.test"}', 'email', now(), now(), now());

insert into public.organizations(id, name, timezone, created_by)
values ('10000000-0000-0000-0000-000000000001', 'Demo Organization', 'Asia/Kolkata', '00000000-0000-0000-0000-000000000001');

insert into public.organization_memberships(organization_id, user_id, role) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'employee');
```

- [ ] **Step 2: Add browser acceptance tests**

Create `tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
test('admin signs in and reaches the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.test');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
});
```

Create `tests/e2e/authorization.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
test('employee navigation omits admin destinations', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('employee@example.test');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My Tasks' })).toBeVisible();
});
```

- [ ] **Step 3: Add CI release-gate workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 4: Run the Phase 0 release gate**

Run:

```bash
npm run db:reset
npm run db:test
npm run verify
npx playwright test tests/e2e/auth.spec.ts tests/e2e/authorization.spec.ts
```

Expected: migrations and seed apply; database tests pass; format, lint, types, unit tests, and build pass; both desktop and mobile Playwright projects pass the login and authorization flows.

- [ ] **Step 5: Commit the completed foundation**

```bash
git add supabase/seed.sql tests/e2e .github/workflows/ci.yml
git commit -m "test: enforce foundation release gate"
```

### Task 9: Phase 0 review checkpoint

**Files:**
- Modify: `README.md`
- Create: `docs/operations/local-development.md`
- Create: `docs/operations/phase-0-release.md`

- [ ] **Step 1: Document the verified local workflow**

Create `docs/operations/local-development.md` with these exact commands and safety notes:

```markdown
# Local development

1. Copy `.env.example` to `.env.local` and use values printed by `npx supabase status`.
2. Start Docker, then run `npm run db:start`.
3. Rebuild local data with `npm run db:reset`. This targets the local database only.
4. Start the app with `npm run dev`.
5. Sign in as `admin@example.test` or `employee@example.test` with `Password123!`.

Never run `supabase db reset --linked` against production. Never commit service-role keys.
```

- [ ] **Step 2: Record the release evidence template**

Create `docs/operations/phase-0-release.md`:

```markdown
# Phase 0 release evidence

- Release owner: Product Owner and Technical Owner
- Required checks: database reset, pgTAP, formatting, lint, types, unit tests, production build, desktop/mobile auth smoke tests
- Defect threshold: zero blocker or critical defects; zero high-severity authorization, isolation, data-loss, or destructive-migration defects
- Rollback: disable newly introduced flags, redeploy the prior verified build, and use the recorded database restore point if forward recovery is unsafe
- Approval evidence: link the CI run, migration review, auth/RLS test results, alert test, and staging restore exercise
```

- [ ] **Step 3: Run final verification**

Run: `npm run verify && git diff --check && git status --short`

Expected: verification exits 0; diff check is clean; only the intended documentation changes are unstaged.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/operations
git commit -m "docs: add foundation operations guide"
```

At this checkpoint, review the implemented interfaces against the approved specification and write the Core Task Workflow plan using the actual generated database types and application structure.
