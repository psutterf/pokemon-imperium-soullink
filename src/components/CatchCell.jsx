import { useId, useRef, useState } from 'react';
import PokemonDetail from './PokemonDetail.jsx';
import { speciesAbilities, ABILITY_NAMES, SPECIES_NAMES } from '../lib/dex.js';
import { NATURE_LIST } from '../data/natures.js';

const STATUSES = {
  alive: { label: 'Alive', color: '#3fae6a' },
  boxed: { label: 'Boxed', color: '#c79b3b' },
  dead: { label: 'Dead', color: '#c0444a' },
  voided: { label: 'Voided', color: '#7a7a7a' },
};

// One player's catch on one location. Filled cells open a detail view; empty cells show a + to add.
export default function CatchCell({ value, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState(false);
  const [draft, setDraft] = useState(value || {});
  const ref = useRef(null);
  const uid = useId();

  // Seed the draft from the current value when an edit begins (not via an effect, so a live
  // partner update can't overwrite an in-progress edit).
  const startEditing = () => { setDraft(value || {}); setDetail(false); setEditing(true); setTimeout(() => ref.current?.focus(), 0); };

  const commit = () => {
    setEditing(false);
    if (!draft.species && !draft.nickname) { if (value) onClear(); return; }
    onSave({
      species: draft.species || '', nickname: draft.nickname || '',
      level: draft.level || null, ability: draft.ability || '', nature: draft.nature || '',
      status: draft.status || 'alive',
    });
  };

  if (!editing) {
    if (!value || (!value.species && !value.nickname)) {
      return <button className="cell empty" onClick={startEditing}>+</button>;
    }
    const st = STATUSES[value.status] || STATUSES.alive;
    return (
      <>
        <button className={`cell filled status-${value.status}`} onClick={() => setDetail(true)} title="Click for details">
          <span className="dot" style={{ background: st.color }} />
          <span className="mon">
            <span className="species">{value.species || '—'}</span>
            {value.nickname && <span className="nick">“{value.nickname}”</span>}
            {value.ability && <span className="cell-ability">{value.ability}</span>}
          </span>
          <span className="meta">
            {value.level ? `Lv${value.level}` : ''}
            {value.source === 'save' && <span className="src" title="Imported from save">⤓</span>}
          </span>
        </button>
        {detail && (
          <div className="modal-backdrop" onClick={() => setDetail(false)}>
            <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h2>Details</h2>
                <button className="x" onClick={() => setDetail(false)}>×</button>
              </div>
              <div className="modal-body">
                <PokemonDetail value={value} />
              </div>
              <div className="modal-foot">
                <button onClick={startEditing}>Edit</button>
                <button className="danger" onClick={() => { setDetail(false); onClear(); }}>Clear</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const abilitySuggestions = [...new Set([...speciesAbilities(draft.species), ...ABILITY_NAMES])];
  return (
    <div className="cell editing">
      {/* autoComplete="off" disables the BROWSER's saved-value dropdown (which otherwise surfaces
          abilities/species typed in other runs — "bleeding" into new runs). The app's own datalist
          suggestions (game ability/species names) still work. */}
      <input ref={ref} list={`${uid}-sp`} autoComplete="off" placeholder="Species" value={draft.species || ''}
        onChange={(e) => setDraft({ ...draft, species: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <datalist id={`${uid}-sp`}>{SPECIES_NAMES.map((s) => <option key={s} value={s} />)}</datalist>
      <input placeholder="Nickname" autoComplete="off" value={draft.nickname || ''}
        onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <input list={`${uid}-ab`} autoComplete="off" placeholder="Ability" value={draft.ability || ''}
        onChange={(e) => setDraft({ ...draft, ability: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <datalist id={`${uid}-ab`}>{abilitySuggestions.map((a) => <option key={a} value={a} />)}</datalist>
      <div className="edit-row">
        <input className="lvl" type="number" placeholder="Lv" value={draft.level || ''}
          onChange={(e) => setDraft({ ...draft, level: e.target.value ? Number(e.target.value) : null })} />
        <select value={draft.nature || ''} onChange={(e) => setDraft({ ...draft, nature: e.target.value })}>
          <option value="">Nature</option>
          {NATURE_LIST.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={draft.status || 'alive'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="edit-actions">
        <button className="primary" onClick={commit}>Save</button>
        {value && <button className="danger" onClick={() => { setEditing(false); onClear(); }}>Clear</button>}
        <button onClick={() => { setEditing(false); setDraft(value || {}); }}>Cancel</button>
      </div>
    </div>
  );
}
