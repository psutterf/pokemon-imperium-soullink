import { useMemo, useRef, useState } from 'react';

// Lightweight type-to-filter autocomplete that resolves to a specific option object (so it can
// disambiguate entries that share a name, e.g. the two "Groudon" species). Options are
// { id, name, sub? } — `name` fills the box, `sub` is muted helper text in the dropdown.
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function Autocomplete({ options, value, onPick, onClear, placeholder, invalid }) {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurT = useRef(null);

  const matches = useMemo(() => {
    const q = norm(text);
    if (!q) return options.slice(0, 50);
    const starts = [], has = [];
    for (const o of options) {
      const n = norm(o.name);
      if (n.startsWith(q)) starts.push(o);
      else if (n.includes(q)) has.push(o);
      if (starts.length >= 50) break;
    }
    return [...starts, ...has].slice(0, 50);
  }, [text, options]);

  const pick = (o) => {
    if (!o) return;
    setText(o.name);
    setOpen(false);
    onPick(o);
  };

  return (
    <div className="ac">
      <input
        className={invalid ? 'ac-input invalid' : 'ac-input'}
        value={text}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); if (!e.target.value && onClear) onClear(); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurT.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && matches.length > 0 && (
        <ul className="ac-list" onMouseDown={() => clearTimeout(blurT.current)}>
          {matches.map((o, i) => (
            <li
              key={o.id}
              className={i === active ? 'ac-item active' : 'ac-item'}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span className="ac-name">{o.name}</span>
              {o.sub && <span className="ac-sub">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
