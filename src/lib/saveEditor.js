// Client-side save editor for Pokemon Emerald Imperium v1.1 (expanded pokeemerald).
// Spawns bag items and PC-box Pokemon by editing the .sav directly — a 1:1 JS port of the
// verified Python tool (Pokemon Docs/imperium_spawn.py), with one deliberate difference:
// spawned Pokemon are BUILT (level 1, neutral nature, chosen ability slot, chosen moves) rather
// than cloned at the template's level. Everything runs on a Uint8Array so it works in the browser
// (file upload -> download) with no server and no ROM.
//
// Save facts (reverse-engineered, all verified against the real save + ROM):
//  - Single 28-section save (ids 0-27) across sectors 0-27, WEAR-LEVELED: the sector<->id map AND
//    the item-encryption key rotate on every in-game save, so we read both live from the file.
//  - SaveBlock2 = section id 0; SaveBlock1 = ids 1-4 (0xFF4 data bytes each, joined).
//  - PC-box storage = sections 17-25 (expansion) / 5-13 (vanilla), located by layout like saveParser
//    (works with empty boxes); concatenated they hold u32 currentBox + 420 box slots (80 bytes each).
//  - Item quantity = qty XOR (key16); key16 = u32 at SaveBlock2+0x44, low 16 bits.
//  - Section checksum = sum of u32 words over 0xFF4 bytes, folded to u16, stored at +0xFF6.
//  - Pokemon: standard Gen-3 80-byte box structure; 48-byte data XOR-keyed by (PID^OTID), four
//    12-byte substructs ordered by PID%24, internal checksum at +0x1C; species = low 11 bits of
//    the Growth substruct's first u16.
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { ITEMS } from '../data/items.js';

const SIG = 0x08012025;
const DATASZ = 0x0ff4;
const TACKLE = 33; // default move when none chosen
// Every spawned reward mon is stamped as met at Petalburg Woods (#59) so they all funnel to one
// board row; the importer protects that row from being overwritten on re-sync (see SaveImport).
const MET_PETALBURG_WOODS = 59;

// Bag pockets: offset within the joined SaveBlock1 buffer, and slot capacity.
export const POCKETS = {
  items: [0x0560, 180], mega: [0x0830, 76], key: [0x0960, 60],
  balls: [0x0a50, 50], tm: [0x0b18, 252], berry: [0x0f08, 76],
};

// PID % 24 -> substructure order (Growth/Attacks/EVs/Misc).
const ORDER = (
  'GAEM GAME GEAM GEMA GMAE GMEA AGEM AGME AEGM AEMG AMGE AMEG ' +
  'EGAM EGMA EAGM EAMG EMGA EMAG MGAE MGEA MAGE MAEG MEGA MEAG'
).split(' ');

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const setU16 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >>> 8) & 0xff; };
const setU32 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >>> 8) & 0xff; b[o + 2] = (v >>> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; };

// --- Gen-3 name encoding (for the spawned Pokemon's nickname) ---
const ENC = { ' ': 0x00, '-': 0xae, '.': 0xad, "'": 0xb4, 'é': 0x1b, '&': 0x2d, '♂': 0xb5, '♀': 0xb6 };
for (let c = 0; c < 26; c++) { ENC[String.fromCharCode(65 + c)] = 0xbb + c; ENC[String.fromCharCode(97 + c)] = 0xd5 + c; }
for (let c = 0; c < 10; c++) ENC[String.fromCharCode(48 + c)] = 0xa1 + c;
function encodeName(s, length = 10) {
  const out = new Uint8Array(length).fill(0xff);
  let i = 0;
  for (const ch of s) {
    if (i >= length) break;
    const code = ENC[ch];
    if (code !== undefined) out[i++] = code;
  }
  return out;
}

function checksum(core, off) {
  let c = 0;
  for (let i = 0; i < DATASZ; i += 4) c = (c + u32(core, off + i)) >>> 0;
  return ((c >>> 16) + (c & 0xffff)) & 0xffff;
}

// Parse the save into { core, trailer, secs }. core is the 128KB section area; trailer is the
// 16-byte mGBA suffix we must preserve byte-for-byte.
export function loadSave(buffer) {
  const all = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (all.length < 0x20000) throw new Error('File too small to be a Gen-3 save.');
  const core = all.slice(0, 0x20000);
  const trailer = all.slice(0x20000);
  const secs = {};
  for (let i = 0; i < 32; i++) {
    const off = i * 0x1000;
    if (u32(core, off + 0x0ff8) === SIG) secs[u16(core, off + 0x0ff4)] = off;
  }
  if (secs[0] == null || secs[1] == null) throw new Error('Not a recognizable Imperium/Emerald save (missing SaveBlock sections).');
  const key16 = u32(core, secs[0] + 0x44) & 0xffff;
  return { core, trailer, secs, key16 };
}

