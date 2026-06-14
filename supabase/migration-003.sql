-- Migration 003 — store each caught Pokémon's moves (read from the save) for the damage calc.
-- Run once in the Supabase SQL editor on an existing project.

alter table catches add column if not exists moves jsonb not null default '[]'::jsonb;
