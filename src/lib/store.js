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

// The prize wheels are GLOBAL (shared across every run, and between both players), not per-run. In
// cloud mode they live on a single sentinel `runs` row with this fixed id (reuses the existing `wheel`
// column + open RLS, so no new table/migration). In local mode they live in one localStorage key.
const WHEELS_ID = '00000000-0000-0000-0000-000000000000';
const WHEELS_LKEY = 'pis:wheels';

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
    const run = { id: uid(), name, join_code: code, randomized: !!randomized, egg_count: eggCount ?? 6, team: [], custom_locations: [], tokens: emptyTokens() };
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
  // Global prize wheels (shared across all runs on this device).
  async getWheels() {
    const raw = localStorage.getItem(WHEELS_LKEY);
    return raw ? JSON.parse(raw) : null;
  },
  async setWheels(wheel) {
    localStorage.setItem(WHEELS_LKEY, JSON.stringify(wheel));
    channel?.postMessage({ wheels: true });
    return wheel;
  },
  subscribeWheels(onChange) {
    const handler = (e) => { if (e.data?.wheels) onChange(); };
    const storageHandler = (e) => { if (e.key === WHEELS_LKEY) onChange(); };
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
    // Conflict target is the composite primary key (run_id, id) — see migration-006. This is what
    // keeps a catch (and its manually-typed ability) scoped to ONE run: a different run upserting the
    // same "<location>:<slot>" id inserts its own row instead of merging onto another run's row.
    const { data, error } = await supabase.from('catches').upsert(row, { onConflict: 'run_id,id' }).select().single();
    if (error) throw error;
    return data;
  },
  async deleteCatch(id, catchId) {
    // Scope by run_id too: the catch id ("<location>:<slot>") is only unique WITHIN a run now that
    // the primary key is composite (run_id, id), so the same id can exist in other runs.
    await supabase.from('catches').delete().eq('run_id', id).eq('id', catchId);
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
  // Global prize wheels: one shared sentinel row, so they're the same in every run and synced between
  // both players. Reuses the runs table's `wheel` column (open RLS) — no extra table/migration.
  async getWheels() {
    const { data } = await supabase.from('runs').select('wheel').eq('id', WHEELS_ID).maybeSingle();
    return data?.wheel ?? null;
  },
  async setWheels(wheel) {
    const { error } = await supabase
      .from('runs')
      .upsert({ id: WHEELS_ID, name: '__wheels__', join_code: '__WHEELS__', wheel })
      .select()
      .single();
    if (error) throw error;
    return wheel;
  },
  subscribeWheels(onChange) {
    const ch = supabase
      .channel('wheels-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runs', filter: `id=eq.${WHEELS_ID}` }, onChange)
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
};

export const store = CLOUD_ENABLED ? cloudStore : localStore;
