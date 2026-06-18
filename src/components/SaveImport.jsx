import { useMemo, useState } from 'react';
import { parseSave } from '../lib/saveParser.js';
import { store } from '../lib/store.js';
import { natureName } from '../data/natures.js';
import { moveName } from '../lib/dex.js';
import { buildLocations } from '../data/locations.js';

// House rule: dead Pokémon are stored in the last PC box. The save records each mon's box, so a
// mon found there is marked dead on import; anything else (party or another box) is alive.
const DEAD_BOX = 14;

// Rewards-tab spawns are all stamped as met at Petalburg Woods, so on a re-sync every reward mon
// resolves to this one row. To keep the real first encounter (and manually-entered reward pairs)
// intact, the importer never OVERWRITES this row once it has a catch — it's filled at most once.
const REWARD_LOC = 'petalburg-woods';

// Fallarbor Town sells unlimited starter eggs, and every one of them is met at "Fallarbor Town".
// Met location alone therefore can't tell two starter eggs apart, so they can't be matched to a
// specific egg row by name — they must be spread across the rows in order (see buildRows).
const isFallarborEgg = (mon) => /fallarbor/i.test(mon.metLocationName || '');

// Suggest a board location id for a parsed mon based on its met-location name.
function suggestLocation(mon, locations) {
  if (mon.isEgg) return '';
  const met = (mon.metLocationName || '').toLowerCase();
  if (mon.metLocation === 0) return 'starter'; // Littleroot = where the starter is given
  const routeNum = met.match(/route\s*(\d+)/)?.[1];
  if (routeNum) {
    const hit = locations.find((l) => l.id === `route-${routeNum}`);
    if (hit) return hit.id;
  }
  const exact = locations.find((l) => l.name.toLowerCase() === met);
  if (exact) return exact.id;
  const partial = locations.find((l) => met && l.name.toLowerCase().includes(met));
  return partial?.id || '';
}

// Build the editable import rows, assigning each mon a board location. Fallarbor starter eggs are
// handed out across the Fallarbor egg rows (#1, #2, #3, …) in the order they appear in the save, so
// every egg lands on its own row instead of all colliding on row #1. Everything else falls back to
// met-location matching. If there are more eggs than egg rows, the extras are left unassigned (the
// player can raise the egg count on the board, then re-sync).
const FALLARBOR_EGG_PREFIX = 'fallarbor-starter-egg';
function buildRows(mons, locations) {
  const eggRowIds = locations
    .filter((l) => l.id === FALLARBOR_EGG_PREFIX || l.id.startsWith(`${FALLARBOR_EGG_PREFIX}-`))
    .map((l) => l.id);
  let nextEgg = 0;
  return mons.map((mon, i) => {
    let locationId;
    if (isFallarborEgg(mon)) {
      locationId = eggRowIds[nextEgg] || '';
      nextEgg += 1;
    } else {
      locationId = suggestLocation(mon, locations);
    }
    return { key: i, mon, include: true, locationId };
  });
}

