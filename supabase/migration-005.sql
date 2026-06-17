-- Migration 005 — a second prize wheel (shared/synced per run), starts empty.
-- Run once in the Supabase SQL editor on an existing project. New projects get this from schema.sql.
--
-- wheel2: same shape as `wheel` ([{ "id": "...", "label": "...", "color": "#rrggbb" }]) but NOT seeded
--   with defaults — it stays empty until the players fill it in on the Wheel tab.

alter table runs add column if not exists wheel2 jsonb not null default '[]'::jsonb;
