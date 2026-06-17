import { useMemo, useRef, useState } from 'react';
import { useRunContext } from './runContext.js';
import { store } from '../lib/store.js';
import { DEFAULT_WHEEL, WHEEL_PALETTE } from '../data/wheelDefaults.js';

const uid = () => (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
const SPIN_TURNS = 5;          // full rotations before landing
const SPIN_MS = 4200;          // matches the CSS transition duration

// The wheels, each backed by its own synced run column. Wheel 1 seeds editable defaults; Wheel 2
// starts empty (the players fill it in).
const WHEELS = [
  { key: 'wheel', name: 'Wheel 1', seed: true },
  { key: 'wheel2', name: 'Wheel 2', seed: false },
];
const EMPTY = [];   // stable reference for a non-seeded, unfilled wheel

// Point on a circle at `deg` clockwise from the top (12 o'clock).
const pt = (deg, r, cx = 100, cy = 100) => {
  const a = (deg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

export default function Wheel() {
  const { run, reload } = useRunContext();

  const [wheelIdx, setWheelIdx] = useState(0);
  const active = WHEELS[wheelIdx];
  // Synced segments for the active wheel. Wheel 1 falls back to seeded defaults until edited;
  // Wheel 2 (and any non-seeded wheel) starts empty.
  const stored = run[active.key];
  const rewards = useMemo(
    () => (stored?.length ? stored : (active.seed ? DEFAULT_WHEEL : EMPTY)),
    [stored, active],
  );

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);   // recent spins (ephemeral, local)
  const [editing, setEditing] = useState(false);
  const idxRef = useRef(0);

  const switchWheel = (i) => {
    if (i === wheelIdx || spinning) return;
    setWheelIdx(i);
    setResult(null);
    setHistory([]);
    setEditing(false);
  };

  const seg = rewards.length ? 360 / rewards.length : 360;

  const slices = useMemo(() => rewards.map((r, i) => {
    const a0 = i * seg, a1 = (i + 1) * seg;
    const [x0, y0] = pt(a0, 100), [x1, y1] = pt(a1, 100);
    const large = seg > 180 ? 1 : 0;
    const d = rewards.length === 1
      ? 'M100,0 A100,100 0 1 1 99.99,0 Z'
      : `M100,100 L${x0.toFixed(2)},${y0.toFixed(2)} A100,100 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
    const mid = (i + 0.5) * seg;
    const left = mid > 90 && mid < 270;            // bottom-left half → flip text upright
    return { ...r, i, d, mid, left };
  }), [rewards, seg]);

  const spin = () => {
    if (spinning || rewards.length < 2) return;
    const idx = Math.floor(Math.random() * rewards.length);
    idxRef.current = idx;
    const mid = (idx + 0.5) * seg;
    const base = Math.ceil(rotation / 360) * 360;
    const target = base + SPIN_TURNS * 360 + (360 - (mid % 360)); // lands idx's center under the top pointer
    setResult(null);
    setSpinning(true);
    setRotation(target);
  };

  const onSpinEnd = () => {
    if (!spinning) return;
    setSpinning(false);
    const won = rewards[idxRef.current];
    setResult(won);
    setHistory((h) => [{ key: uid(), label: won.label, at: Date.now() }, ...h].slice(0, 8));
  };

  // --- editing (persists the whole array to the active wheel's column) ---
  const save = (next) => store.updateRun(run.id, { [active.key]: next }).then(reload);
  const editStart = () => { if (active.seed && !stored?.length) save(DEFAULT_WHEEL); setEditing(true); };
  const upSeg = (i, patch) => save(rewards.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addSeg = () => save([...rewards, { id: uid(), label: 'New reward', color: WHEEL_PALETTE[rewards.length % WHEEL_PALETTE.length] }]);
  const removeSeg = (i) => save(rewards.filter((_, j) => j !== i));
  const resetSegs = () => save(DEFAULT_WHEEL);

  return (
    <div className="wheel-page">
      <p className="rw-intro muted">
        Spin for a random reward. Each wheel is <strong>shared with your partner</strong> and fully
        editable — rename, recolor, add, or remove rewards. A spin just picks one; carry it out yourself
        (spawn it in <strong>Rewards</strong>, or log it as a new pair on the <strong>Board</strong>).
      </p>

      <div className="wheel-tabs">
        {WHEELS.map((w, i) => (
          <button key={w.key} className={`wheel-tab ${i === wheelIdx ? 'on' : ''}`}
            onClick={() => switchWheel(i)} disabled={spinning}>{w.name}</button>
        ))}
      </div>

      <div className="wheel-layout">
        <div className="wheel-stage">
          <div className="wheel-pointer" />
          <svg
            className="wheel-svg"
            viewBox="0 0 200 200"
            style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(.15,.62,.12,1)` }}
            onTransitionEnd={onSpinEnd}
          >
            {slices.map((s) => (
              <path key={`p-${s.id}`} d={s.d} fill={s.color} stroke="var(--bg)" strokeWidth="0.6" />
            ))}
            {rewards.length > 1 && slices.map((s) => (
              <g key={`t-${s.id}`} transform={`rotate(${s.mid} 100 100) rotate(${s.left ? 90 : -90} 100 100)`}>
                <text x={s.left ? 52 : 148} y="100" textAnchor={s.left ? 'start' : 'end'}
                  dominantBaseline="middle" className="wheel-text">{s.label}</text>
              </g>
            ))}
            <circle cx="100" cy="100" r="13" fill="var(--bg2)" stroke="var(--line)" strokeWidth="1" />
          </svg>
        </div>

        <div className="wheel-side">
          <button className="primary wheel-spin" onClick={spin} disabled={spinning || rewards.length < 2}>
            {spinning ? 'Spinning…' : 'Spin'}
          </button>
          {rewards.length < 2 && <p className="warn">Add at least 2 rewards to spin.</p>}
          {result && !spinning && (
            <div className="wheel-result" style={{ borderColor: result.color }}>
              <span className="muted small">You landed on</span>
              <strong style={{ color: result.color }}>{result.label}</strong>
            </div>
          )}
          {history.length > 0 && (
            <div className="wheel-history">
              <span className="muted small">Recent spins</span>
              <ul>{history.map((h) => <li key={h.key}>{h.label}</li>)}</ul>
            </div>
          )}
          <button className="rw-add" onClick={() => (editing ? setEditing(false) : editStart())}>
            {editing ? 'Done editing' : '✎ Edit rewards'}
          </button>
        </div>
      </div>

      {editing && (
        <section className="rw-card wheel-edit">
          <h2>Edit rewards <span className="muted small">({rewards.length})</span></h2>
          {rewards.map((r, i) => (
            <div className="rw-row" key={r.id}>
              <input type="color" className="wheel-color" value={r.color || '#888888'}
                onChange={(e) => upSeg(i, { color: e.target.value })} aria-label="color" />
              <input className="wheel-label-input" value={r.label}
                onChange={(e) => upSeg(i, { label: e.target.value })} placeholder="Reward…" />
              <button className="rw-x" title="Remove" onClick={() => removeSeg(i)}>×</button>
            </div>
          ))}
          <div className="wheel-edit-actions">
            <button className="rw-add" onClick={addSeg}>+ Add reward</button>
            <button className="rw-add" onClick={resetSegs}>↺ Reset to defaults</button>
          </div>
        </section>
      )}
    </div>
  );
}
