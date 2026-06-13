// Type ids match the ROM extraction (TYPE_NONE=0, Normal=1 … Fairy=19; 10 = the unused
// "Mystery" slot). Gen 6+ effectiveness chart, used for matchup display and the damage calc.

export const TYPE_NAMES = {
  1: 'Normal', 2: 'Fighting', 3: 'Flying', 4: 'Poison', 5: 'Ground', 6: 'Rock',
  7: 'Bug', 8: 'Ghost', 9: 'Steel', 11: 'Fire', 12: 'Water', 13: 'Grass',
  14: 'Electric', 15: 'Psychic', 16: 'Ice', 17: 'Dragon', 18: 'Dark', 19: 'Fairy',
};

export const TYPE_COLORS = {
  Normal: '#9099a1', Fighting: '#ce4069', Flying: '#8fa9de', Poison: '#ab6ac8',
  Ground: '#d97746', Rock: '#c7b78b', Bug: '#90c12c', Ghost: '#5269ac',
  Steel: '#5a8ea1', Fire: '#ff9d55', Water: '#4d90d5', Grass: '#63bb5b',
  Electric: '#f4d23c', Psychic: '#f97176', Ice: '#73cec0', Dragon: '#0b6dc3',
  Dark: '#5a5366', Fairy: '#ec8fe6',
};

const NAME_ID = Object.fromEntries(Object.entries(TYPE_NAMES).map(([id, n]) => [n, +id]));

// attacker -> { defender: multiplier } for non-1× matchups only.
const REL = {
  Normal: { Rock: 0.5, Steel: 0.5, Ghost: 0 },
  Fighting: { Normal: 2, Rock: 2, Steel: 2, Ice: 2, Dark: 2, Flying: 0.5, Poison: 0.5, Bug: 0.5, Psychic: 0.5, Fairy: 0.5, Ghost: 0 },
  Flying: { Fighting: 2, Bug: 2, Grass: 2, Rock: 0.5, Steel: 0.5, Electric: 0.5 },
  Poison: { Grass: 2, Fairy: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0 },
  Ground: { Poison: 2, Rock: 2, Steel: 2, Fire: 2, Electric: 2, Bug: 0.5, Grass: 0.5, Flying: 0 },
  Rock: { Flying: 2, Bug: 2, Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Steel: 0.5 },
  Bug: { Grass: 2, Psychic: 2, Dark: 2, Fighting: 0.5, Flying: 0.5, Poison: 0.5, Ghost: 0.5, Steel: 0.5, Fire: 0.5, Fairy: 0.5 },
  Ghost: { Ghost: 2, Psychic: 2, Dark: 0.5, Normal: 0 },
  Steel: { Rock: 2, Ice: 2, Fairy: 2, Steel: 0.5, Fire: 0.5, Water: 0.5, Electric: 0.5 },
  Fire: { Bug: 2, Steel: 2, Grass: 2, Ice: 2, Rock: 0.5, Fire: 0.5, Water: 0.5, Dragon: 0.5 },
  Water: { Ground: 2, Rock: 2, Fire: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Grass: { Ground: 2, Rock: 2, Water: 2, Flying: 0.5, Poison: 0.5, Bug: 0.5, Steel: 0.5, Fire: 0.5, Grass: 0.5, Dragon: 0.5 },
  Electric: { Flying: 2, Water: 2, Grass: 0.5, Electric: 0.5, Dragon: 0.5, Ground: 0 },
  Psychic: { Fighting: 2, Poison: 2, Steel: 0.5, Psychic: 0.5, Dark: 0 },
  Ice: { Flying: 2, Ground: 2, Grass: 2, Dragon: 2, Steel: 0.5, Fire: 0.5, Water: 0.5, Ice: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Ghost: 2, Psychic: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Fairy: { Fighting: 2, Dragon: 2, Dark: 2, Poison: 0.5, Steel: 0.5, Fire: 0.5 },
};

// CHART[atkId][defId] = multiplier (defaults to 1).
export const CHART = {};
for (const [atk, rels] of Object.entries(REL)) {
  const a = NAME_ID[atk];
  CHART[a] = {};
  for (const def of Object.values(TYPE_NAMES)) CHART[a][NAME_ID[def]] = rels[def] ?? 1;
}

// Effectiveness of one attacking type against a defender's type array.
export function effectiveness(atkType, defTypes) {
  if (!atkType || !CHART[atkType]) return 1;
  let m = 1;
  for (const d of defTypes) m *= CHART[atkType][d] ?? 1;
  return m;
}

// Group a defender's type array into weaknesses / resistances / immunities (by attacking type).
export function matchups(defTypes) {
  const weak = [], resist = [], immune = [];
  for (const id of Object.keys(TYPE_NAMES).map(Number)) {
    const m = effectiveness(id, defTypes);
    const entry = { type: id, name: TYPE_NAMES[id], mult: m };
    if (m === 0) immune.push(entry);
    else if (m > 1) weak.push(entry);
    else if (m < 1) resist.push(entry);
  }
  weak.sort((a, b) => b.mult - a.mult);
  resist.sort((a, b) => a.mult - b.mult);
  return { weak, resist, immune };
}
