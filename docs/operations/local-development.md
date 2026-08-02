# Local development

1. Copy `.env.example` to `.env.local` and use values printed by `npx supabase status`.
2. Start Docker, then run `npm run db:start`.
3. Rebuild local data with `npm run db:reset`. This targets the local database only.
4. Start the app with `npm run dev`.
5. Sign in as `admin@example.test` or `employee@example.test` with `Password123!`.

Never run `supabase db reset --linked` against production. Never commit service-role keys.