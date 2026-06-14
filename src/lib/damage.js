// Gen-8 damage engine. Pure functions over plain objects so it can be unit-checked and
// reused by the UI. Implements the modern damage formula and the major modifiers: STAB
// (+Adaptability), type effectiveness, weather, crit, EVs/IVs/nature, stat-stage boosts,
// burn, screens, spread, and a curated set of offensive/defensive item & ability effects.
//
// Move power note: the ROM stores Imperium move power at half the effective value (see
// scripts/extract-gamedata.mjs), so we scale by POWER_SCALE to get real battle power.
import { effectiveness } from '../data/typechart.js';
import { natureMult } from '../data/natures.js';

export const POWER_SCALE = 2;
const STAT = { hp: 0, atk: 1, def: 2, spe: 3, spa: 4, spd: 5 };

// Round half *down*, like the games (Showdown's pokeRound).
const pr = (x) => (x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x));

// A computed stat at a given level. HP uses its own formula.
export function statValue(base, iv, ev, level, natMult, isHP) {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (isHP) return base === 1 ? 1 : core + level + 10; // Shedinja stays at 1
  return Math.floor((core + 5) * natMult);
}

// Full stat line [HP,Atk,Def,Spe,SpA,SpD] for a mon spec.
export function computeStats(p) {
  const ivs = p.ivs || [31, 31, 31, 31, 31, 31];
  const evs = p.evs || [0, 0, 0, 0, 0, 0];
  return [0, 1, 2, 3, 4, 5].map((i) =>
    statValue(p.baseStats[i], ivs[i], evs[i], p.level, natureMult(p.nature, i), i === 0));
}

const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

// Offensive stat (with boosts + Atk-doubling abilities / choice items + Ruin).
function offensiveStat(att, category, crit, field) {
  const idx = category === 'phys' ? STAT.atk : STAT.spa;
  const stats = computeStats(att);
  let stat = stats[idx];
  let stage = att.boost || 0;
  if (crit && stage < 0) stage = 0; // crits ignore the attacker's drops
  stat = Math.floor(stat * stageMult(stage));

  let m = 1;
  const ab = att.ability;
  if (category === 'phys' && (ab === 'Huge Power' || ab === 'Pure Power')) m *= 2;
  if (att.status && ab === 'Guts' && category === 'phys') m *= 1.5;
  if (att.item === 'Choice Band' && category === 'phys') m *= 1.5;
  if (att.item === 'Choice Specs' && category === 'spec') m *= 1.5;
  if (field.flowerGift && field.weather === 'sun' && category === 'phys') m *= 1.5;
  if (category === 'phys' && field.ruinTablets) m *= 0.75; // Tablets of Ruin
  if (category === 'spec' && field.ruinVessel) m *= 0.75;  // Vessel of Ruin
  return Math.floor(stat * m);
}

// Defensive stat (with boosts + SpD items / abilities).
function defensiveStat(def, category, crit, field) {
  const idx = category === 'phys' ? STAT.def : STAT.spd;
  const stats = computeStats(def);
  let stat = stats[idx];
  let stage = (category === 'phys' ? def.defBoost : def.spdBoost) || 0;
  if (crit && stage > 0) stage = 0; // crits ignore the defender's boosts
  stat = Math.floor(stat * stageMult(stage));

  let m = 1;
  if (category === 'spec' && def.item === 'Assault Vest') m *= 1.5;
  if (field.weather === 'sand' && def.types?.includes(6 /* Rock */) && category === 'spec') m *= 1.5; // Sandstorm SpD
  if (category === 'phys' && field.ruinSword) m *= 0.75; // Sword of Ruin lowers Def
  if (category === 'spec' && field.ruinBeads) m *= 0.75; // Beads of Ruin lowers SpD
  return Math.floor(stat * m);
}

// Is a mon grounded (so terrain affects it)? Flying types and Levitate float.
function grounded(mon) {
  return !mon.types?.includes(3 /* Flying */) && mon.ability !== 'Levitate' && mon.item !== 'Air Balloon';
}

// Terrain power boost (Gen 8 = ×1.3) when the attacker is grounded, plus Misty's Dragon cut.
function terrainPowerMod(move, att, field) {
  if (!field.terrain) return 1;
  if (field.terrain === 'misty' && move.type === 17 /* Dragon */) return 0.5; // affects grounded target
  if (!grounded(att)) return 1;
  if (field.terrain === 'electric' && move.type === 14) return 1.3;
  if (field.terrain === 'grassy' && move.type === 13) return 1.3;
  if (field.terrain === 'psychic' && move.type === 15) return 1.3;
  return 1;
}

// Effective base power after power-modifying abilities/items.
function effectivePower(move, att) {
  let bp = move.power * POWER_SCALE;
  const ab = att.ability;
  if (ab === 'Technician' && bp <= 60) bp *= 1.5;
  // Pinch abilities: +50% to matching type when HP <= 1/3.
  const pinch = { Overgrow: 13, Blaze: 11, Torrent: 12, Swarm: 7 };
  if (pinch[ab] === move.type && (att.hpPct ?? 100) <= 33) bp *= 1.5;
  if (att.item === 'Life Orb') {/* handled as final mod */}
  return Math.max(1, Math.floor(bp));
}

function stabMultiplier(move, att) {
  const isStab = att.types?.includes(move.type);
  if (!isStab) return 1;
  return att.ability === 'Adaptability' ? 2 : 1.5;
}

