// Validates src/lib/saveEditor.js against the real Imperium save.
//   node scripts/test-save-editor.mjs           # dry-run on a COPY, verify, never touch original
//   node scripts/test-save-editor.mjs --apply    # edit the REAL save (timestamped backup first)
//
// Test payload: spawn Primal Groudon (species 955, base ability Desolate Land) + 5 Red Orbs.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { loadSave, applyEdits, serializeSave, POCKETS } from '../src/lib/saveEditor.js';
import { parseSave } from '../src/lib/saveParser.js';
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';

const SAV = 'C:/Users/parke/Pokemon Docs/Pokemon Imperium v1.1.sav';
const APPLY = process.argv.includes('--apply');

const SIG = 0x08012025, DATASZ = 0x0ff4;
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const ORDER = ('GAEM GAME GEAM GEMA GMAE GMEA AGEM AGME AEGM AEMG AMGE AMEG ' +
  'EGAM EGMA EAGM EAMG EMGA EMAG MGAE MGEA MAGE MAEG MEGA MEAG').split(' ');

let fails = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails++; };

function sections(core) {
  const secs = {};
  for (let i = 0; i < 32; i++) { const off = i * 0x1000; if (u32(core, off + 0x0ff8) === SIG) secs[u16(core, off + 0x0ff4)] = off; }
  return secs;
}
function allChecksumsValid(core) {
  const secs = sections(core);
  for (const id of Object.keys(secs)) {
    const off = secs[id];
    let c = 0; for (let i = 0; i < DATASZ; i += 4) c = (c + u32(core, off + i)) >>> 0;
    if ((((c >>> 16) + (c & 0xffff)) & 0xffff) !== u16(core, off + 0x0ff6)) return false;
  }
  return true;
}
// Read a bag pocket: returns Map(itemId -> qty).
function readPocket(core, pocket) {
  const secs = sections(core);
  const sb1 = new Uint8Array(4 * DATASZ);
  [1, 2, 3, 4].forEach((id, n) => sb1.set(core.subarray(secs[id], secs[id] + DATASZ), n * DATASZ));
  const key16 = u32(core, secs[0] + 0x44) & 0xffff;
  const [base, count] = POCKETS[pocket];
  const m = new Map();
  for (let s = 0; s < count; s++) { const a = base + s * 4; const id = u16(sb1, a); if (id) m.set(id, (u16(sb1, a + 2) ^ key16) & 0xffff); }
  return m;
}
// Fully decode a box mon's editable fields for verification.
function decodeBoxMon(blk) {
  const pid = u32(blk, 0), otid = u32(blk, 4), key = (pid ^ otid) >>> 0;
  const dec = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) { const w = (u32(blk, 0x20 + i) ^ key) >>> 0; dec[i] = w & 0xff; dec[i + 1] = (w >> 8) & 0xff; dec[i + 2] = (w >> 16) & 0xff; dec[i + 3] = (w >> 24) & 0xff; }
  const order = ORDER[pid % 24];
  const at = (t) => order.indexOf(t) * 12;
  const G = at('G'), A = at('A'), E = at('E'), M = at('M');
  return {
    pid, nature: pid % 25,
    species: u16(dec, G) & 0x7ff, heldItem: u16(dec, G + 2), exp: u32(dec, G + 4), ppUps: dec[G + 8],
    moves: [u16(dec, A), u16(dec, A + 2), u16(dec, A + 4), u16(dec, A + 6)], pp: [dec[A + 8], dec[A + 9], dec[A + 10], dec[A + 11]],
    evs: [dec[E], dec[E + 1], dec[E + 2], dec[E + 3], dec[E + 4], dec[E + 5]],
    metLevel: u16(dec, M + 2) & 0x7f, ivWord: u32(dec, M + 4), abilityNum: (u32(dec, M + 4) >>> 31) & 1,
  };
}

// ---- before snapshot ----
const original = new Uint8Array(readFileSync(SAV));
const before = parseSave(original);
const beforeRedOrb = readPocket(original, 'items').get(290) || 0;
console.log(`\nBEFORE: party=${before.party.length} boxes=${before.boxes.length} | Red Orb x${beforeRedOrb}\n`);

// ---- edit a copy in memory ----
const save = loadSave(original.slice());
const { log } = applyEdits(save, {
  items: [{ id: 290, qty: 5, pocket: 'items' }],
  pokemon: [{ species: 955, abilityNum: 0, moveIds: [] }], // Primal Groudon, Desolate Land slot, default Tackle
});
console.log('EDIT LOG:'); log.forEach((l) => console.log('  ' + l));
const edited = serializeSave(save);
console.log('');

