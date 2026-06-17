-- Pokemon Emerald Imperium Soul Link tracker — Supabase schema.
-- Run this in the Supabase SQL editor, then add your project URL + anon key to .env.local.
-- Only mutable per-run state lives here; locations and bosses are bundled static data in the app.

create extension if not exists "pgcrypto";

create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  randomized  boolean not null default true,
  egg_count   int  not null default 6,   -- Fallarbor starter eggs to register
  team        jsonb not null default '[]'::jsonb, -- soul-link team: up to 6 location ids
  custom_locations jsonb not null default '[]'::jsonb, -- manually-added reward pair rows
  wheel       jsonb not null default '[]'::jsonb, -- prize-wheel segments (empty => seeded defaults)
  tokens      jsonb not null default '{"1":{"nav":0,"reroll":0},"2":{"nav":0,"reroll":0}}',
  players     jsonb not null default '[{"slot":1,"name":"Player 1"},{"slot":2,"name":"Player 2"}]',
  created_at  timestamptz not null default now()
);

create table if not exists catches (
  id           text primary key,          -- "<location_id>:<slot>"
  run_id       uuid not null references runs(id) on delete cascade,
  location_id  text not null,
  slot         int  not null check (slot in (1,2)),
  species      text,
  nickname     text,
  level        int,
  ability      text,
  nature       text,
  moves        jsonb not null default '[]'::jsonb,  -- move names (read from the save)
  status       text not null default 'alive',  -- alive | boxed | dead | voided
  source       text not null default 'manual', -- manual | save
  notes        text,
  updated_at   timestamptz not null default now()
);

create index if not exists catches_run_idx on catches(run_id);

-- Realtime: broadcast row changes to subscribers.
alter publication supabase_realtime add table runs;
alter publication supabase_realtime add table catches;

-- Open access for two friends sharing a code (no auth). Tighten later if desired.
alter table runs    enable row level security;
alter table catches enable row level security;
create policy "anon read runs"     on runs    for select using (true);
create policy "anon write runs"    on runs    for all    using (true) with check (true);
create policy "anon read catches"  on catches for select using (true);
create policy "anon write catches" on catches for all    using (true) with check (true);
