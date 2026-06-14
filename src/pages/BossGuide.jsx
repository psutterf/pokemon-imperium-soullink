import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import bosses from '../data/bosses.json';
import { WEATHER_ICON } from '../data/bossMeta.js';

// Bosses that aren't required to beat the game get an "optional" tag.
const OPTIONAL_CATEGORIES = new Set(['Sinnoh Leaders', 'Mini bosses', 'Trick House', 'Hot House', 'Optional Bosses']);
const isOptional = (b) => OPTIONAL_CATEGORIES.has(b.category);

// Scaled bosses have no level, so estimate a progression point from the team's average base-stat
// total, calibrated against the capped bosses (weak teams ≈ early game, strong teams ≈ late game).
const BST_ANCHORS = [[300, 10], [340, 15], [430, 25], [460, 30], [500, 34], [525, 44], [560, 60], [600, 85], [700, 99]];
function estimateCap(b) {
  const vals = b.pokemon.map((p) => (p.baseStats ? p.baseStats.reduce((a, c) => a + c, 0) : 0)).filter(Boolean);
  if (!vals.length) return 50;
  const bst = vals.reduce((a, c) => a + c, 0) / vals.length;
  if (bst <= BST_ANCHORS[0][0]) return BST_ANCHORS[0][1];
  for (let i = 1; i < BST_ANCHORS.length; i++) {
    if (bst <= BST_ANCHORS[i][0]) {
      const [x0, y0] = BST_ANCHORS[i - 1], [x1, y1] = BST_ANCHORS[i];
      return Math.round(y0 + (y1 - y0) * (bst - x0) / (x1 - x0));
    }
  }
  return 99;
}
const progressionCap = (b) => (b.levelCap || estimateCap(b));

// Gym windows: a boss belongs to the section of the next gym at/above its progression level.
const WINDOWS = [
  [15, 'Up to Gym 1 — Roxanne'], [25, 'Up to Gym 2 — Brawly'], [34, 'Up to Gym 3 — Wattson'],
  [47, 'Up to Gym 4 — Flannery'], [59, 'Up to Gym 5 — Norman'], [68, 'Up to Gym 6 — Winona'],
  [76, 'Up to Gym 7 — Tate & Liza'], [82, 'Up to Gym 8 — Juan'], [Infinity, 'Endgame — Victory Road & Elite Four'],
];
const windowLabel = (cap) => WINDOWS.find(([max]) => cap <= max)[1];

export default function BossGuide() {
  const { runId } = useParams();
  const [q, setQ] = useState('');

  const sections = useMemo(() => {
    const ql = q.toLowerCase();
    const filtered = ql
      ? bosses.filter((b) =>
          b.name.toLowerCase().includes(ql) ||
          b.pokemon.some((p) => p.species.toLowerCase().includes(ql)))
      : bosses;

    const withCap = filtered.map((b) => ({ b, cap: progressionCap(b) }))
      .sort((x, y) => x.cap - y.cap || isOptional(x.b) - isOptional(y.b));

    const order = WINDOWS.map(([, label]) => label);
    const map = new Map();
    for (const { b, cap } of withCap) {
      const label = windowLabel(cap);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(b);
    }
    return order.filter((l) => map.has(l)).map((label) => ({ label, list: map.get(label) }));
  }, [q]);

  return (
    <div className="boss-guide">
      <div className="boss-toolbar">
        <input className="search" placeholder="Search boss or Pokémon…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{bosses.length} bosses · in progression order (early game → late)</span>
      </div>

      {sections.map((sec) => (
        <section key={sec.label} className="boss-category">
          <h2>{sec.label}</h2>
          <div className="boss-cards">
            {sec.list.map((b) => (
              <Link key={b.order} to={`/run/${runId}/bosses/${b.order}`} className="boss-card">
                <div className="boss-card-head">
                  <h3>{b.name}</h3>
                  <span className="card-badges">
                    {isOptional(b) && <span className="opt-badge" title="Optional boss">optional</span>}
                    {b.weather && <span className="weather-badge" title={`${b.permanentWeather ? 'Permanent ' : ''}${b.weather}`}>{WEATHER_ICON[b.weather] || '🌀'}</span>}
                    {b.levelCap ? <span className="cap">Lv{b.levelCap}</span> : <span className="cap scaled" title="Scales to your level; position estimated from team strength">~Lv{estimateCap(b)}</span>}
                  </span>
                </div>
                <span className="cat-tag">{b.category}</span>
                <div className="boss-team-mini">
                  {b.pokemon.map((p, i) => (
                    <span key={i} className={`mini ${p.mega ? 'mega' : ''}`}>{p.species}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
