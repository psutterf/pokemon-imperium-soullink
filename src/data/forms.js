// Mega evolutions & Primal reversions.
// In Imperium's pokeemerald-expansion gSpeciesInfo these occupy one contiguous species-id block
// (906-955) and each SHARES its base species' name in the ROM — e.g. Primal Groudon is just
// "Groudon" at id 955, Mega Charizard X/Y are both "Charizard" (907/908). The spawner therefore
// couldn't tell them apart (only a "BST 770" subtitle hinted at the form). This module gives each
// a proper label ("Mega Charizard X", "Primal Groudon") so they're searchable/pickable.
// Block layout verified entry-by-entry against the species dump 2026-06-16; 956+ are Alolan/other
// regional forms (out of scope here). Spawning these stores the form as a permanent species — the
// same mechanism that produced the already-verified Primal Groudon (#955).
import { SPECIES } from './species.js';

const MEGA_START = 906;
const MEGA_END = 955;
const PRIMAL = new Set([954, 955]);                  // Primal Kyogre, Primal Groudon
const XY = { 907: 'X', 908: 'Y', 919: 'X', 920: 'Y' }; // Mega Charizard X/Y, Mega Mewtwo X/Y

// id -> form label, derived from the species' base name so it can't drift from the data.
export const FORM_NAMES = {};
for (let id = MEGA_START; id <= MEGA_END; id++) {
  const sp = SPECIES[id];
  if (!sp) continue;
  const prefix = PRIMAL.has(id) ? 'Primal' : 'Mega';
  const suffix = XY[id] ? ` ${XY[id]}` : '';
  FORM_NAMES[id] = `${prefix} ${sp.n}${suffix}`;
}

export const FORM_IDS = Object.keys(FORM_NAMES).map(Number);