function weatherPowerMod(move, field) {
  const w = field.weather;
  if (w === 'sun' || w === 'harshsun') {
    if (move.type === 11) return 1.5;   // Fire ↑
    if (move.type === 12) return 0.5;   // Water ↓ (water fails entirely under harsh sun — handled separately)
  } else if (w === 'rain' || w === 'heavyrain') {
    if (move.type === 12) return 1.5;   // Water ↑
    if (move.type === 11) return 0.5;   // Fire ↓
  }
  return 1;
}

// Final flat multiplier from items/abilities applied after type effectiveness.
function finalModifier(move, att, def, eff, field) {
  let m = 1;
  const category = move.c;
  // attacker item / ability
  if (att.item === 'Life Orb') m *= 1.3;
  if (att.item === 'Expert Belt' && eff > 1) m *= 1.2;
  if (att.item === 'Muscle Band' && category === 'phys') m *= 1.1;
  if (att.item === 'Wise Glasses' && category === 'spec') m *= 1.1;
  if (att.ability === 'Tough Claws' && move.contact) m *= 1.3;
  if (att.ability === 'Sheer Force' && move.contact) m *= 1.3; // approx (boosted moves)
  // defender ability
  if (def.ability === 'Multiscale' && (def.hpPct ?? 100) >= 100) m *= 0.5;
  if ((def.ability === 'Filter' || def.ability === 'Solid Rock' || def.ability === 'Prism Armor') && eff > 1) m *= 0.75;
  if (def.ability === 'Thick Fat' && (move.type === 11 || move.type === 16)) m *= 0.5;
  if (def.ability === 'Heatproof' && move.type === 11) m *= 0.5;
  if (def.ability === 'Ice Scales' && category === 'spec') m *= 0.5;
  // ally support
  if (field.helpingHand) m *= 1.5;
  if (field.friendGuard) m *= 0.75;
  if (field.battery && category === 'spec') m *= 1.3;
  if (field.powerSpot) m *= 1.3;
  // screens (not on a crit). Aurora Veil covers both; doubles weakens to ~2/3.
  const screenMod = field.format === 'doubles' ? 2732 / 4096 : 0.5;
  const screened = field.auroraVeil
    || (category === 'phys' && field.reflect)
    || (category === 'spec' && field.lightScreen);
  if (!field.crit && screened) m *= screenMod;
  return m;
}

// Returns immunity from defender ability for the move type, or null.
function abilityImmunity(move, def) {
  const a = def.ability;
  if (a === 'Levitate' && move.type === 5) return true;          // Ground
  if (a === 'Flash Fire' && move.type === 11) return true;        // Fire
  if ((a === 'Water Absorb' || a === 'Storm Drain' || a === 'Dry Skin') && move.type === 12) return true;
  if ((a === 'Volt Absorb' || a === 'Lightning Rod' || a === 'Motor Drive') && move.type === 14) return true;
  if (a === 'Sap Sipper' && move.type === 13) return true;        // Grass
  return false;
}

// Main entry. Returns a result object, or { error } when the move can't deal damage.
export function calcDamage({ attacker, defender, move, field = {} }) {
  if (!attacker?.baseStats || !defender?.baseStats || !move) return { error: 'Incomplete input.' };
  if (move.c === 'status' || !move.power) return { error: 'Status move — no damage.' };

  const defStats = computeStats(defender);
  const maxHP = defStats[0];

  // Primal weather nullifies the opposing element entirely.
  if ((field.weather === 'harshsun' && move.type === 12) ||
      (field.weather === 'heavyrain' && move.type === 11)) {
    return { min: 0, max: 0, minPct: 0, maxPct: 0, eff: 0, maxHP, immune: true, fizzled: true };
  }

  let eff = effectiveness(move.type, defender.types || []);
  // Strong Winds removes Flying's weaknesses (super-effective hits become neutral).
  if (field.weather === 'strongwinds' && defender.types?.includes(3) && eff > 1) eff /= 2;
  if (field.inverse) eff = eff === 0 ? 2 : eff > 1 ? 0.5 : eff < 1 ? 2 : 1;
  if (eff === 0 || abilityImmunity(move, defender) ||
      (defender.ability === 'Wonder Guard' && eff <= 1)) {
    return { min: 0, max: 0, minPct: 0, maxPct: 0, eff: 0, maxHP, immune: true };
  }

  const crit = !!field.crit;
  const A = offensiveStat(attacker, move.c, crit, field);
  const D = defensiveStat(defender, move.c, crit, field);
  const power = Math.max(1, Math.floor(effectivePower(move, attacker) * terrainPowerMod(move, attacker, field)));

  // Base damage.
  let base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * A) / D) / 50) + 2;
  if (field.spread) base = pr(base * 0.75);
  const wMod = weatherPowerMod(move, field);
  if (wMod !== 1) base = pr(base * wMod);
  if (crit) base = Math.floor(base * 1.5);

  const stab = stabMultiplier(move, attacker);
  const fm = finalModifier(move, attacker, defender, eff, field);

  const roll = (r) => {
    let d = Math.floor((base * r) / 100);
    d = pr(d * stab);
    d = Math.floor(d * eff);
    if (field.burn && move.c === 'phys' && attacker.ability !== 'Guts') d = Math.floor(d * 0.5);
    d = pr(d * fm);
    return Math.max(1, d);
  };
  const min = roll(85);
  const max = roll(100);
  const pct = (d) => Math.round((d / maxHP) * 1000) / 10;
  return {
    min, max, minPct: pct(min), maxPct: pct(max),
    eff, maxHP, power, A, D,
    hitsToKO: Math.ceil(maxHP / max),
    guaranteedKO: min >= maxHP,
  };
}
