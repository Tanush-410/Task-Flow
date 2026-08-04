# TaskFlow

A focused task-management workspace for small teams: admins assign and track
work, employees see exactly what's due, and everyone can switch between a
List, a drag-and-drop Board, or a Google Calendar-style view of who's working
on what. Built with Next.js (App Router) and Supabase, styled with a
black-and-gold shadcn/ui design system.

## Features

- **Role-based workspace** — self-serve signup as an Admin (creates an
  organization) or an Employee (joins one), plus admin-issued email invites.
  Admins create and assign tasks; employees track and update the work
  assigned to them.
- **Tasks & assignments** — create a task, tag one or more people, and track
  each assignee's status independently (Not started → In progress → Delayed
  → Completed, with a required reason whenever something slips). A split
  Create button offers one-click "due today"/"due tomorrow" shortcuts.
- **List, Board, and Calendar views** — the same tasks, three ways: a
  filterable list, a drag-and-drop Kanban board (columns for each status,
  with the delay-reason prompt and dependency checks enforced on drop), and
  a Month/Week/Day calendar with click-to-create and events color-tagged per
  assignee.
- **Notifications** — real-time in-app notifications (Supabase Realtime) the
  moment work is assigned, completed, or delayed.
- **Global search** — press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> anywhere in
  the app to jump straight to a task by title.
- **Filtering, sorting, and reporting** — filter/sort the task list by
  status, priority, and due date; a Reports page ranks employees by
  completion rate and by average turnaround time ("most productive"), with
  CSV export.
- **Current Work** — an admin-only live view of exactly what every employee
  has in progress right now, grouped by person.
- **Dashboard** — at-a-glance counts for active, overdue, delayed, and
  recently completed work, plus the org-wide on-time completion rate.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Server Actions, Server
  Components) on React 19
- [Supabase](https://supabase.com) (Postgres, Auth, Row-Level Security,
  Realtime)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
  (Radix primitives) for the component layer
- [@dnd-kit](https://dndkit.com) for the drag-and-drop Board view
- [Zod](https://zod.dev) for input validation on every server action
- [Vitest](https://vitest.dev) for unit tests, [Playwright](https://playwright.dev)
  for end-to-end tests

## Local development

Follow the verified workflow in
[docs/operations/local-development.md](docs/operations/local-development.md)
before running the app or resetting Supabase locally.

Use Node.js 22.22.1 or newer and npm 11.9.0. With `nvm`, select the
repository-pinned runtime before installing dependencies:

```bash
nvm use
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app. You'll
need a Supabase project (local or hosted) and its credentials in
`.env.local` — see the local-development doc above for the full setup,
including applying `supabase/migrations`.

### Scripts

| Command                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `npm run dev`                   | Start the dev server (Turbopack)               |
| `npm run build`                 | Production build                               |
| `npm run lint`                  | ESLint                                         |
| `npm run format:check`          | Prettier check                                 |
| `npm run typecheck`             | `tsc --noEmit`                                 |
| `npm test`                      | Unit tests (Vitest)                            |
| `npm run test:e2e`              | End-to-end tests (Playwright)                  |
| `npm run verify`                | Format, lint, typecheck, unit tests, and build |
| `npm run db:start` / `db:reset` | Local Supabase via the CLI                     |

Next.js is temporarily pinned to the exact `16.3.0-canary.105` pre-release.
That release is the first available version whose declared PostCSS and sharp
dependencies remove the known high-severity production advisories affecting
the stable release. Replace this pin with the first compatible patched stable
Next.js release after verifying the build, tests, and production audit.

## Project structure

```
src/app/            Routes (App Router), grouped by (auth) and (app) layouts
src/components/     Shared UI — shadcn primitives live in components/ui
src/modules/        Domain logic: queries + server actions per feature area
                     (tasks, assignments, members, notifications, ...)
src/lib/            Cross-cutting helpers (Supabase clients, date utils, ...)
supabase/migrations/ Schema, RLS policies, and triggers, in applied order
docs/operations/    Verified local-dev and release-process notes
```

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
