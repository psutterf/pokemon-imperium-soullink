import { useState } from 'react';

// Soul-link team builder. The team is a set of up to 6 location *rows* (run.team holds the
// location ids). Because pairs are linked by row, choosing a location fixes both players'
// team slots at once — pick yours, the partner's is derived. Add/remove via the ★ on board
// rows or the ✕ here. Warns when a slot's partner is missing, dead, or boxed.
const STATUS_LABEL = { dead: 'DEAD', boxed: 'boxed', voided: 'voided' };

function Slot({ c }) {
  if (!c?.species) return <span className="team-mon empty">— no catch —</span>;
  const warn = STATUS_LABEL[c.status];
  return (
    <span className={`team-mon ${c.status === 'dead' ? 'dead' : ''}`}>
      <span className="tm-name">{c.species}</span>
      {c.nickname && <span className="tm-nick">“{c.nickname}”</span>}
      {c.ability && <span className="tm-ability">{c.ability}</span>}
      {warn && <span className="tm-warn">{warn}</span>}
    </span>
  );
}

export default function TeamPanel({ run, team, locations, catchMap, onToggle }) {
  const [open, setOpen] = useState(false);
  const players = run.players;
  const byId = Object.fromEntries(locations.map((l) => [l.id, l]));
  const rows = team.map((id) => ({ loc: byId[id], c1: catchMap[`${id}:1`], c2: catchMap[`${id}:2`] }))
    .filter((r) => r.loc);

  return (
    <div className={`team-panel ${open ? 'open' : ''}`}>
      <button className="team-head" onClick={() => setOpen((o) => !o)}>
        <span>{open ? '▾' : '▸'} Team builder</span>
        <span className="team-count">{rows.length}/6</span>
      </button>
      {open && (
        <div className="team-body">
          {rows.length === 0 && (
            <p className="muted small">Tap the ☆ on any row below to add that linked pair to your team (up to 6).
              Pick your six and your partner's six are decided automatically.</p>
          )}
          {rows.length > 0 && (
            <div className="team-grid">
              <div className="team-col-head">{players[0].name}</div>
              <div className="team-col-head">{players[1].name}</div>
              <div className="team-col-head" />
              {rows.map(({ loc, c1, c2 }) => (
                <div className="team-row-wrap" key={loc.id} style={{ display: 'contents' }}>
                  <Slot c={c1} />
                  <Slot c={c2} />
                  <div className="team-loc">
                    <span className="muted small">{loc.name}</span>
                    <button className="x small" title="Remove from team" onClick={() => onToggle(loc.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
