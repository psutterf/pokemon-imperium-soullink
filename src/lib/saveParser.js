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

// Footer-validated checksum: sum the section's 32-bit data words, fold to 16 bits. Used to
// auto-detect this build's section data size (vanilla = 3968 bytes; the Imperium expansion
// build uses the full 4084 = 4096 - 12-byte footer).
function sectionChecksum(bytes, off, size) {
  let s = 0;
  for (let i = 0; i < size; i += 4) s = (s + u32(bytes, off + i)) >>> 0;
  return ((s & 0xffff) + (s >>> 16)) & 0xffff;
}

// PID % 24 -> order of substructures Growth/Attacks/EVs/Misc.
const ORDERS = [
  'GAEM','GAME','GEAM','GEMA','GMAE','GMEA','AGEM','AGME','AEGM','AEMG','AMGE','AMEG',
  'EGAM','EGMA','EAGM','EAMG','EMGA','EMAG','MGAE','MGEA','MAGE','MAEG','MEGA','MEAG',
];

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// Locate the active save and return { map: id->offset, dataSize, pcStart, pcEnd }.
//
// Two layouts are supported:
//  - Standard Gen-3 Emerald: two save slots in the two physical halves (sections 0-13 / 14-27),
//    section id at 0xFF4 is 0-13 (so each id appears twice), data size 3968, PC boxes at ids 5-13.
//    The active slot is the half holding data, tie-broken by the save counter at 0xFFC.
//  - Imperium (pokeemerald-expansion): ONE 28-section save, section id at 0xFF4 runs 0-27 (each
//    once), data size 4084 (full sector minus the 12-byte footer), PC boxes at ids 17-25.
function locateActiveSections(bytes) {
  const sections = [];
  const maxSections = Math.min(32, Math.floor(bytes.length / SECTION_SIZE));
  for (let s = 0; s < maxSections; s++) {
    const off = s * SECTION_SIZE;
    if (u32(bytes, off + 0x0ff8) !== SIGNATURE) continue;
    sections.push({
      off, phys: s,
      id: u16(bytes, off + 0x0ff4),
      storedCk: u16(bytes, off + 0x0ff6),
      counter: u32(bytes, off + 0x0ffc),
    });
  }
  if (!sections.length) return null;

  // Detect data size: a data-heavy section only checksum-matches at its true size.
  let dataSize = 3968;
  for (const s of sections) {
    if (s.storedCk
      && sectionChecksum(bytes, s.off, 4084) === s.storedCk
      && sectionChecksum(bytes, s.off, 3968) !== s.storedCk) { dataSize = 4084; break; }
  }

  const maxId = Math.max(...sections.map((s) => s.id));
  if (maxId > SLOT_SECTIONS - 1) {
    // Expansion single-save: section id is unique 0..maxId; map directly. PC boxes at ids 17-25.
    const map = {};
    for (const s of sections) map[s.id] = s.off;
    return { map, dataSize, pcStart: 17, pcEnd: 25 };
  }

  // Standard two-slot save: group by physical half, pick the active one.
  const groups = new Map();
  for (const sec of sections) {
    const k = Math.floor(sec.phys / SLOT_SECTIONS);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(sec);
  }
  let best = null;
  for (const [, secs] of groups) {
    const score = secs.filter((s) => s.storedCk !== 0).length;
    const counter = Math.max(...secs.map((s) => (s.counter === 0xffffffff ? -1 : s.counter)));
    if (!best || score > best.score || (score === best.score && counter > best.counter)) best = { secs, counter, score };
  }
  const pick = {};
  for (const sec of best.secs) {
    const cur = pick[sec.id];
    if (!cur || (sec.storedCk && !cur.storedCk) || sec.counter > cur.counter) pick[sec.id] = sec;
  }
  const map = {};
  for (const id of Object.keys(pick)) map[id] = pick[id].off;
  return { map, dataSize, pcStart: 5, pcEnd: 13 };
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

  const G = sub.G, M = sub.M, A = sub.A;
  const species = u16(G, 0);
  const moveIds = [u16(A, 0), u16(A, 2), u16(A, 4), u16(A, 6)].filter((id) => id > 0);
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
    item, isEgg, shiny, abilityNum, nature, moveIds,
    level, metLevel,
    metLocation, metLocationName: metLocationName(metLocation),
  };
}

export function parseSave(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < SLOT_SECTIONS * SECTION_SIZE) throw new Error('File too small to be a Gen-3 save.');

  const loc = locateActiveSections(bytes);
  if (!loc) throw new Error('No valid Gen-3 save sections found.');
  const { map, dataSize, pcStart, pcEnd } = loc;

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

  // PC boxes: concatenate the data of the PC sections, then read 420 box mons (80 bytes each).
  const pcParts = [];
  for (let id = pcStart; id <= pcEnd; id++) {
    if (map[id] == null) continue;
    pcParts.push(bytes.subarray(map[id], map[id] + dataSize));
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
