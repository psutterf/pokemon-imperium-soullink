-- Migration 002 — ability/nature on catches, egg count + team on runs.
-- Run this in the Supabase SQL editor on an existing project (safe to run once).
-- New projects get these from the updated schema.sql instead.

alter table catches add column if not exists ability text;
alter table catches add column if not exists nature  text;

alter table runs add column if not exists egg_count int  not null default 6;
alter table runs add column if not exists team      jsonb not null default '[]'::jsonb;
