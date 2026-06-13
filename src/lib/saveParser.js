// Pure Gen-3 (Emerald) save parser. Operates on a Uint8Array so it runs both in the
// browser (file upload) and in Node (validation). Extracts the active save slot's party
// and PC boxes, decrypting each Pokemon to read species, nickname, met location and met level.
//
// Format reference: 128KB save = two game slots of 14 sections (4096 bytes each). Each section
// footer holds: section id (0xFF4 u16), signature 0x08012025 (0xFF8 u32), save index (0xFFC u32).
// The slot with the higher save index is the most recent. Party lives in section 1; the PC box
// buffer is sections 5-13 concatenated. Each Pokemon's 48-byte data block is XOR-encrypted with
// (PID ^ OTID) and its four 12-byte substructures are ordered by PID % 24.
import { decodeGen3Text, metLocationName, speciesName } from './gen3data.js';

const SECTION_SIZE = 4096;
const SLOT_SECTIONS = 14;
const SIGNATURE = 0x08012025;

// Highest species id present in the Imperium ROM table. A decrypted "Pokemon" whose
// species is past this (or whose level is impossible) means we're reading misaligned
// bytes — e.g. a FireRed/LeafGreen save, which stores the party at a different offset.
const MAX_SPECIES = 2200;

// A real Gen-3 Pokemon never exceeds level 100, and its species is in the ROM's range.
function isPlausibleMon(mon) {
  if (mon.species < 1 || mon.species > MAX_SPECIES) return false;
  if (mon.metLevel > 100) return false;
  if (mon.level != null && (mon.level < 1 || mon.level > 100)) return false;
  return true;
}

// Bytes of real data per section id (rest is padding before the footer).
const SECTION_DATA_SIZE = { 0: 3884, 4: 3848, 13: 2000 }; // others default to 3968
const dataSize = (id) => SECTION_DATA_SIZE[id] ?? 3968;

// PID % 24 -> order of substructures Growth/Attacks/EVs/Misc.
const ORDERS = [
  'GAEM','GAME','GEAM','GEMA','GMAE','GMEA','AGEM','AGME','AEGM','AEMG','AMGE','AMEG',
  'EGAM','EGMA','EAGM','EAMG','EMGA','EMAG','MGAE','MGEA','MAGE','MAEG','MEGA','MEAG',
];

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// Locate the active save's section map (logical id 0-13 -> absolute offset).
//
// Handles two on-disk conventions:
//  - Standard Gen-3: the field at 0xFF4 is the section id (0-13); two slots sit in the two
//    physical halves; the active slot has the higher save counter at 0xFFC.
//  - Rolling (seen in this Emerald build): 0xFF4 is a global write counter that keeps
//    incrementing (0..27 across both slots) instead of resetting; logical id = counter % 14,
//    and the two slots are the two contiguous counter groups (0-13 and 14-27), scattered
//    across physical sections.
// In both cases we group sections, pick the group that actually holds data, and map by id.
function locateActiveSections(bytes) {
  const sections = [];
  const maxSections = Math.min(28, Math.floor(bytes.length / SECTION_SIZE));
  for (let s = 0; s < maxSections; s++) {
    const off = s * SECTION_SIZE;
    if (u32(bytes, off + 0x0ff8) !== SIGNATURE) continue;
    const rawid = u16(bytes, off + 0x0ff4);
    sections.push({
      off,
      phys: s,
      rawid,
      id: rawid % SLOT_SECTIONS,
      counter: u32(bytes, off + 0x0ffc),
      hasData: u16(bytes, off + 0x0ff6) !== 0, // stored checksum != 0 => real data
    });
  }
  if (!sections.length) return null;

  const rolling = sections.some((s) => s.rawid >= SLOT_SECTIONS);
  const groupKey = (s) => (rolling ? Math.floor(s.rawid / SLOT_SECTIONS) : Math.floor(s.phys / SLOT_SECTIONS));

  const groups = new Map();
  for (const sec of sections) {
    const k = groupKey(sec);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(sec);
  }

  // Active group: most sections carrying data, tie-broken by highest save counter.
  let best = null;
  for (const [, secs] of groups) {
    const score = secs.filter((s) => s.hasData).length;
    const counter = Math.max(...secs.map((s) => (s.counter === 0xffffffff ? -1 : s.counter)));
    if (!best || score > best.score || (score === best.score && counter > best.counter)) {
      best = { secs, score, counter };
    }
  }

  const map = {};
  for (const sec of best.secs) {
    // If two sections share an id within a group, keep the one with data / higher counter.
    const cur = map[sec.id];
    if (!cur || (sec.hasData && !cur.hasData) || sec.counter > cur.counter) map[sec.id] = sec;
  }
  const out = {};
  for (const id of Object.keys(map)) out[id] = map[id].off;
  return out;
}

