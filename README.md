# Pokémon Emerald Imperium — Soul Link Tracker & Boss Guide

A web app for running a **Soul Link Nuzlocke** of Pokémon Emerald Imperium with a friend, plus a
full **boss battle guide**. Built with React + Vite, with optional live 2-player sync via Supabase.

## Features
- **Soul-Link Board** — every place you can obtain a Pokémon in Imperium (routes, caves, fishing,
  gifts, eggs, legendaries) as an ordered checklist. Log each player's catch per location; linked
  pairs are flagged, and if one faints the partner row warns you to box its link.
- **House rules** — per-player Nav Token and ReRoll Token counters, catch status
  (alive / boxed / dead / voided), notes.
- **Save sync** — upload your `.sav` and the app parses your party + PC boxes in-browser,
  auto-detecting each Pokémon and the location it was caught, then drops them onto the board.
  Designed for **randomized** runs, where a static encounter dex doesn't apply. Reads
  Ruby/Sapphire/Emerald-family saves (including Imperium); a non-Emerald save such as
  FireRed/LeafGreen is detected and rejected with a clear message instead of importing garbage.
- **Boss Guide** — all 131 bosses (gym leaders, Sinnoh leaders, rivals, Elite 4, Aqua/Magma,
  mini-bosses, optional bosses), **ordered by where you are in the game** (which gym you're up to).
  Each boss shows full teams with level, ability, item, nature, IVs/EVs, moves, megas, **base
  stats**, level caps, and a **permanent-weather** badge (Sun/Rain/Sand/Snow) where the team sets it.

## Run it
```bash
npm install
npm run dev
```
Open the printed URL. With no configuration it runs in **local mode** (data saved on your device;
syncs across browser tabs — good for solo or same-screen play).

## Enable live 2-player sync (free)
1. Create a free project at https://supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and fill in your project URL + anon key.
4. Restart `npm run dev`. The header will show **☁ Live**. Share your run's 6-letter code with
   your friend; you'll both see the board update in real time.

## Deploy (free)
Push to GitHub and import into [Vercel](https://vercel.com). Add the two `VITE_SUPABASE_*` env
vars in the Vercel project settings. `vercel.json` already handles SPA routing.

## Maintenance scripts
Run these after a game update (they read the ROM / official sheet and regenerate bundled data):
- `npm run extract-species -- "C:/path/to/Imperium.gba"` — pull every species' name + base stats
  from the ROM into `src/data/species.js`.
- `npm run import-bosses` — re-pull the official Boss Battles Google Sheet into `src/data/bosses.json`
  (also attaches base stats + weather + progression phase; run *after* extract-species).
- `npm run validate-save -- "C:/path/to/your.sav"` — dump a save's party + boxes to the console.

## Notes
- **Species names + stats** are extracted directly from the Imperium ROM (`gSpeciesInfo`), so they
  match the hack exactly — including Gen 9 mons and paradoxes. Met **locations** use the vanilla
  Hoenn map and are accurate.
- A handful of **alternate forms** that share a base name (e.g. Alolan vs regular Ninetales) show
  the base form's stats, marked with a `~`. Megas with custom Imperium stats show those exactly.
- The board only auto-fills Pokémon that are actually in your save — as you catch more and re-sync,
  more locations fill in.
- **Supported saves:** the parser targets the Gen-3 Ruby/Sapphire/Emerald save layout. It has been
  verified against an Imperium save, a vanilla Emerald save, and confirmed to reject a FireRed save
  (different party layout) with a friendly error. Use `npm run validate-save -- "path/to.sav"` to
  dump any save's party/boxes to the console.
- **Bundle:** routes and the save importer are code-split, so the 378 KB boss dataset and the
  species table load only on the pages that use them — not on first paint.
