// Reusable detail block for a single Pokémon: typing, base stats (with nature arrows),
// ability (+ tags), and type weaknesses / resistances / immunities. Pure/presentational —
// resolves everything from the species name + the tracked fields on a catch.
import { resolveCatch } from '../lib/dex.js';
import { matchups, TYPE_COLORS } from '../data/typechart.js';
import { NATURES } from '../data/natures.js';
import { abilityTags, weatherOf } from '../data/abilityTags.js';
import { STAT_LABELS, statColor, bst } from '../data/bossMeta.js';

function TypeBadge({ name }) {
  return <span className="type-badge" style={{ background: TYPE_COLORS[name] || '#666' }}>{name}</span>;
}

export default function PokemonDetail({ value }) {
  const dex = resolveCatch(value);
  if (!dex) {
    return <p className="muted">No base-stat data for “{value?.species || '—'}”. (Rename it to a recognised species to see details.)</p>;
  }
  const { weak, resist, immune } = matchups(dex.types);
  const nat = value.nature ? NATURES[value.nature] : null;
  const natArrow = (i) => (!nat || nat.up === nat.down ? '' : i === nat.up ? '▲' : i === nat.down ? '▼' : '');
  const tags = abilityTags(value.ability);

  return (
    <div className="pkmn-detail">
      <div className="pd-head">
        <div className="pd-title">
          <strong>{dex.name}</strong>
          {value.nickname && <em> “{value.nickname}”</em>}
          {value.level ? <span className="muted"> · Lv{value.level}</span> : null}
        </div>
        <div className="pd-types">{dex.typeNames.map((t) => <TypeBadge key={t} name={t} />)}</div>
      </div>

      <div className="pd-meta">
        {value.ability && (
          <span className="pd-ability">
            {value.ability}
            {weatherOf(value.ability) && <span className="ab-tag">🌦 {weatherOf(value.ability)}</span>}
            {tags.includes('statChange') && <span className="ab-tag">📊 stat changer</span>}
          </span>
        )}
        {value.nature && <span className="muted">{value.nature} nature</span>}
      </div>

      <div className="pd-stats">
        {dex.baseStats.map((v, i) => (
          <div className="pd-stat" key={i}>
            <span className="pd-stat-lbl">{STAT_LABELS[i]}{natArrow(i)}</span>
            <span className="pd-stat-val">{v}</span>
            <span className="pd-bar"><span style={{ width: `${Math.min(100, (v / 200) * 100)}%`, background: statColor(v) }} /></span>
          </div>
        ))}
        <div className="pd-bst">BST <strong>{bst(dex.baseStats)}</strong></div>
      </div>

      <div className="pd-matchups">
        <MatchupRow label="Weak to" entries={weak} />
        <MatchupRow label="Resists" entries={resist} />
        {immune.length > 0 && <MatchupRow label="Immune" entries={immune} />}
      </div>
    </div>
  );
}

function MatchupRow({ label, entries }) {
  if (!entries.length) return null;
  return (
    <div className="mu-row">
      <span className="mu-label">{label}</span>
      <span className="mu-types">
        {entries.map((e) => (
          <span key={e.type} className="mu-type" style={{ background: TYPE_COLORS[e.name] || '#666' }}>
            {e.name}{e.mult !== 1 && e.mult !== 0 ? ` ×${e.mult}` : ''}
          </span>
        ))}
      </span>
    </div>
  );
}
