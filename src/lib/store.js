// Unified data layer for soul-link runs.
//
// Two interchangeable backends behind one API:
//   - local  : localStorage + BroadcastChannel (single machine, cross-tab realtime)
//   - cloud  : Supabase Postgres + Realtime (live 2-player sync across devices)
//
// A "run" is a soul-link playthrough with two players. Mutable state:
//   run     : { id, name, join_code, randomized, tokens }
//   players : [{ slot:1, name }, { slot:2, name }]
//   catches : [{ id, location_id, slot, species, nickname, level, status, source, notes }]
//
// API (all async):
//   createRun({ name, randomized, p1, p2 })            -> run
//   getRunByCode(code)                                  -> run | null
//   getRun(runId)                                       -> run | null
//   listCatches(runId)                                  -> catch[]
//   upsertCatch(runId, partialCatch)                    -> catch
//   deleteCatch(runId, id)                              -> void
//   setTokens(runId, slot, { nav, reroll })            -> run
//   subscribe(runId, onChange)                          -> unsubscribe()
import { supabase, CLOUD_ENABLED } from './supabase';

export const SYNC_MODE = CLOUD_ENABLED ? 'cloud' : 'local';

const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);

const makeCode = () => {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
};

const emptyTokens = () => ({ 1: { nav: 0, reroll: 0 }, 2: { nav: 0, reroll: 0 } });

/* ------------------------------------------------------------------ */
/* Local adapter                                                       */
/* ------------------------------------------------------------------ */
const LKEY = (id) => `pis:run:${id}`;
const LCODE = (code) => `pis:code:${code.toUpperCase()}`;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pis-sync') : null;

const localStore = {
  _read(id) {
    const raw = localStorage.getItem(LKEY(id));
    return raw ? JSON.parse(raw) : null;
  },
  _write(doc) {
    localStorage.setItem(LKEY(doc.run.id), JSON.stringify(doc));
    channel?.postMessage({ runId: doc.run.id });
  },
  async createRun({ name, randomized, p1, p2, eggCount }) {
    let code = makeCode();
    while (localStorage.getItem(LCODE(code))) code = makeCode();
    const run = { id: uid(), name, join_code: code, randomized: !!randomized, egg_count: eggCount ?? 6, team: [], custom_locations: [], wheel: [], tokens: emptyTokens() };
    const doc = {
      run,
      players: [
        { slot: 1, name: p1 || 'Player 1' },
        { slot: 2, name: p2 || 'Player 2' },
      ],
      catches: [],
    };
    localStorage.setItem(LCODE(code), run.id);
    this._write(doc);
    return this._compose(doc);
  },
  async getRunByCode(code) {
    const id = localStorage.getItem(LCODE(code));
    return id ? this.getRun(id) : null;
  },
  async getRun(id) {
    const doc = this._read(id);
    return doc ? this._compose(doc) : null;
  },
  _compose(doc) {
    return { ...doc.run, players: doc.players, catches: doc.catches };
  },
  async listCatches(id) {
    return this._read(id)?.catches ?? [];
  },
  async upsertCatch(id, c) {
    const doc = this._read(id);
    if (!doc) throw new Error('run not found');
    const next = { id: c.id || uid(), status: 'alive', source: 'manual', ...c };
    const i = doc.catches.findIndex((x) => x.id === next.id);
    if (i >= 0) doc.catches[i] = { ...doc.catches[i], ...next };
    else doc.catches.push(next);
    this._write(doc);
    return next;
  },
  async deleteCatch(id, catchId) {
    const doc = this._read(id);
    if (!doc) return;
    doc.catches = doc.catches.filter((x) => x.id !== catchId);
    this._write(doc);
  },
  async setTokens(id, slot, tokens) {
    const doc = this._read(id);
    doc.run.tokens = { ...doc.run.tokens, [slot]: { ...doc.run.tokens[slot], ...tokens } };
    this._write(doc);
    return this._compose(doc);
  },
  async updateRun(id, patch) {
    const doc = this._read(id);
    if (!doc) throw new Error('run not found');
    doc.run = { ...doc.run, ...patch };
    this._write(doc);
    return this._compose(doc);
  },
  subscribe(id, onChange) {
    const handler = (e) => {
      if (e.data?.runId === id) onChange();
    };
    const storageHandler = (e) => {
      if (e.key === LKEY(id)) onChange();
    };
    channel?.addEventListener('message', handler);
    window.addEventListener('storage', storageHandler);
    return () => {
      channel?.removeEventListener('message', handler);
      window.removeEventListener('storage', storageHandler);
    };
  },
};

/* ------------------------------------------------------------------ */
/* Cloud adapter (Supabase)                                            */
/* ------------------------------------------------------------------ */
const cloudStore = {
  async createRun({ name, randomized, p1, p2, eggCount }) {
    let code = makeCode();
    // ensure unique-ish; collisions are astronomically unlikely at this scale
    const { data, error } = await supabase
      .from('runs')
      .insert({
        name,
        join_code: code,
        randomized: !!randomized,
        egg_count: eggCount ?? 6,
        team: [],
        tokens: emptyTokens(),
        players: [
          { slot: 1, name: p1 || 'Player 1' },
          { slot: 2, name: p2 || 'Player 2' },
        ],
      })
      .select()
      .single();
    if (error) throw error;
    return { ...data, catches: [] };
  },
  async getRunByCode(code) {
    const { data } = await supabase.from('runs').select('*').eq('join_code', code.toUpperCase()).maybeSingle();
    return data ? this.getRun(data.id) : null;
  },
  async getRun(id) {
    const { data: run } = await supabase.from('runs').select('*').eq('id', id).maybeSingle();
    if (!run) return null;
    const catches = await this.listCatches(id);
    return { ...run, catches };
  },
  async listCatches(id) {
    const { data } = await supabase.from('catches').select('*').eq('run_id', id);
    return data ?? [];
  },
  async upsertCatch(id, c) {
    const row = { id: c.id || uid(), run_id: id, status: 'alive', source: 'manual', ...c };
    const { data, error } = await supabase.from('catches').upsert(row).select().single();
    if (error) throw error;
    return data;
  },
  async deleteCatch(id, catchId) {
    await supabase.from('catches').delete().eq('id', catchId);
  },
  async setTokens(id, slot, tokens) {
    const { data: run } = await supabase.from('runs').select('tokens').eq('id', id).single();
    const next = { ...run.tokens, [slot]: { ...run.tokens[slot], ...tokens } };
    const { data } = await supabase.from('runs').update({ tokens: next }).eq('id', id).select().single();
    return data;
  },
  async updateRun(id, patch) {
    const { data, error } = await supabase.from('runs').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  subscribe(id, onChange) {
    const ch = supabase
      .channel(`run-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches', filter: `run_id=eq.${id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runs', filter: `id=eq.${id}` }, onChange)
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
};

export const store = CLOUD_ENABLED ? cloudStore : localStore;
