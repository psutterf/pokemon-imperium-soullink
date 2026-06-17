-- Migration 004 — custom reward pairs + the prize wheel (both shared/synced per run).
-- Run once in the Supabase SQL editor on an existing project. New projects get these from schema.sql.
--
-- custom_locations: manually-added board rows that aren't game locations (rewards you create), shape
--   [{ "id": "reward-<uid>", "name": "...", "type": "reward", "note": "..." }]. Catches attach to them
--   exactly like built-in locations (catch id = "<location_id>:<slot>").
-- wheel: the prize-wheel segments, shape [{ "id": "...", "label": "...", "color": "#rrggbb" }].
--   Empty array => the app seeds editable defaults.

alter table runs add column if not exists custom_locations jsonb not null default '[]'::jsonb;
alter table runs add column if not exists wheel            jsonb not null default '[]'::jsonb;
