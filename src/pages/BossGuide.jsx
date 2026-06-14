import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import bosses from '../data/bosses.json';
import { WEATHER_ICON } from '../data/bossMeta.js';

const isLeader = (b) => (b.category === 'Hoenn Leaders' ? 1 : 0);

// Scaled bosses (no level cap) can't be slotted into a gym phase, so they're grouped by
// category after the gym progression, in this order.
const SCALED_ORDER = ['Sinnoh Leaders', 'Rivals', 'Team Aqua', 'Team Magma', 'Mini bosses', 'Trick House', 'Hot House', 'Optional Bosses'];
const SCALED_LABEL = {
  'Sinnoh Leaders': 'Sinnoh Gym Leaders', 'Rivals': 'Rivals', 'Team Aqua': 'Team Aqua',
  'Team Magma': 'Team Magma', 'Mini bosses': 'Mini Bosses', 'Trick House': 'Trick House',
  'Hot House': 'Hot House', 'Optional Bosses': 'Optional Bosses',
};

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

    // Gym/story phases (have a level cap): group by phase, gym leader shown LAST.
    const phased = new Map();
    const scaled = new Map();
    for (const b of filtered) {
      if (b.phase === 10) {
        if (!scaled.has(b.category)) scaled.set(b.category, []);
        scaled.get(b.category).push(b);
      } else {
        if (!phased.has(b.phase)) phased.set(b.phase, { label: b.phaseLabel, list: [] });
        phased.get(b.phase).list.push(b);
      }
    }
    const phasedSecs = [...phased.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({
      label: v.label,
      list: v.list.slice().sort((x, y) => (isLeader(x) - isLeader(y)) || (x.order - y.order)),
    }));

    // Scaled bosses grouped by category, in a defined order (then any leftovers).
    const scaledSecs = [];
    const seen = new Set();
    for (const cat of SCALED_ORDER) {
      if (scaled.has(cat)) { scaledSecs.push({ label: SCALED_LABEL[cat] || cat, scaled: true, list: scaled.get(cat).slice().sort((a, b) => a.order - b.order) }); seen.add(cat); }
    }
    for (const [cat, list] of scaled) if (!seen.has(cat)) scaledSecs.push({ label: cat, scaled: true, list });
    if (scaledSecs.length) scaledSecs[0].divider = true;
    return [...phasedSecs, ...scaledSecs];
  }, [q]);

  return (
    <div className="boss-guide">
      <div className="boss-toolbar">
        <input className="search" placeholder="Search boss or Pokémon…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{bosses.length} bosses · gym order, then scaled bosses by type</span>
      </div>

      {sections.map((sec) => (
        <div key={sec.label}>
          {sec.divider && (
            <div className="scaled-divider">
              <span>Scaled bosses</span>
              <p className="muted small">These scale to your level, so they aren't tied to a gym — grouped by type.</p>
            </div>
          )}
          <section className="boss-category">
            <h2>{sec.label}{sec.scaled && <span className="scaled-tag">scaled</span>}</h2>
            <div className="boss-cards">
              {sec.list.map((b) => (
                <Link key={b.order} to={`/run/${runId}/bosses/${b.order}`} className="boss-card">
                  <div className="boss-card-head">
                    <h3>{b.name}</h3>
                    <span className="card-badges">
                      {b.weather && <span className="weather-badge" title={`${b.permanentWeather ? 'Permanent ' : ''}${b.weather}`}>{WEATHER_ICON[b.weather] || '🌀'}</span>}
                      {b.levelCap ? <span className="cap">Lv{b.levelCap}</span> : <span className="cap scaled">scaled</span>}
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
        </div>
      ))}
    </div>
  );
}
