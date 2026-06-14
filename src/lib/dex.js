// Dex lookups over the ROM-extracted data: resolve a species/ability by name, and turn a
// stored "catch" into a full record (types, base stats, ability) for detail views, filters,
// and the damage calculator.
import { SPECIES } from '../data/species.js';
import { ABILITIES } from '../data/abilities.js';
import { MOVES } from '../data/moves.js';
import { TYPE_NAMES } from '../data/typechart.js';

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// name -> species id (first match wins; tilde-marked alt forms share a base name).
const SPECIES_BY_NAME = {};
for (const [id, sp] of Object.entries(SPECIES)) {
  const k = norm(sp.n);
  if (!(k in SPECIES_BY_NAME)) SPECIES_BY_NAME[k] = +id;
}

export function findSpecies(name) {
  if (!name) return null;
  const id = SPECIES_BY_NAME[norm(name)];
  if (id == null) return null;
  return { id, ...SPECIES[id] };
}

// Like findSpecies but tolerates form suffixes the species table doesn't carry as their own
// entry (e.g. "Luxray-Mega", "Pikachu-Libre") by falling back to the base species name.
// Note: a mega's typing can differ from its base; this returns the base form's types.
export function findSpeciesLoose(name) {
  const direct = findSpecies(name);
  if (direct) return direct;
  const base = (name || '').split(/[-(]| with /i)[0].trim();
  return base && base !== name ? findSpecies(base) : null;
}

export const SPECIES_NAMES = Object.values(SPECIES).map((s) => s.n).sort();

// ability id <-> name
export const ABILITY_NAMES = Object.values(ABILITIES).sort();
const ABILITY_BY_NAME = {};
for (const [id, n] of Object.entries(ABILITIES)) ABILITY_BY_NAME[norm(n)] = +id;
export const abilityName = (id) => ABILITIES[id] || null;

// The abilities a species can legally have (names), for edit-mode suggestions.
export function speciesAbilities(name) {
  const sp = findSpecies(name);
  if (!sp?.a) return [];
  const seen = new Set();
  const out = [];
  for (const id of sp.a) {
    const n = ABILITIES[id];
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

export const typeNames = (types) => (types || []).map((t) => TYPE_NAMES[t]).filter(Boolean);

// --- Moves ---
export const MOVE_NAMES = Object.values(MOVES).map((m) => m.n).sort();
const MOVE_BY_NAME = {};
for (const m of Object.values(MOVES)) MOVE_BY_NAME[norm(m.n)] = m;
export const findMove = (name) => MOVE_BY_NAME[norm(name)] || null;
export const moveName = (id) => MOVES[id]?.n || null;

// Parse a boss spread string like "6 HP / 252 SpA / 252 Spe" into a [HP,Atk,Def,Spe,SpA,SpD]
// array, filling unlisted stats with `fill` (0 for EVs, 31 for IVs).
const SPREAD_IDX = { hp: 0, atk: 1, attack: 1, def: 2, defense: 2, spe: 3, spd: 5, speed: 3, spa: 4, spatk: 4, spdef: 5 };
export function parseSpread(str, fill) {
  const out = [fill, fill, fill, fill, fill, fill];
  if (!str) return out;
  for (const part of str.split('/')) {
    const m = part.trim().match(/(\d+)\s*([A-Za-z.]+)/);
    if (!m) continue;
    const key = m[2].toLowerCase().replace(/[^a-z]/g, '');
    const idx = SPREAD_IDX[key];
    if (idx != null) out[idx] = Number(m[1]);
  }
  return out;
}

// Ability name for a species id + Gen-3 ability slot (0/1), for save auto-fill.
export function abilityForSpeciesId(speciesId, slot) {
  const a = SPECIES[speciesId]?.a;
  if (!a) return '';
  return ABILITIES[a[slot]] || ABILITIES[a[0]] || '';
}

// Resolve a stored catch into a dex record, or null if the species name isn't recognised.
export function resolveCatch(c) {
  if (!c?.species) return null;
  const sp = findSpecies(c.species);
  if (!sp) return null;
  return {
    id: sp.id,
    name: sp.n,
    baseStats: sp.s,          // [HP,Atk,Def,Spe,SpA,SpD]
    types: sp.t,              // [typeId…]
    typeNames: typeNames(sp.t),
    ability: c.ability || null,
  };
}
