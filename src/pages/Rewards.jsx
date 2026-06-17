import { useRef, useState } from 'react';
import Autocomplete from '../components/Autocomplete.jsx';
import { parseSave } from '../lib/saveParser.js';
import { loadSave, applyEdits, serializeSave } from '../lib/saveEditor.js';
import { SPECIES } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { TYPE_NAMES } from '../data/typechart.js';

// --- option lists (built once) ---
const bst = (s) => (s || []).reduce((a, b) => a + b, 0);
const typeStr = (t) => (t || []).map((id) => TYPE_NAMES[id]).filter(Boolean).join('/');
const byName = (a, b) => a.name.localeCompare(b.name) || a.id - b.id;

const SPECIES_OPTS = Object.entries(SPECIES)
  .map(([id, sp]) => ({ id: +id, name: sp.n, sub: `${typeStr(sp.t)} · BST ${bst(sp.s)}` }))
  .sort(byName);
const ITEM_OPTS = Object.entries(ITEMS)
  .map(([id, it]) => ({ id: +id, name: it.n, sub: it.pk })).sort(byName);
const MOVE_OPTS = Object.entries(MOVES)
  .map(([id, m]) => ({ id: +id, name: m.n, sub: `${TYPE_NAMES[m.t] || ''} · ${m.c} · ${m.p || '—'}` })).sort(byName);

let nextKey = 1;
const k = () => nextKey++;
const newItem = () => ({ key: k(), id: null, name: '', qty: 1 });
const newPokemon = () => ({ key: k(), speciesId: null, speciesName: '', moves: [] });

