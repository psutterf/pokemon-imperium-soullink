-- migration-006: scope catch rows per run (fixes abilities bleeding between runs).
--
-- Bug: the `catches` primary key was just `(id)`, where id = "<location_id>:<slot>" with NO run
-- scoping. So two runs that both had a catch on the same route/slot shared ONE database row. A
-- save re-sync upserts every field EXCEPT ability (ability is left blank so it isn't wiped), so a
-- new run's import merged onto the old run's row and inherited its ability — the value "bled" in.
--
-- Fix: make the primary key composite (run_id, id) so each run gets its own row per location:slot.
-- Then a different run upserting the same id inserts a fresh (blank-ability) row instead of merging.
--
-- Safe on existing data: `id` was globally unique before (it was the sole PK), so every existing
-- (run_id, id) pair is already unique — adding the composite PK cannot fail on duplicates.
--
-- Run this once in the Supabase SQL editor. (The client's upsert uses onConflict 'run_id,id', so it
-- requires this constraint to exist.)

alter table catches drop constraint if exists catches_pkey;
alter table catches add primary key (run_id, id);
