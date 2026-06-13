import { lazy, Suspense, useMemo, useState } from 'react';
import { useRunContext } from './RunLayout.jsx';
import { store } from '../lib/store.js';
import { LOCATIONS, LOCATION_TYPES } from '../data/locations.js';
import CatchCell from '../components/CatchCell.jsx';

// The save importer drags in the save parser + 84 KB species table, but it's only
// used after the user clicks "Sync save", so load it on demand.
const SaveImport = lazy(() => import('../components/SaveImport.jsx'));

export default function Board() {
  const { run, reload } = useRunContext();
  const [importing, setImporting] = useState(false);
  const players = run.players;

  const catchMap = useMemo(() => {
    const m = {};
    for (const c of run.catches) m[`${c.location_id}:${c.slot}`] = c;
    return m;
  }, [run.catches]);

  const saveCatch = async (loc, slot, fields) => {
    await store.upsertCatch(run.id, {
      id: `${loc.id}:${slot}`,
      location_id: loc.id,
      slot,
      ...fields,
    });
    reload();
  };
  const clearCatch = async (loc, slot) => {
    await store.deleteCatch(run.id, `${loc.id}:${slot}`);
    reload();
  };

  const stats = useMemo(() => {
    const linked = LOCATIONS.filter((l) => catchMap[`${l.id}:1`]?.species && catchMap[`${l.id}:2`]?.species).length;
    const deaths = run.catches.filter((c) => c.status === 'dead').length;
    return { linked, deaths };
  }, [catchMap, run.catches]);

  return (
    <div className="board">
      <div className="board-toolbar">
        <div className="tokens">
          {players.map((p) => {
            const t = run.tokens?.[p.slot] || { nav: 0, reroll: 0 };
            return (
              <div className="token-group" key={p.slot}>
                <span className="pname">{p.name}</span>
                <TokenCtl label="Nav" value={t.nav} onChange={(v) => store.setTokens(run.id, p.slot, { nav: v }).then(reload)} />
                <TokenCtl label="ReRoll" value={t.reroll} onChange={(v) => store.setTokens(run.id, p.slot, { reroll: v }).then(reload)} />
              </div>
            );
          })}
        </div>
        <div className="board-actions">
          <span className="stat">{stats.linked} linked pairs</span>
          <span className="stat dead">{stats.deaths} deaths</span>
          <button className="primary" onClick={() => setImporting(true)}>⤓ Sync save</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="board-table">
          <thead>
            <tr>
              <th className="loc-col">Location</th>
              <th>{players[0].name}</th>
              <th>{players[1].name}</th>
              <th className="link-col">Link</th>
            </tr>
          </thead>
          <tbody>
            {LOCATIONS.map((loc) => {
              const c1 = catchMap[`${loc.id}:1`];
              const c2 = catchMap[`${loc.id}:2`];
              const broken = (c1?.status === 'dead' || c2?.status === 'dead');
              const bothDead = c1?.status === 'dead' && c2?.status === 'dead';
              const lt = LOCATION_TYPES[loc.type];
              return (
                <tr key={loc.id} className={broken && !bothDead ? 'row-broken' : ''}>
                  <td className="loc-col">
                    <span className="loc-badge" style={{ background: lt.color }}>{lt.label}</span>
                    <span className="loc-name">{loc.name}</span>
                    {loc.note && <span className="loc-note" title={loc.note}>ⓘ</span>}
                  </td>
                  <td><CatchCell value={c1} onSave={(f) => saveCatch(loc, 1, f)} onClear={() => clearCatch(loc, 1)} /></td>
                  <td><CatchCell value={c2} onSave={(f) => saveCatch(loc, 2, f)} onClear={() => clearCatch(loc, 2)} /></td>
                  <td className="link-col">
                    {c1?.species && c2?.species ? (
                      bothDead ? <span className="link-icon dead" title="Pair lost">✝</span>
                        : broken ? <span className="link-icon warn" title="One fainted — box the partner!">⚠</span>
                          : <span className="link-icon ok" title="Linked">🔗</span>
                    ) : <span className="link-icon faint">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {importing && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading importer…</div></div>}>
          <SaveImport
            run={run}
            onClose={() => setImporting(false)}
            onImported={reload}
          />
        </Suspense>
      )}
    </div>
  );
}

function TokenCtl({ label, value, onChange }) {
  return (
    <span className="token-ctl">
      <span className="tlabel">{label}</span>
      <button onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <span className="tval">{value}</span>
      <button onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}
