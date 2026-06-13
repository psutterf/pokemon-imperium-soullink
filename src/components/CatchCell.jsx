import { useEffect, useRef, useState } from 'react';

const STATUSES = {
  alive: { label: 'Alive', color: '#3fae6a' },
  boxed: { label: 'Boxed', color: '#c79b3b' },
  dead: { label: 'Dead', color: '#c0444a' },
  voided: { label: 'Voided', color: '#7a7a7a' },
};

// One player's catch on one location. Click to edit inline; empty cells show a + to add.
export default function CatchCell({ value, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || {});
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  // Seed the draft from the current value each time editing begins, instead of
  // syncing via an effect (which would also overwrite an in-progress edit when a
  // live update arrives from a partner).
  const startEditing = () => { setDraft(value || {}); setEditing(true); };

  const commit = () => {
    setEditing(false);
    if (!draft.species && !draft.nickname) { if (value) onClear(); return; }
    onSave({ ...draft, status: draft.status || 'alive' });
  };

  if (!editing) {
    if (!value || (!value.species && !value.nickname)) {
      return <button className="cell empty" onClick={startEditing}>+</button>;
    }
    const st = STATUSES[value.status] || STATUSES.alive;
    return (
      <button className={`cell filled status-${value.status}`} onClick={startEditing} title="Click to edit">
        <span className="dot" style={{ background: st.color }} />
        <span className="mon">
          <span className="species">{value.species || '—'}</span>
          {value.nickname && <span className="nick">"{value.nickname}"</span>}
        </span>
        <span className="meta">
          {value.level ? `Lv${value.level}` : ''}
          {value.source === 'save' && <span className="src" title="Imported from save">⤓</span>}
        </span>
      </button>
    );
  }

  return (
    <div className="cell editing">
      <input ref={ref} placeholder="Species" value={draft.species || ''}
        onChange={(e) => setDraft({ ...draft, species: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <input placeholder="Nickname" value={draft.nickname || ''}
        onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <div className="edit-row">
        <input className="lvl" type="number" placeholder="Lv" value={draft.level || ''}
          onChange={(e) => setDraft({ ...draft, level: e.target.value ? Number(e.target.value) : null })} />
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
