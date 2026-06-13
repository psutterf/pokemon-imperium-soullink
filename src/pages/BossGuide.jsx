import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import bosses from '../data/bosses.json';
import { WEATHER_ICON } from '../data/bossMeta.js';

export default function BossGuide() {
  const { runId } = useParams();
  const [q, setQ] = useState('');

  // Group by progression phase (which gym you're up to), ordered by phase index.
  const phases = useMemo(() => {
    const filtered = q
      ? bosses.filter((b) =>
          b.name.toLowerCase().includes(q.toLowerCase()) ||
          b.pokemon.some((p) => p.species.toLowerCase().includes(q.toLowerCase())))
      : bosses;
    const map = new Map();
    for (const b of filtered) {
      if (!map.has(b.phase)) map.set(b.phase, { label: b.phaseLabel, list: [] });
      map.get(b.phase).list.push(b);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [q]);

  return (
    <div className="boss-guide">
      <div className="boss-toolbar">
        <input className="search" placeholder="Search boss or Pokémon…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{bosses.length} bosses · ordered by where you are in the game</span>
      </div>

      {phases.map((ph) => (
        <section key={ph.label} className="boss-category">
          <h2>{ph.label}</h2>
          <div className="boss-cards">
            {ph.list.map((b) => (
              <Link key={b.order} to={`/run/${runId}/bosses/${b.order}`} className="boss-card">
                <div className="boss-card-head">
                  <h3>{b.name}</h3>
                  <span className="card-badges">
                    {b.weather && <span className="weather-badge" title={`${b.permanentWeather ? 'Permanent ' : ''}${b.weather}`}>{WEATHER_ICON[b.weather] || '🌀'}</span>}
                    {b.levelCap && <span className="cap">Lv{b.levelCap}</span>}
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
