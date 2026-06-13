import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, SYNC_MODE } from '../lib/store.js';

export default function Home() {
  const nav = useNavigate();
  const [p1, setP1] = useState('Parker');
  const [p2, setP2] = useState('');
  const [name, setName] = useState('');
  const [randomized, setRandomized] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const r = JSON.parse(localStorage.getItem('pis:recent') || '[]');
    setRecent(r);
  }, []);

  const remember = (run) => {
    const r = [{ id: run.id, name: run.name, code: run.join_code }, ...JSON.parse(localStorage.getItem('pis:recent') || '[]').filter((x) => x.id !== run.id)].slice(0, 6);
    localStorage.setItem('pis:recent', JSON.stringify(r));
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const run = await store.createRun({ name: name || 'Soul Link Run', randomized, p1, p2 });
      remember(run);
      nav(`/run/${run.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const join = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const run = await store.getRunByCode(code.trim());
      if (!run) { setErr('No run found for that code.'); return; }
      remember(run);
      nav(`/run/${run.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="home">
      <header className="home-hero">
        <h1>Pokémon Emerald Imperium</h1>
        <p className="tagline">Soul Link tracker &amp; boss guide</p>
        <span className={`mode-badge ${SYNC_MODE}`}>
          {SYNC_MODE === 'cloud' ? '☁ Live sync on' : '💾 Local mode (this device)'}
        </span>
      </header>

      <div className="home-cards">
        <form className="card" onSubmit={create}>
          <h2>New run</h2>
          <label>Run name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Soul Link Run" /></label>
          <div className="row">
            <label>Player 1<input value={p1} onChange={(e) => setP1(e.target.value)} /></label>
            <label>Player 2<input value={p2} onChange={(e) => setP2(e.target.value)} placeholder="Friend" /></label>
          </div>
          <label className="check">
            <input type="checkbox" checked={randomized} onChange={(e) => setRandomized(e.target.checked)} />
            Randomized encounters
          </label>
          <button disabled={busy} type="submit">Create run</button>
        </form>

        <form className="card" onSubmit={join}>
          <h2>Join a run</h2>
          <p className="muted">Enter the 6-character code your partner shared.</p>
          <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
          <button disabled={busy || code.length < 6} type="submit">Join</button>
          {SYNC_MODE === 'local' && <p className="warn">Local mode: joining works across browser tabs on this device. Add Supabase keys for cross-device sync (see README).</p>}
        </form>
      </div>

      {err && <p className="error">{err}</p>}

      {recent.length > 0 && (
        <div className="recent">
          <h3>Recent runs</h3>
          <ul>
            {recent.map((r) => (
              <li key={r.id}>
                <button className="link" onClick={() => nav(`/run/${r.id}`)}>{r.name} <span className="muted">· {r.code}</span></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
