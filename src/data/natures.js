// 25 natures. `up`/`down` are indices into the base-stat array [HP,Atk,Def,Spe,SpA,SpD]
// (HP is never affected). A neutral nature has up === down (no effect).
// Multiplier: 1.1 on `up`, 0.9 on `down`.
const A = 1, D = 2, S = 3, SA = 4, SD = 5; // stat indices

export const NATURES = {
  Hardy: { up: A, down: A }, Lonely: { up: A, down: D }, Brave: { up: A, down: S },
  Adamant: { up: A, down: SA }, Naughty: { up: A, down: SD },
  Bold: { up: D, down: A }, Docile: { up: D, down: D }, Relaxed: { up: D, down: S },
  Impish: { up: D, down: SA }, Lax: { up: D, down: SD },
  Timid: { up: S, down: A }, Hasty: { up: S, down: D }, Serious: { up: S, down: S },
  Jolly: { up: S, down: SA }, Naive: { up: S, down: SD },
  Modest: { up: SA, down: A }, Mild: { up: SA, down: D }, Quiet: { up: SA, down: S },
  Bashful: { up: SA, down: SA }, Rash: { up: SA, down: SD },
  Calm: { up: SD, down: A }, Gentle: { up: SD, down: D }, Sassy: { up: SD, down: S },
  Careful: { up: SD, down: SA }, Quirky: { up: SD, down: SD },
};

export const NATURE_LIST = Object.keys(NATURES);

// In-game nature id (0–24, derived from PID) -> name. NATURE_LIST is in enum order.
export const natureName = (id) => NATURE_LIST[id] || '';

// Per-stat nature multiplier (1.1 / 0.9 / 1) for stat index `i`.
export function natureMult(natureName, i) {
  const n = NATURES[natureName];
  if (!n || n.up === n.down) return 1;
  if (i === n.up) return 1.1;
  if (i === n.down) return 0.9;
  return 1;
}