// ---- verify ----
check('output size unchanged', edited.length === original.length, `${edited.length} vs ${original.length}`);
check('all section checksums valid', allChecksumsValid(edited));

const after = parseSave(edited);
check('party untouched (count)', after.party.length === before.party.length);
check('party untouched (species)', JSON.stringify(after.party.map((p) => p.species)) === JSON.stringify(before.party.map((p) => p.species)));
check('exactly one new box mon', after.boxes.length === before.boxes.length + 1, `${before.boxes.length} → ${after.boxes.length}`);

const groudon = after.boxes.find((b) => b.species === 955);
check('Primal Groudon (955) present in a box', !!groudon, groudon ? `box ${groudon.box}, "${groudon.nickname}"` : 'not found');

// existing boxes unchanged (compare the multiset of species excluding the one new mon)
const beforeSpecies = before.boxes.map((b) => b.species).sort((a, b) => a - b);
const afterSpeciesMinusNew = after.boxes.map((b) => b.species).sort((a, b) => a - b);
const idx = afterSpeciesMinusNew.indexOf(955);
if (idx >= 0) afterSpeciesMinusNew.splice(idx, 1);
check('existing boxed Pokémon unchanged', JSON.stringify(beforeSpecies) === JSON.stringify(afterSpeciesMinusNew));

// deep-decode the spawned mon
const secs = sections(save.core);
// find it raw to decode fully
let raw = null;
for (const id of Object.keys(secs).map(Number)) {
  if (id <= 4) continue;
  const off = secs[id];
  for (let o = 0; o <= DATASZ - 80; o += 4) {
    const blk = save.core.subarray(off + o, off + o + 80);
    if (u32(blk, 0) !== 0) { const sp = u16(new Uint8Array(48), 0); void sp; }
  }
}
if (groudon) {
  // re-locate the exact 80 bytes by scanning for species 955 with valid checksum
  outer: for (const id of Object.keys(secs).map(Number)) {
    if (id <= 4) continue; const off = secs[id];
    for (let o = 0; o <= DATASZ - 80; o += 4) {
      const blk = save.core.slice(off + o, off + o + 80);
      const d = decodeBoxMon(blk);
      if (d.species === 955 && d.exp === 0) { raw = d; break outer; }
    }
  }
}
if (raw) {
  console.log('\nSPAWNED MON:', JSON.stringify({ ...raw, ivWord: '0x' + raw.ivWord.toString(16) }));
  check('  species = Primal Groudon (955)', raw.species === 955);
  check('  level 1 (exp 0)', raw.exp === 0);
  check('  neutral nature (Hardy=0)', raw.nature === 0);
  check('  ability slot 0 (Desolate Land base)', raw.abilityNum === 0);
  check('  knows only Tackle (33)', JSON.stringify(raw.moves) === JSON.stringify([33, 0, 0, 0]), `moves=${raw.moves}`);
  check('  Tackle PP = 35', raw.pp[0] === (MOVES[33]?.pp ?? 35));
  check('  no held item', raw.heldItem === 0);
  check('  zero EVs', raw.evs.every((e) => e === 0));
  check('  met level 1', raw.metLevel === 1);
  check('  perfect IVs', (raw.ivWord & 0x3fffffff) === 0x3fffffff);
} else { check('spawned mon deep-decode', false, 'could not relocate'); }

// items
const afterRedOrb = readPocket(edited, 'items').get(290) || 0;
check('Red Orb x5 in Items pocket', afterRedOrb === beforeRedOrb + 5, `${beforeRedOrb} → ${afterRedOrb}`);
// other bag items unchanged
const b4 = readPocket(original, 'items'), af = readPocket(edited, 'items');
let othersOk = true;
for (const [id, q] of b4) if (id !== 290 && af.get(id) !== q) othersOk = false;
check('other Items-pocket entries unchanged', othersOk);

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'}\n`);

if (APPLY) {
  if (fails) { console.log('Refusing to --apply: checks failed.'); process.exit(1); }
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const bak = `${SAV}.bak_${stamp}`;
  copyFileSync(SAV, bak);
  writeFileSync(SAV, edited);
  console.log(`APPLIED to real save. Backup: ${bak}`);
} else {
  process.exit(fails ? 1 : 0);
}
