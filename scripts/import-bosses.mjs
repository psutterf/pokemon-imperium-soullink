// Imports the public "Boss Battles" Google Sheet for Pokemon Emerald Imperium
// and writes structured data to src/data/bosses.json.
//
// The sheet has one tab per category (Hoenn Leaders, Sinnoh Leaders, Elite 4, ...).
// Within a tab, each boss is a vertical block led by an ALL-CAPS name row; each of the
// boss's Pokemon occupies its own column, with labeled lines (Level:, Ability:, - Move, ...).
// Megas spill the "-mega @ Stone" suffix and ".baseStat" lines into the next column.
//
// Run: node scripts/import-bosses.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SPECIES } from '../src/data/species.js';

const SHEET_ID = '1qeKStZPzAbHXXwK48EIUbRWvNtRazYtkxKzwmfx_528';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/bosses.json');

// --- species name -> base stats (from the ROM extraction) ---
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byNorm = {};
for (const [id, sp] of Object.entries(SPECIES)) {
  const k = norm(sp.n);
  (byNorm[k] ||= []).push(sp.s);
}
// Resolve a boss Pokemon's stats. Exact name match preferred; otherwise strip a form suffix
// (-Mega/-Galar/-Alola/...) and fall back to the base form (marked approximate).
function lookupStats(speciesStr) {
  const exact = byNorm[norm(speciesStr)];
  if (exact) return { stats: exact[0], approx: exact.length > 1 };
  const base = byNorm[norm(speciesStr.split('-')[0])];
  if (base) return { stats: base[0], approx: true };
  return { stats: null, approx: false };
}

// --- permanent weather (per the game, weather bosses begin around gym 3) ---
const WEATHER_ABILITY = {
  drought: 'Sun', orichalcumpulse: 'Sun', desolateland: 'Harsh Sun',
  drizzle: 'Rain', primordialsea: 'Heavy Rain',
  sandstream: 'Sandstorm', sandspit: 'Sandstorm', snowwarning: 'Snow',
};
const WEATHER_ROCK = { heatrock: 1, damprock: 1, smoothrock: 1, icyrock: 1 };

// --- tiny CSV parser (handles quoted fields with commas/quotes) ---
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  row.push(field); rows.push(row);
  return rows;
}

