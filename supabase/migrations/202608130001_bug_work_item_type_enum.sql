-- Split into its own migration file (its own transaction): using a
-- brand-new enum label in the same transaction that adds it -- e.g. inside
-- a CHECK constraint or trigger body, both needed by the next migration --
-- raises "unsafe use of new value of enum type" until the ADD VALUE has
-- committed as an earlier, separate transaction. See
-- docs/superpowers/plans/2026-08-12-bug-work-item-type.md.
alter type public.work_item_type add value 'bug';