const SB1_IDS = [1, 2, 3, 4];
function joinSB1(core, secs) {
  const out = new Uint8Array(SB1_IDS.length * DATASZ);
  SB1_IDS.forEach((id, n) => out.set(core.subarray(secs[id], secs[id] + DATASZ), n * DATASZ));
  return out;
}
function splitSB1Back(core, secs, blob) {
  SB1_IDS.forEach((id, n) => {
    const off = secs[id];
    core.set(blob.subarray(n * DATASZ, (n + 1) * DATASZ), off);
    setU16(core, off + 0x0ff6, checksum(core, off));
  });
}

// --- Items ---
// Returns a log string. Stacks onto an existing entry (cap 999), else uses the first empty slot.
function addItem(sb1, key16, pocket, itemId, qty) {
  const [base, count] = POCKETS[pocket];
  for (let s = 0; s < count; s++) {
    const a = base + s * 4;
    if (u16(sb1, a) === itemId) {
      const have = (u16(sb1, a + 2) ^ key16) & 0xffff;
      const next = Math.min(have + qty, 999);
      setU16(sb1, a + 2, next ^ key16);
      return { ok: true, msg: `stacked ${itemName(itemId)} → ×${next} (${pocket})` };
    }
  }
  for (let s = 0; s < count; s++) {
    const a = base + s * 4;
    if (u16(sb1, a) === 0) {
      setU16(sb1, a, itemId);
      setU16(sb1, a + 2, Math.min(qty, 999) ^ key16);
      return { ok: true, msg: `added ${itemName(itemId)} ×${Math.min(qty, 999)} (${pocket})` };
    }
  }
  return { ok: false, msg: `${pocket} pocket is FULL — ${itemName(itemId)} not added` };
}

const itemName = (id) => ITEMS[id]?.n || `item #${id}`;

// --- Pokemon ---
function decrypt48(blk) {
  const pid = u32(blk, 0), otid = u32(blk, 4);
  const key = (pid ^ otid) >>> 0;
  const dec = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) setU32(dec, i, (u32(blk, 0x20 + i) ^ key) >>> 0);
  return { pid, otid, key, dec, order: ORDER[pid % 24] };
}

// Build a fresh level-1 box Pokemon from a template (an existing party/box mon, so the new mon
// inherits the player's OT id and obeys). Overrides species, ability slot, moves; neutralizes
// nature; zeroes experience/EVs/held-item. Returns 80 bytes.
function buildMon(template80, { species, abilityNum = 0, moveIds = [] }) {
  const t = decrypt48(template80);
  // Pull the template's four substructs (preserves met info, ball, ribbons -> legit-looking).
  const sub = {};
  for (let i = 0; i < 4; i++) sub[t.order[i]] = t.dec.slice(i * 12, i * 12 + 12);
  const G = sub.G, A = sub.A, E = sub.E, M = sub.M;

  // Growth: species (low 11 bits — base form), clear held item, level-1 (exp 0), no PP-ups.
  setU16(G, 0, species & 0x7ff);
  setU16(G, 2, 0);
  setU32(G, 4, 0);
  G[8] = 0;

  // Attacks: chosen moves (default Tackle), PP = each move's base PP, no PP-ups.
  const moves = (moveIds && moveIds.length ? moveIds : [TACKLE]).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    const mv = moves[i] || 0;
    setU16(A, i * 2, mv);
    A[8 + i] = mv ? Math.min(MOVES[mv]?.pp ?? 5, 99) : 0;
  }

  // EVs + contest stats: zero (a level-1 mon).
  for (let i = 0; i < 12; i++) E[i] = 0;

  // Misc: met location Petalburg Woods; met level 1; perfect IVs; ability slot via bit 31; not an egg.
  M[1] = MET_PETALBURG_WOODS;
  setU16(M, 2, (u16(M, 2) & ~0x7f) | 1);
  setU32(M, 4, (0x3fffffff | (abilityNum ? 0x80000000 : 0)) >>> 0);

  // Re-pack under a fresh PID whose nature (PID % 25) is neutral (Hardy = 0). Keep the template
  // OT id so the mon still obeys.
  const otid = t.otid;
  let pid = (Math.floor(Math.random() * 0xffffffff) >>> 0);
  pid = (pid - (pid % 25)) >>> 0; // nature 0 (Hardy, neutral)
  if (pid === 0) pid = 25;
  const order = ORDER[pid % 24];
  const dec = new Uint8Array(48);
  order.split('').forEach((tag, i) => dec.set(sub[tag], i * 12));
  let chk = 0;
  for (let k = 0; k < 48; k += 2) chk = (chk + u16(dec, k)) & 0xffff;

  const out = template80.slice(0, 80);   // keep OT name / language / markings
  setU32(out, 0, pid);
  setU32(out, 4, otid);
  encodeName(SPECIES[species]?.n || `#${species}`).forEach((b, i) => { out[8 + i] = b; });
  setU16(out, 0x1c, chk);
  const key = (pid ^ otid) >>> 0;
  for (let i = 0; i < 48; i += 4) setU32(out, 0x20 + i, (u32(dec, i) ^ key) >>> 0);
  return out;
}

