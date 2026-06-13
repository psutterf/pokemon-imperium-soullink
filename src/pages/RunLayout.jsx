import { NavLink, Outlet, useParams, useOutletContext, Link } from 'react-router-dom';
import { useRun } from '../lib/useRun.js';
import { SYNC_MODE } from '../lib/store.js';

export default function RunLayout() {
  const { runId } = useParams();
  const { run, loading, error, reload } = useRun(runId);

  if (loading) return <div className="loading">Loading run…</div>;
  if (error) return <div className="loading">{error} — <Link to="/">go home</Link></div>;

  return (
    <div className="run">
      <header className="run-header">
        <div className="run-title">
          <Link to="/" className="home-link">←</Link>
          <h1>{run.name}</h1>
          {run.randomized && <span className="tag rand">Randomized</span>}
        </div>
        <div className="run-meta">
          <span className="code-pill" title="Share this code with your partner">
            Code: <strong>{run.join_code}</strong>
          </span>
          <span className={`mode-badge ${SYNC_MODE}`}>{SYNC_MODE === 'cloud' ? '☁ Live' : '💾 Local'}</span>
        </div>
        <nav className="run-nav">
          <NavLink end to={`/run/${runId}`}>Soul-Link Board</NavLink>
          <NavLink to={`/run/${runId}/bosses`}>Boss Guide</NavLink>
        </nav>
      </header>
      <main className="run-main">
        <Outlet context={{ run, reload }} />
      </main>
    </div>
  );
}

export const useRunContext = () => useOutletContext();