function decryptMon(bytes, base, isParty) {
  const pid = u32(bytes, base + 0);
  const otid = u32(bytes, base + 4);
  if (pid === 0 && otid === 0) return null; // empty slot

  const nickname = decodeGen3Text(bytes.slice(base + 8, base + 18));
  const otName = decodeGen3Text(bytes.slice(base + 20, base + 27));

  // Decrypt the 48-byte data block.
  const key = (pid ^ otid) >>> 0;
  const dec = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) {
    const word = (u32(bytes, base + 32 + i) ^ key) >>> 0;
    dec[i] = word & 0xff;
    dec[i + 1] = (word >>> 8) & 0xff;
    dec[i + 2] = (word >>> 16) & 0xff;
    dec[i + 3] = (word >>> 24) & 0xff;
  }
  const order = ORDERS[pid % 24];
  const sub = {};
  for (let i = 0; i < 4; i++) sub[order[i]] = dec.subarray(i * 12, i * 12 + 12);

  const G = sub.G, M = sub.M;
  const species = u16(G, 0);
  const item = u16(G, 2);
  const metLocation = M[1];
  const origins = u16(M, 2);
  const metLevel = origins & 0x7f;
  const ivWord = u32(M, 4);
  const isEgg = (ivWord >> 30 & 1) === 1;
  const abilityNum = (ivWord >>> 31) & 1; // Gen-3 ability slot (0 or 1)
  const nature = pid % 25;                // Gen-3 nature is derived from the PID

  // Shininess: (PID halves) XOR (OTID halves) < 8.
  const shinyVal = ((pid & 0xffff) ^ (pid >>> 16) ^ (otid & 0xffff) ^ (otid >>> 16)) & 0xffff;
  const shiny = shinyVal < 8;

  const level = isParty ? bytes[base + 84] : null;

  return {
    pid, otid, nickname, otName,
    species, speciesName: speciesName(species),
    item, isEgg, shiny, abilityNum, nature,
    level, metLevel,
    metLocation, metLocationName: metLocationName(metLocation),
  };
}

export function parseSave(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < SLOT_SECTIONS * SECTION_SIZE) throw new Error('File too small to be a Gen-3 save.');

  const map = locateActiveSections(bytes);
  if (!map) throw new Error('No valid Gen-3 save sections found.');

  // Party: section id 1, count @0x234, entries @0x238 (100 bytes each).
  const party = [];
  if (map[1] != null) {
    const sec = map[1];
    const count = Math.min(6, u32(bytes, sec + 0x234));
    for (let i = 0; i < count; i++) {
      const mon = decryptMon(bytes, sec + 0x238 + i * 100, true);
      if (mon) party.push({ ...mon, source: 'party' });
    }
  }

  // PC boxes: concatenate data of sections 5..13, then read 420 box mons (80 bytes each).
  const pcParts = [];
  for (let id = 5; id <= 13; id++) {
    if (map[id] == null) continue;
    pcParts.push(bytes.subarray(map[id], map[id] + dataSize(id)));
  }
  const pc = concat(pcParts);
  const boxes = [];
  if (pc.length) {
    const BOX_COUNT = 14, PER_BOX = 30;
    for (let i = 0; i < BOX_COUNT * PER_BOX; i++) {
      const mon = decryptMon(pc, 4 + i * 80, false);
      if (mon) boxes.push({ ...mon, source: 'box', box: Math.floor(i / PER_BOX) + 1 });
    }
  }

  // Sanity check: if we decrypted occupied slots but most are garbage (impossible species
  // or levels), the layout doesn't match — almost always a non-Emerald save (FireRed/LeafGreen
  // put the party elsewhere). Reject it rather than dumping nonsense onto the board.
  const raw = [...party, ...boxes];
  const plausible = raw.filter(isPlausibleMon);
  if (raw.length >= 3 && plausible.length < raw.length * 0.5) {
    throw new Error(
      "This doesn't look like a compatible Emerald save. Pokémon data is unreadable — " +
      'FireRed/LeafGreen and other games use a different layout. Use a Ruby/Sapphire/Emerald ' +
      '(or Imperium) save.'
    );
  }

  const keptParty = party.filter(isPlausibleMon);
  const keptBoxes = boxes.filter(isPlausibleMon);
  return { party: keptParty, boxes: keptBoxes, all: [...keptParty, ...keptBoxes] };
}

function concat(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