export default function SaveImport({ run, onClose, onImported }) {
  const [slot, setSlot] = useState(1);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const LOCATIONS = useMemo(() => buildLocations(run.egg_count), [run.egg_count]);

  const onFile = async (file) => {
    setErr('');
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const { all } = parseSave(buf);
      if (!all.length) { setErr('No Pokémon found in that save (party and boxes are empty).'); return; }
      setRows(buildRows(all, LOCATIONS));
    } catch (e) {
      setErr(e.message);
    }
  };

  const usedLocations = useMemo(() => {
    const taken = new Set(run.catches.filter((c) => c.slot === slot && c.species).map((c) => c.location_id));
    return taken;
  }, [run.catches, slot]);

  // Whether Petalburg Woods already holds a catch for the slot being imported (so it's protected).
  const rewardLocTaken = usedLocations.has(REWARD_LOC);

  // The rows that will actually be written: skip Petalburg Woods entirely if it already has a catch,
  // and otherwise let it be filled at most once this pass (so multiple reward mons can't pile onto it).
  const importedRows = useMemo(() => {
    if (!rows) return [];
    let rewardFilled = rewardLocTaken;
    const out = [];
    for (const r of rows) {
      if (!r.include || !r.locationId) continue;
      if (r.locationId === REWARD_LOC) {
        if (rewardFilled) continue;
        rewardFilled = true;
      }
      out.push(r);
    }
    return out;
  }, [rows, rewardLocTaken]);
  const importedKeys = useMemo(() => new Set(importedRows.map((r) => r.key)), [importedRows]);

  const confirm = async () => {
    setBusy(true);
    try {
      for (const r of importedRows) {
        const m = r.mon;
        await store.upsertCatch(run.id, {
          id: `${r.locationId}:${slot}`,
          location_id: r.locationId,
          slot,
          species: m.speciesName,
          nickname: m.nickname || '',
          level: m.level || m.metLevel || null,
          // Ability is intentionally NOT set here. Imperium randomizes abilities per-run via a
          // seed that isn't in the save, so it's entered manually — and omitting it from the
          // upsert means a re-sync won't wipe an ability you already typed (both stores only
          // update the fields passed). New catches just stay blank for manual entry.
          nature: natureName(m.nature),
          moves: (m.moveIds || []).map(moveName).filter(Boolean),
          status: m.box === DEAD_BOX ? 'dead' : 'alive',
          source: 'save',
        });
      }
      onImported();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Sync from save file</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="import-controls">
          <label>Importing as:&nbsp;
            <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {run.players.map((p) => <option key={p.slot} value={p.slot}>{p.name}</option>)}
            </select>
          </label>
          <label className="filebtn">
            Choose .sav…
            <input type="file" accept=".sav,.sa1,.srm,application/octet-stream" hidden
              onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
        </div>

        {err && <p className="error">{err}</p>}
        <p className="muted small">
          Tip: save in your emulator first. Species shown as <code>#NNN</code> are Gen 3–9 mons this
          hack remaps — rename them on the board. Met locations are read straight from each Pokémon.
          Abilities are randomized per-run and aren't stored in the save, so set each mon's ability
          on the board (the field autocompletes, including Imperium's custom abilities).
          Pokémon in <strong>PC box {DEAD_BOX}</strong> are imported as <strong>dead</strong>; anything
          else (party or another box) is alive. <strong>Petalburg Woods</strong> is the Rewards-spawn
          location: once it has a catch it's <strong>never overwritten</strong> by a re-sync, so log
          reward Pokémon as manual pairs on the board.
        </p>

        {rows && rows.some((r) => r.include && !r.locationId) && (
          <p className="error">
            ⚠ {rows.filter((r) => r.include && !r.locationId).length} Pokémon didn't match a board
            location automatically — pick a location in the dropdown, or they won't be imported.
          </p>
        )}

        {rows && (
          <>
            <div className="import-list">
              {rows.map((r, i) => {
                const m = r.mon;
                const protectedReward = r.include && r.locationId === REWARD_LOC && !importedKeys.has(r.key);
                const dup = r.locationId && usedLocations.has(r.locationId) && !protectedReward;
                const unmatched = r.include && !r.locationId;
                return (
                  <div className={`import-row ${r.include ? '' : 'off'} ${unmatched ? 'unmatched' : ''}`} key={r.key}>
                    <input type="checkbox" checked={r.include}
                      onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} />
                    <div className="imon">
                      <strong>{m.speciesName}</strong>{m.nickname && <em> "{m.nickname}"</em>}
                      {m.shiny && <span className="shiny">✨</span>}{m.isEgg && <span className="egg">EGG</span>}
                      {m.box === DEAD_BOX && <span className="dead-badge">DEAD (box {DEAD_BOX})</span>}
                      <span className="muted small"> · {m.source}{m.box ? ` box ${m.box}` : ''} · caught Lv{m.metLevel} @ {m.metLocationName}
                        {!m.isEgg && ` · ${natureName(m.nature)}`}</span>
                    </div>
                    <select value={r.locationId}
                      onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, locationId: e.target.value } : x))}>
                      <option value="">— unassigned —</option>
                      {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {dup && <span className="dup" title="Overwrites an existing catch on this location">replaces</span>}
                    {protectedReward && <span className="kept" title="Petalburg Woods already has a catch — it won't be overwritten (add reward pairs manually)">kept</span>}
                  </div>
                );
              })}
            </div>
            <div className="modal-foot">
              <span className="muted">{importedRows.length} to import</span>
              <button className="primary" disabled={busy} onClick={confirm}>Import</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
