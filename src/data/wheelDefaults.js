// Default prize-wheel segments, seeded the first time a run opens the Wheel tab (when run.wheel is
// empty). These are community-style soul-link / roguelite rewards tuned to this build's gameplay —
// spawning items & Pokemon (incl. base Megas/Primals via the Rewards tab). All of it is editable in
// the UI: rename, recolor, add, or remove segments. A landed reward is just shown — you carry it out
// yourself in the Rewards tab (spawn) or on the board (log a new reward pair).
//
// TODO(research): refresh this list with the actual Radical Rogue reward pool once web access is
// available — Radical Rogue is the fan-made Radical Red roguelike this run's reward gameplay is based
// on. The set below is a reasonable stand-in until then.
const PALETTE = [
  '#c0444a', '#c79b3b', '#3fae6a', '#4f7d9e', '#8e5bc0', '#c0567a',
  '#4f9e8a', '#9e8b4f', '#6b9e4f', '#4f9e9e', '#8a6f4f', '#5b7fc0',
];

const LABELS = [
  'Base Mega / Primal',
  'Item of choice',
  '10× Rare Candy',
  'Choice item',
  'Revive a Pokémon',
  'Random Pokémon',
  '+1 ReRoll token',
  '+1 Nav token',
  'Master Ball',
  'TM of choice',
  'Full team heal',
  'Wildcard',
];

export const DEFAULT_WHEEL = LABELS.map((label, i) => ({
  id: `w${i + 1}`,
  label,
  color: PALETTE[i % PALETTE.length],
}));

export const WHEEL_PALETTE = PALETTE;
