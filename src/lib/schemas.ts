import { z } from 'zod';

/**
 * Postgres's `uuid` column type accepts any 8-4-4-4-12 hex string; it does
 * not enforce the RFC 4122 version/variant nibbles that zod's built-in
 * `z.string().uuid()` requires. That stricter check rejects otherwise valid
 * ids that don't follow that convention — notably every id in
 * supabase/seed.sql (e.g. `00000000-0000-0000-0000-000000000002`). Every
 * schema in this app validates ids that may transitively reference seeded
 * rows, so this is used in place of `z.string().uuid()` everywhere. Referential
 * validity (does the row actually exist, is it visible to this caller) is
 * still enforced by RLS and the query/RPC layer regardless.
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid id',
  );