async function getTabs() {
  const html = await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`)).text();
  const re = /items\.push\(\{name:\s*"([^"]+)"[^}]*?gid=(\d+)/g;
  const tabs = []; let m;
  while ((m = re.exec(html))) tabs.push({ name: m[1], gid: m[2] });
  return tabs;
}

async function getCSV(gid) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
  return await res.text();
}

// A header row names a boss: col0's first token is ALL-CAPS (>=2 chars) and the cell
// isn't a data line. Other cells on the row may carry annotations (location, "DOUBLE BATTLE").
function isBossHeader(row) {
  const c0 = (row[0] || '').trim();
  if (!c0) return false;
  const first = c0.split(/\s+/)[0];
  if (!/^[A-Z][A-Z0-9&'./-]+$/.test(first)) return false; // first word all-caps
  if (/@/.test(c0)) return false;
  if (/^(Level|Ability|IVs|EVs)\b/i.test(c0)) return false;
  if (/Nature$/i.test(c0)) return false;
  if (/^[-.]/.test(c0)) return false;
  return true;
}

// Classify a single labeled cell line for one Pokemon column.
function applyLine(mon, raw, nextCol) {
  const line = raw.trim();
  if (!line) return;
  if (/^Level:/i.test(line)) mon.level = parseInt(line.replace(/^Level:\s*/i, ''), 10);
  else if (/Highest\s+Lv/i.test(line)) mon.levelText = line; // scaled bosses
  else if (/Nature$/i.test(line)) mon.nature = line.replace(/\s*Nature$/i, '').trim();
  else if (/^Ability:/i.test(line)) { if (!mon.ability) mon.ability = line.replace(/^Ability:\s*/i, '').trim(); }
  else if (/^IVs:/i.test(line)) mon.ivs = line.replace(/^IVs:\s*/i, '').trim();
  else if (/^EVs:/i.test(line)) mon.evs = line.replace(/^EVs:\s*/i, '').trim();
  else if (/^-\s/.test(line)) mon.moves.push(line.replace(/^-\s*/, '').trim());
  else if (/^\./.test(line)) { /* .baseStat mega override — captured separately */ }
  else if (line.includes('@') && !mon.species) {
    const [sp, item] = line.split('@');
    mon.species = sp.trim();
    mon.item = item.trim();
  } else if (!mon.species) {
    mon.species = line;
  }
}

function parseBlock(grid, top, bottom, category, order) {
  const name = grid[top][0].trim();
  const width = Math.max(...grid.slice(top, bottom).map((r) => r.length));

  // Pass 1: each column with an "Ability:" line is one Pokemon (works for fixed + scaled bosses).
  const monByCol = new Map();
  for (let c = 0; c < width; c++) {
    let isMon = false, isContinuation = false;
    for (let r = top + 1; r < bottom; r++) {
      const cell = grid[r][c];
      if (!cell) continue;
      if (/^Ability:/i.test(cell.trim())) isMon = true;
      if (/-mega\s*@/i.test(cell)) isContinuation = true; // mega's spill column, not its own mon
    }
    if (!isMon || isContinuation) continue;
    const mon = { col: c, species: '', item: '', level: null, levelText: null, nature: '', ability: '', ivs: '', evs: '', moves: [], mega: false };
    for (let r = top + 1; r < bottom; r++) {
      const cell = grid[r][c];
      if (cell) applyLine(mon, cell);
      // Mega continuation in the adjacent column on the species row, e.g. "-mega @ Luxite"
      const next = grid[r][c + 1];
      if (next && /-mega\s*@/i.test(next)) {
        mon.mega = true;
        const stone = next.split('@')[1]?.trim();
        if (stone) { mon.species += '-Mega'; mon.item = stone; }
      }
    }
    if (/-mega\b/i.test(mon.species)) mon.mega = true;
    monByCol.set(c, mon);
  }

  const monCols = [...monByCol.keys()].sort((a, b) => a - b);
  // Pass 2: ".baseStat" override cells belong to the mega Pokemon they sit to the right of —
  // attach each to the nearest Pokemon column at or before it (NOT every column).
  for (let r = top + 1; r < bottom; r++) {
    for (let cc = 0; cc < grid[r].length; cc++) {
      const v = grid[r][cc];
      if (!v || !/^\.base/i.test(v.trim())) continue;
      const mm = v.trim().match(/^\.base(\w+)\s*=\s*(\d+)/i);
      if (!mm) continue;
      const owner = monCols.filter((c) => c <= cc).pop();
      const mon = monByCol.get(owner);
      if (!mon) continue;
      (mon.megaStats ||= {})[mm[1].toLowerCase()] = parseInt(mm[2], 10);
      mon.mega = true;
    }
  }

  const pokemon = monCols.map((c) => monByCol.get(c)).filter((m) => m.species).map(({ col, ...m }) => m);
  return { name, category, order, levelCap: Math.max(0, ...pokemon.map((p) => p.level || 0)) || null, pokemon };
}

function parseTab(csv, category) {
  const grid = parseCSV(csv);
  const headers = [];
  for (let r = 0; r < grid.length; r++) if (isBossHeader(grid[r])) headers.push(r);
  const bosses = [];
  for (let i = 0; i < headers.length; i++) {
    const top = headers[i];
    const bottom = i + 1 < headers.length ? headers[i + 1] : grid.length;
    const boss = parseBlock(grid, top, bottom, category, bosses.length);
    if (boss.pokemon.length) bosses.push(boss);
  }
  return bosses;
}

// Attach base stats to each Pokemon; megas with explicit sheet stats use those.
function enrichPokemon(p) {
  let baseStats = null, statsApprox = false;
  if (p.megaStats && p.megaStats.hp != null) {
    const m = p.megaStats;
    baseStats = [m.hp, m.attack, m.defense, m.speed, m.spattack, m.spdefense];
  } else {
    const r = lookupStats(p.species);
    baseStats = r.stats;
    statsApprox = r.approx;
  }
  return { ...p, baseStats, statsApprox };
}

// Detect a boss's permanent weather from weather-setting abilities / rocks.
function detectWeather(boss) {
  let weather = null, permanent = false;
  for (const p of boss.pokemon) {
    const w = WEATHER_ABILITY[norm(p.ability)];
    if (w) { weather = w; if (WEATHER_ROCK[norm(p.item)]) permanent = true; }
  }
  // In Imperium, weather bosses run permanent weather from ~gym 3 onward.
  if (weather && (boss.levelCap == null || boss.levelCap >= 34)) permanent = true;
  return { weather, permanentWeather: weather ? permanent : false };
}

async function main() {
  const tabs = await getTabs();
  console.log(`Found ${tabs.length} tabs.`);
  const all = [];
  let order = 0;
  for (const tab of tabs) {
    const csv = await getCSV(tab.gid);
    const bosses = parseTab(csv, tab.name).map((b) => ({ ...b, order: order++ }));
    console.log(`  ${tab.name.padEnd(18)} -> ${bosses.length} bosses, ${bosses.reduce((n, b) => n + b.pokemon.length, 0)} pokemon`);
    all.push(...bosses);
  }

  // Progression phases: bucket every boss by level cap against the 8 Hoenn gym caps.
  const gyms = all.filter((b) => b.category === 'Hoenn Leaders').sort((a, b) => a.order - b.order);
  const gymCaps = gyms.map((g) => g.levelCap);
  const gymNames = gyms.map((g) => g.name);
  const phaseOf = (b) => {
    if (b.category === 'Elite 4') return { phase: gymCaps.length + 1, phaseLabel: 'Elite Four & Champion' };
    if (b.levelCap == null) return { phase: gymCaps.length + 2, phaseLabel: 'Scaled to your level' };
    for (let i = 0; i < gymCaps.length; i++) if (b.levelCap <= gymCaps[i]) return { phase: i, phaseLabel: `Up to Gym ${i + 1} — ${gymNames[i]}` };
    return { phase: gymCaps.length, phaseLabel: 'Post-Gym 8 / Victory Road' };
  };

  const enriched = all.map((b) => ({
    ...b,
    ...phaseOf(b),
    ...detectWeather(b),
    pokemon: b.pokemon.map(enrichPokemon),
  }));

  const withStats = enriched.flatMap((b) => b.pokemon).filter((p) => p.baseStats).length;
  const weatherBosses = enriched.filter((b) => b.weather).length;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(enriched, null, 2));
  console.log(`\nWrote ${enriched.length} bosses to ${OUT}`);
  console.log(`Stats matched: ${withStats}/${enriched.flatMap((b) => b.pokemon).length} pokemon · ${weatherBosses} weather bosses`);
}

main().catch((e) => { console.error(e); process.exit(1); });
