import { useCallback, useEffect, useState } from 'react';
import { store } from './store.js';

// Loads a run and keeps it live: re-fetches whenever the backend signals a change
// (BroadcastChannel locally, or Supabase Realtime in cloud mode).
export function useRun(runId) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const r = await store.getRun(runId);
      if (!r) setError('Run not found');
      else {
        const catches = await store.listCatches(runId);
        setRun({ ...r, catches });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    reload();
    const unsub = store.subscribe(runId, reload);
    return unsub;
  }, [runId, reload]);

  return { run, loading, error, reload };
}