// PC-box storage is located by the SAVE LAYOUT (the same way saveParser does), NOT by scanning for
// existing mons — so it works even when every box is empty (the old ">=5 valid mons" heuristic failed
// then). Expansion (Imperium) single-save: section ids 17-25; vanilla two-slot: 5-13. The
// PokemonStorage blob is those sections concatenated in id order: a u32 `currentBox`, then 420 box
// slots (14 boxes x 30) of 80 bytes each starting at offset 4 — exactly what the parser reads.
const PC_BOX_SLOTS = 14 * 30;
function pcSections(secs) {
  const maxId = Math.max(...Object.keys(secs).map(Number));
  const [start, end] = maxId > 13 ? [17, 25] : [5, 13];
  const parts = [];
  for (let id = start; id <= end; id++) if (secs[id] != null) parts.push({ id, off: secs[id] });
  return parts;
}
function joinPC(core, parts) {
  const buf = new Uint8Array(parts.length * DATASZ);
  parts.forEach((p, n) => buf.set(core.subarray(p.off, p.off + DATASZ), n * DATASZ));
  return buf;
}

// High-level: apply item + pokemon edits to a loaded save (mutates save.core). Returns a log.
// items:   [{ id, qty, pocket }]
// pokemon: [{ species, abilityNum, moveIds }]
export function applyEdits(save, { items = [], pokemon = [] }) {
  const { core, secs, key16 } = save;
  const log = [];

  if (items.length) {
    const sb1 = joinSB1(core, secs);
    for (const it of items) {
      const r = addItem(sb1, key16, it.pocket, it.id, it.qty);
      log.push(r.msg);
    }
    splitSB1Back(core, secs, sb1);
  }

  if (pokemon.length) {
    const sb1 = joinSB1(core, secs);
    const template = sb1.slice(0x238, 0x238 + 80);
    if (u32(template, 0) === 0) {
      log.push('!! No party Pokémon to use as a template — cannot spawn Pokémon.');
    } else {
      const parts = pcSections(secs);
      if (!parts.length) {
        log.push('!! Could not locate PC box storage — no Pokémon spawned.');
      } else {
        const buf = joinPC(core, parts);
        let scan = 0, placed = 0;
        for (const spec of pokemon) {
          // Next empty box slot (PID == 0), scanning the 420 slots after the u32 `currentBox` field.
          let local = -1;
          for (; scan < PC_BOX_SLOTS; scan++) {
            const o = 4 + scan * 80;
            if (o + 80 > buf.length) break;
            if (u32(buf, o) === 0) { local = o; scan++; break; }
          }
          if (local < 0) { log.push(`!! No empty PC box slots left for ${SPECIES[spec.species]?.n || spec.species}.`); continue; }
          buf.set(buildMon(template, spec), local);
          placed++;
          const box = Math.floor((local - 4) / 80 / 30) + 1;
          log.push(`spawned ${SPECIES[spec.species]?.n || `#${spec.species}`} → PC box ${box}`);
        }
        if (placed) {
          // Split the storage blob back into its sections; recompute each one's checksum.
          parts.forEach((p, n) => {
            core.set(buf.subarray(n * DATASZ, (n + 1) * DATASZ), p.off);
            setU16(core, p.off + 0x0ff6, checksum(core, p.off));
          });
        }
      }
    }
  }

  return { log };
}

export function serializeSave(save) {
  const out = new Uint8Array(save.core.length + save.trailer.length);
  out.set(save.core, 0);
  out.set(save.trailer, save.core.length);
  return out;
}