export default function Rewards() {
  const [fileBuf, setFileBuf] = useState(null);
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');
  const [items, setItems] = useState([newItem()]);
  const [pokemon, setPokemon] = useState([newPokemon()]);
  const [result, setResult] = useState(null);
  const urlRef = useRef(null);

  const onFile = async (file) => {
    setErr(''); setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      loadSave(bytes);                         // throws if not a recognizable Imperium/Emerald save
      const parsed = parseSave(bytes);          // throws on incompatible layouts
      setFileBuf(buf);
      setFileName(file.name);
      setSummary({ party: parsed.party.length, boxes: parsed.boxes.length });
    } catch (e) {
      setFileBuf(null); setSummary(null); setErr(e.message);
    }
  };

  const upItem = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const upMon = (i, patch) => setPokemon((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const readyItems = items.filter((it) => it.id && it.qty > 0);
  const readyPokemon = pokemon.filter((p) => p.speciesId);

  const generate = () => {
    setErr('');
    try {
      const save = loadSave(new Uint8Array(fileBuf)); // fresh copy each time so re-generating is clean
      const payload = {
        items: readyItems.map((it) => ({ id: it.id, qty: Math.min(Math.max(1, it.qty | 0), 999), pocket: ITEMS[it.id].pk })),
        pokemon: readyPokemon.map((p) => ({
          species: p.speciesId,
          abilityNum: 0,
          moveIds: p.moves.filter((m) => m.id).map((m) => m.id),
        })),
      };
      const { log } = applyEdits(save, payload);
      const out = serializeSave(save);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
      setResult({ log, url: urlRef.current, name: fileName || 'Pokemon Imperium v1.1.sav' });
    } catch (e) {
      setErr(e.message);
    }
  };

  const hasWork = readyItems.length > 0 || readyPokemon.length > 0;

  return (
    <div className="rewards">
      <p className="rw-intro muted">
        Spawn <strong>items</strong> into your bag and <strong>Pokémon</strong> into your PC boxes by
        editing a save file in your browser. Nothing is uploaded — your <code>.sav</code> never leaves
        this machine. Spawned Pokémon arrive at <strong>Level 1</strong>, neutral nature, knowing only
        the moves you choose (Tackle by default).
      </p>

      <ol className="rw-steps muted small">
        <li><strong>Close mGBA completely</strong> before you replace the save (it overwrites the file otherwise).</li>
        <li>Upload your current <code>.sav</code>, add items / Pokémon, and download the edited file.</li>
        <li>Replace your <code>.sav</code> with the download (keep the original as a backup), reopen mGBA → <em>Continue</em>.</li>
        <li><strong>Withdraw each spawned Pokémon from the PC once</strong> so the game finalizes its stats.</li>
      </ol>

      {/* ---- 1. Save ---- */}
      <section className="rw-card">
        <h2>1 · Save file</h2>
        <div className="rw-file">
          <label className="filebtn">
            {fileBuf ? 'Choose a different .sav…' : 'Choose .sav…'}
            <input type="file" accept=".sav,.sa1,.srm,application/octet-stream" hidden
              onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
          {summary && (
            <span className="rw-loaded">✓ <strong>{fileName}</strong> — {summary.party} in party, {summary.boxes} in boxes</span>
          )}
        </div>
        {err && <p className="error">{err}</p>}
      </section>

      {/* ---- 2. Items ---- */}
      <section className="rw-card">
        <h2>2 · Items</h2>
        {items.map((it, i) => (
          <div className="rw-row" key={it.key}>
            <Autocomplete
              options={ITEM_OPTS}
              placeholder="Item name…"
              onPick={(o) => upItem(i, { id: o.id, name: o.name })}
              onClear={() => upItem(i, { id: null, name: '' })}
            />
            <input className="rw-qty" type="number" min="1" max="999" value={it.qty}
              onChange={(e) => upItem(i, { qty: Number(e.target.value) })} aria-label="quantity" />
            {it.id && <span className="rw-pocket">{ITEMS[it.id].pk}</span>}
            <button className="rw-x" title="Remove" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button className="rw-add" onClick={() => setItems((xs) => [...xs, newItem()])}>+ Add item</button>
      </section>

      {/* ---- 3. Pokémon ---- */}
      <section className="rw-card">
        <h2>3 · Pokémon</h2>
        {pokemon.map((p, i) => (
          <div className="rw-mon" key={p.key}>
            <div className="rw-mon-head">
              <Autocomplete
                options={SPECIES_OPTS}
                placeholder="Pokémon name…"
                onPick={(o) => upMon(i, { speciesId: o.id, speciesName: o.name })}
                onClear={() => upMon(i, { speciesId: null, speciesName: '' })}
              />
              <button className="rw-x" title="Remove Pokémon" onClick={() => setPokemon((xs) => xs.filter((_, j) => j !== i))}>×</button>
            </div>

            <p className="rw-note small">
              Ability is whatever this run's randomizer assigns to the species — it can't be chosen via a
              save edit (the game computes it at load time). Pickable abilities are planned for later.
            </p>

            <div className="rw-field">
              <span className="rw-label">Moves <span className="muted small">(up to 4 — leave empty for Tackle)</span></span>
              {p.moves.map((m, mi) => (
                <div className="rw-moverow" key={m.key}>
                  <Autocomplete
                    options={MOVE_OPTS}
                    placeholder={`Move ${mi + 1}…`}
                    onPick={(o) => upMon(i, { moves: p.moves.map((x, j) => (j === mi ? { ...x, id: o.id, name: o.name } : x)) })}
                    onClear={() => upMon(i, { moves: p.moves.map((x, j) => (j === mi ? { ...x, id: null, name: '' } : x)) })}
                  />
                  <button className="rw-x" title="Remove move" onClick={() => upMon(i, { moves: p.moves.filter((_, j) => j !== mi) })}>×</button>
                </div>
              ))}
              {p.moves.length < 4 && (
                <button className="rw-add small" onClick={() => upMon(i, { moves: [...p.moves, { key: k(), id: null, name: '' }] })}>+ Add move</button>
              )}
            </div>

            <p className="rw-preview small muted">
              {p.speciesName || 'Pokémon'} · Lv 1 · neutral nature · default ability ·{' '}
              {p.moves.filter((m) => m.name).map((m) => m.name).join(', ') || 'Tackle'}
            </p>
          </div>
        ))}
        <button className="rw-add" onClick={() => setPokemon((xs) => [...xs, newPokemon()])}>+ Add Pokémon</button>
      </section>

      {/* ---- 4. Generate ---- */}
      <section className="rw-card">
        <h2>4 · Download</h2>
        <button className="primary" disabled={!fileBuf || !hasWork} onClick={generate}>Generate edited save</button>
        {!fileBuf && <span className="muted small"> &nbsp;Upload a save first.</span>}
        {result && (
          <div className="rw-result">
            <ul className="rw-log">
              {result.log.map((l, i) => <li key={i} className={l.startsWith('!!') ? 'bad' : 'ok'}>{l}</li>)}
            </ul>
            <a className="primary rw-download" href={result.url} download={result.name}>⬇ Download {result.name}</a>
            <p className="muted small">Remember: close mGBA, replace your <code>.sav</code> with this file, keep the
              original as a backup, then reopen and pick <em>Continue</em>. Withdraw each spawned Pokémon from the PC once.</p>
          </div>
        )}
      </section>
    </div>
  );
}
