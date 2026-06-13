import { lazy, Suspense, useMemo, useState } from 'react';
import { useRunContext } from './runContext.js';
import { store } from '../lib/store.js';
import { buildLocations, LOCATION_TYPES } from '../data/locations.js';
import { resolveCatch } from '../lib/dex.js';
import { abilityTags, TAG_LABELS } from '../data/abilityTags.js';
import { STAT_LABELS } from '../data/bossMeta.js';
import CatchCell from '../components/CatchCell.jsx';
import TeamPanel from '../components/TeamPanel.jsx';

// The save importer drags in the save parser + species table, but it's only
// used after the user clicks "Sync save", so load it on demand.
const SaveImport = lazy(() => import('../components/SaveImport.jsx'));

const TEAM_MAX = 6;

export default function Board() {
  const { run, reload } = useRunContext();
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [statSort, setStatSort] = useState(''); // '' or stat index 0-5
  const [tagFilter, setTagFilter] = useState(() => new Set());
  const players = run.players;

  const locations = useMemo(() => buildLocations(run.egg_count), [run.egg_count]);
  const team = run.team || [];

  const catchMap = useMemo(() => {
    const m = {};
    for (const c of run.catches) m[`${c.location_id}:${c.slot}`] = c;
    return m;
  }, [run.catches]);

  const saveCatch = async (loc, slot, fields) => {
    await store.upsertCatch(run.id, { id: `${loc.id}:${slot}`, location_id: loc.id, slot, ...fields });
    reload();
  };
  const clearCatch = async (loc, slot) => {
    await store.deleteCatch(run.id, `${loc.id}:${slot}`);
    reload();
  };
  const setEggCount = (n) => store.updateRun(run.id, { egg_count: Math.max(1, Math.min(24, n)) }).then(reload);
  const toggleTeam = (locId) => {
    const next = team.includes(locId) ? team.filter((x) => x !== locId)
      : team.length >= TEAM_MAX ? team : [...team, locId];
    store.updateRun(run.id, { team: next }).then(reload);
  };
  const toggleTag = (tag) => setTagFilter((s) => {
    const n = new Set(s); n.has(tag) ? n.delete(tag) : n.add(tag); return n;
  });

  const stats = useMemo(() => {
    const linked = locations.filter((l) => catchMap[`${l.id}:1`]?.species && catchMap[`${l.id}:2`]?.species).length;
    const deaths = run.catches.filter((c) => c.status === 'dead').length;
    return { linked, deaths };
  }, [locations, catchMap, run.catches]);

  // Build the rows (location + both catches), then apply search / tag filter / stat sort.
  // Filtering is row-based so a matching mon always brings its linked partner along.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tags = tagFilter;
    const statIdx = statSort === '' ? null : Number(statSort);
    const matchText = (c) => c && [c.species, c.nickname, c.ability]
      .some((v) => v && v.toLowerCase().includes(q));
    const matchTag = (c) => c?.ability && abilityTags(c.ability).some((t) => tags.has(t));
    const rowStat = (c1, c2) => {
      const vals = [c1, c2].map((c) => resolveCatch(c)?.baseStats?.[statIdx]).filter((v) => v != null);
      return vals.length ? Math.max(...vals) : null;
    };

    let list = locations.map((loc) => {
      const c1 = catchMap[`${loc.id}:1`];
      const c2 = catchMap[`${loc.id}:2`];
      return { loc, c1, c2, stat: statIdx != null ? rowStat(c1, c2) : null };
    });
    if (q) list = list.filter((r) => matchText(r.c1) || matchText(r.c2));
    if (tags.size) list = list.filter((r) => matchTag(r.c1) || matchTag(r.c2));
    if (statIdx != null) {
      list = list.filter((r) => r.stat != null).sort((a, b) => b.stat - a.stat);
    }
    return list;
  }, [locations, catchMap, query, tagFilter, statSort]);

  const filtering = query || tagFilter.size || statSort !== '';

  return (
    <div className="board">
      <TeamPanel run={run} team={team} locations={locations} catchMap={catchMap} onToggle={toggleTeam} />

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
          <span className="token-ctl" title="Starter eggs registered at Fallarbor">
            <span className="tlabel">Eggs</span>
            <button onClick={() => setEggCount((run.egg_count || 6) - 1)}>−</button>
            <span className="tval">{run.egg_count ?? 6}</span>
            <button onClick={() => setEggCount((run.egg_count || 6) + 1)}>+</button>
          </span>
          <span className="stat">{stats.linked} linked pairs</span>
          <span className="stat dead">{stats.deaths} deaths</span>
          <button className="primary" onClick={() => setImporting(true)}>⤓ Sync save</button>
        </div>
      </div>

      <div className="filter-bar">
        <input className="search" placeholder="Search species / nickname / ability…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="sort-ctl">Sort by
          <select value={statSort} onChange={(e) => setStatSort(e.target.value)}>
            <option value="">Location order</option>
            {STAT_LABELS.map((s, i) => <option key={s} value={i}>{s} (high→low)</option>)}
          </select>
        </label>
        {Object.entries(TAG_LABELS).map(([tag, label]) => (
          <button key={tag} className={`tag-chip ${tagFilter.has(tag) ? 'on' : ''}`} onClick={() => toggleTag(tag)}>
            {label}
          </button>
        ))}
        {filtering && (
          <button className="clear-filter" onClick={() => { setQuery(''); setStatSort(''); setTagFilter(new Set()); }}>
            Clear ✕
          </button>
        )}
        {filtering && <span className="muted small">{rows.length} shown</span>}
      </div>

      <div className="table-wrap">
        <table className="board-table">
          <thead>
            <tr>
              <th className="star-col" />
              <th className="loc-col">Location</th>
              <th>{players[0].name}</th>
              <th>{players[1].name}</th>
              <th className="link-col">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ loc, c1, c2, stat }) => {
              const broken = (c1?.status === 'dead' || c2?.status === 'dead');
              const bothDead = c1?.status === 'dead' && c2?.status === 'dead';
              const lt = LOCATION_TYPES[loc.type];
              const onTeam = team.includes(loc.id);
              const hasCatch = c1?.species || c2?.species;
              return (
                <tr key={loc.id} className={broken && !bothDead ? 'row-broken' : ''}>
                  <td className="star-col">
                    {hasCatch && (
                      <button className={`star ${onTeam ? 'on' : ''}`} title={onTeam ? 'Remove from team' : 'Add to team'}
                        onClick={() => toggleTeam(loc.id)}>{onTeam ? '★' : '☆'}</button>
                    )}
                  </td>
                  <td className="loc-col">
                    <span className="loc-badge" style={{ background: lt.color }}>{lt.label}</span>
                    <span className="loc-name">{loc.name}</span>
                    {loc.note && <span className="loc-note" title={loc.note}>ⓘ</span>}
                    {stat != null && <span className="stat-pill">{STAT_LABELS[Number(statSort)]} {stat}</span>}
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
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: 'center' }}>No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {importing && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading importer…</div></div>}>
          <SaveImport run={run} onClose={() => setImporting(false)} onImported={reload} />
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
