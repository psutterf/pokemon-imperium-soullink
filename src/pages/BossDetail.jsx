import { Link, useParams } from 'react-router-dom';
import bosses from '../data/bosses.json';
import { WEATHER_ICON, STAT_LABELS, statColor, bst } from '../data/bossMeta.js';
import { findSpeciesLoose } from '../lib/dex.js';
import { matchups, TYPE_NAMES, TYPE_COLORS } from '../data/typechart.js';

// Type badges + "weak to" list for a boss Pokémon, resolved from its species.
function MonMatchup({ species, isMega }) {
  const sp = findSpeciesLoose(species);
  if (!sp) return null;
  const { weak } = matchups(sp.t);
  return (
    <div className="mon-matchup">
      <div className="mon-types">
        {sp.t.map((t) => <span key={t} className="type-badge" style={{ background: TYPE_COLORS[TYPE_NAMES[t]] }}>{TYPE_NAMES[t]}</span>)}
        {isMega && <span className="approx" title="Base-form typing shown; a Mega's typing may differ">~</span>}
      </div>
      {weak.length > 0 && (
        <div className="mon-weak">
          <span className="mw-label">Weak</span>
          {weak.map((w) => (
            <span key={w.type} className="mw-type" style={{ background: TYPE_COLORS[w.name] }}>{w.name}{w.mult > 2 ? '×4' : ''}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BossDetail() {
  const { runId, order } = useParams();
  const boss = bosses[Number(order)];
  if (!boss) return <div className="loading">Boss not found — <Link to={`/run/${runId}/bosses`}>back to guide</Link></div>;

  return (
    <div className="boss-detail">
      <div className="boss-detail-head">
        <Link to={`/run/${runId}/bosses`} className="back">← Boss Guide</Link>
        <h1>{boss.name}</h1>
        <div className="boss-tags">
          <span className="tag">{boss.category}</span>
          <span className="tag">{boss.phaseLabel}</span>
          {boss.levelCap && <span className="tag cap">Level cap {boss.levelCap}</span>}
          {boss.weather && (
            <span className="tag weather">
              {WEATHER_ICON[boss.weather]} {boss.permanentWeather ? 'Permanent ' : ''}{boss.weather}
            </span>
          )}
        </div>
      </div>

      <div className="team-grid">
        {boss.pokemon.map((p, i) => (
          <div key={i} className={`mon-card ${p.mega ? 'mega' : ''}`}>
            <div className="mon-card-head">
              <h3>{p.species}{p.mega && <span className="mega-badge">MEGA</span>}</h3>
              <span className="lvl">{p.level ? `Lv ${p.level}` : p.levelText || ''}</span>
            </div>
            <MonMatchup species={p.species} isMega={p.mega} />

            <div className="mon-attrs">
              {p.item && <span className="attr item">@ {p.item}</span>}
              {p.ability && <span className="attr">{p.ability}</span>}
              {p.nature && <span className="attr">{p.nature}</span>}
            </div>

            {p.baseStats && (
              <div className="statbars">
                <div className="stat-head">
                  <span>Base stats</span>
                  <span className="bst">BST {bst(p.baseStats)}{p.statsApprox && <span className="approx" title="Name shared by multiple forms — base form shown">~</span>}</span>
                </div>
                {p.baseStats.map((v, k) => (
                  <div className="statbar" key={k}>
                    <span className="stat-l">{STAT_LABELS[k]}</span>
                    <span className="stat-v">{v}</span>
                    <span className="stat-track"><span className="stat-fill" style={{ width: `${Math.min(100, (v / 200) * 100)}%`, background: statColor(v) }} /></span>
                  </div>
                ))}
              </div>
            )}

            {(p.ivs || p.evs) && (
              <div className="mon-spreads">
                {p.evs && <span>EVs: {p.evs}</span>}
                {p.ivs && <span>IVs: {p.ivs}</span>}
              </div>
            )}
            <ul className="moves">
              {p.moves.map((mv, j) => <li key={j}>{mv}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
