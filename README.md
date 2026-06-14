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
- **Boss Guide** — all 131 bosses in **progression order** (early game → late). Level-capped
  bosses sit at their cap; level-scaled bosses are placed by estimating a progression point from
  team strength, so mini-bosses and optional bosses interleave into roughly where you meet them.
  **Optional** bosses are tagged, and **permanent-weather** badges are kept. Each boss shows full
  teams with level, ability, item, nature, IVs/EVs, moves, megas, **base stats**, and **per-Pokémon
  typing and weaknesses**.
- **Per-Pokémon detail** — click any caught mon for its typing, base-stat bars (with nature
  arrows), ability, and full **type weaknesses / resistances / immunities**. Track **ability** and
  **nature** per catch. Nature auto-fills from the save; ability is entered manually with
  autocomplete (Imperium randomizes abilities per-run via a seed that isn't saved, so it can't be
  read from the file — the autocomplete includes Imperium's custom abilities). Re-syncing a save
  refreshes species/level/nature/moves but **keeps your hand-entered ability**. **Status follows
  your PC: a Pokémon in box 14 is imported as dead, anything else as alive** (house rule).
- **Search, sort & tag filters** — search the board by species / nickname / ability, **sort by any
  base stat** (find your hardest hitter), and filter to **weather setters** or **stat changers**
  (Intimidate, the Ruin abilities, etc.). Every filter keeps the linked partner in view.
- **Team builder** — star up to 6 linked pairs; pick your six and your partner's six are decided
  automatically (with warnings when a partner slot is empty, boxed, or dead).
- **Damage calculator** — a Gen-8 calc with a full **field section** (format, weather incl.
  harsh sun / heavy rain / strong winds, terrain, all three screens, Helping Hand / Friend Guard /
  Battery / Power Spot / Flower Gift, the four Ruin abilities, inverse battle) plus STAB, type
  effectiveness, EVs/IVs/nature, stat stages, crit, burn, and common items/abilities. Add **up to
  four moves per side** and see the damage **both ways**. **Auto-fills either side — species,
  spread, ability, item, and moves — from your boxes or any boss team**, so you can plan fights in
  seconds.
- **Configurable Fallarbor eggs** — set how many starter eggs (3–9+) your run registers; the board
  generates that many egg rows.

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
- `npm run extract-gamedata -- "C:/path/to/Imperium.gba"` — pull every species' name, base stats,
  **types and abilities** plus the **ability-name** and **move** tables from the ROM into
  `src/data/{species,abilities,moves}.js`. (Supersedes `extract-species`, which only did names+stats.)
- `npm run import-bosses` — re-pull the official Boss Battles Google Sheet into `src/data/bosses.json`
  (also attaches base stats + weather + progression phase; run *after* extract-gamedata).
- `npm run validate-save -- "C:/path/to/your.sav"` — dump a save's party + boxes to the console.

## Database migration (existing Supabase projects)
On an **existing** project, run the migrations in `supabase/` once each in the SQL editor, in order:
[`migration-002.sql`](supabase/migration-002.sql) (ability/nature, egg count, team) and
[`migration-003.sql`](supabase/migration-003.sql) (per-catch moves, for the damage calc). New
projects get everything from `supabase/schema.sql`. (Local mode needs no migration.)

## Notes
- **Species names + stats** are extracted directly from the Imperium ROM (`gSpeciesInfo`), so they
  match the hack exactly — including Gen 9 mons and paradoxes. Met **locations** use the vanilla
  Hoenn map and are accurate.
- A handful of **alternate forms** that share a base name (e.g. Alolan vs regular Ninetales) show
  the base form's stats, marked with a `~`. Megas with custom Imperium stats show those exactly.
- The board only auto-fills Pokémon that are actually in your save — as you catch more and re-sync,
  more locations fill in.
- **Supported saves:** the parser auto-detects two layouts — standard Gen-3 Emerald (two slots,
  3968-byte sectors, PC at section ids 5–13) and Imperium's pokeemerald-expansion build (single
  28-section save, 4084-byte sectors, PC at ids 17–25, with the species packed into the low 11 bits
  of its field). Verified against an Imperium save (party + boxes) and a vanilla Emerald save, and it
  rejects a FireRed save (different layout) with a friendly error. Use `npm run validate-save --
  "path/to.sav"` to dump a save's party/boxes to the console.
- **Bundle:** routes and the save importer are code-split, so the 378 KB boss dataset and the
  species table load only on the pages that use them — not on first paint.
