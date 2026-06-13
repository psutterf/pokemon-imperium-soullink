import { useMemo, useState } from 'react';
import { useRunContext } from './runContext.js';
import bosses from '../data/bosses.json';
import { findSpecies, findMove, SPECIES_NAMES, ABILITY_NAMES, MOVE_NAMES, parseSpread } from '../lib/dex.js';
import { NATURE_LIST } from '../data/natures.js';
import { TYPE_NAMES, TYPE_COLORS } from '../data/typechart.js';
import { calcDamage, computeStats } from '../lib/damage.js';
import { STAT_LABELS } from '../data/bossMeta.js';

const ITEMS = ['', 'Life Orb', 'Choice Band', 'Choice Specs', 'Expert Belt', 'Assault Vest',
  'Muscle Band', 'Wise Glasses'];

const blankMon = () => ({
  source: 'manual', species: '', level: 50, nature: 'Hardy', ability: '', item: '',
  evs: [0, 0, 0, 0, 0, 0], ivs: [31, 31, 31, 31, 31, 31],
  boost: 0, defBoost: 0, spdBoost: 0, hpPct: 100, status: false, moveName: '', bossMoves: null,
});

// Turn a form into the spec the damage engine expects (or null if species unknown).
function toSpec(form) {
  const sp = findSpecies(form.species);
  if (!sp) return null;
  return {
    name: sp.n, baseStats: sp.s, types: sp.t,
    level: Number(form.level) || 50, nature: form.nature,
    ability: form.ability, item: form.item,
    evs: form.evs, ivs: form.ivs,
    boost: Number(form.boost) || 0, defBoost: Number(form.defBoost) || 0, spdBoost: Number(form.spdBoost) || 0,
    hpPct: Number(form.hpPct) || 100, status: form.status,
  };
}

export default function Calc() {
  const { run } = useRunContext();
  const [att, setAtt] = useState(blankMon);
  const [def, setDef] = useState(blankMon);
  const [field, setField] = useState({ weather: '', crit: false, reflect: false, lightScreen: false, multi: false, burn: false });

  const boxMons = useMemo(
    () => run.catches.filter((c) => c.species && findSpecies(c.species)),
    [run.catches]);

  const result = useMemo(() => {
    const a = toSpec(att), d = toSpec(def);
    const mv = findMove(att.moveName);
    if (!a || !d) return { error: 'Pick a species for both sides.' };
    if (!mv) return { error: 'Pick an attacking move.' };
    return calcDamage({
      attacker: a, defender: { ...d, defBoost: def.defBoost, spdBoost: def.spdBoost },
      move: { power: mv.p, type: mv.t, c: mv.c, contact: false },
      field: {
        weather: field.weather, crit: field.crit, reflect: field.reflect,
        lightScreen: field.lightScreen, multi: field.multi, burn: field.burn,
        sand: field.weather === 'sand',
      },
    });
  }, [att, def, field]);

  const mv = findMove(att.moveName);

  return (
    <div className="calc">
      <p className="muted small">Gen-8 damage calculator. Auto-fill either side from your boxes or a boss team, tweak any field, and read the damage range.</p>
      <div className="calc-grid">
        <MonForm role="attacker" form={att} setForm={setAtt} boxMons={boxMons} />
        <div className="calc-mid">
          <Result result={result} move={mv} att={att} def={def} field={field} setField={setField} />
        </div>
        <MonForm role="defender" form={def} setForm={setDef} boxMons={boxMons} />
      </div>
    </div>
  );
}

function Result({ result, move, att, def, field, setField }) {
  const toggle = (k) => setField((f) => ({ ...f, [k]: !f[k] }));
  return (
    <div className="result-card">
      <h3>Result</h3>
      {result.error ? (
        <p className="muted">{result.error}</p>
      ) : result.immune ? (
        <p className="dmg-immune">No effect (immune).</p>
      ) : (
        <>
          <div className="dmg-range">{result.min}–{result.max}</div>
          <div className="dmg-pct">{result.minPct}% – {result.maxPct}%</div>
          <div className="dmg-eff">
            {move && <span>{att.species || '?'}'s {move.n} → {def.species || '?'}</span>}
            <span className={`eff-badge eff-${result.eff}`}>×{result.eff}</span>
          </div>
          <div className="muted small">
            {result.guaranteedKO ? 'Guaranteed OHKO' : `${result.hitsToKO} hit(s) to KO`} · target HP {result.maxHP}
            {move ? ` · ${result.power} BP ${move.c}` : ''}
          </div>
        </>
      )}

      <div className="field-conds">
        <label><select value={field.weather} onChange={(e) => setField((f) => ({ ...f, weather: e.target.value }))}>
          <option value="">No weather</option><option value="sun">Sun</option><option value="rain">Rain</option>
          <option value="sand">Sandstorm</option><option value="snow">Snow</option>
        </select></label>
        <label className="ck"><input type="checkbox" checked={field.crit} onChange={() => toggle('crit')} /> Critical hit</label>
        <label className="ck"><input type="checkbox" checked={field.reflect} onChange={() => toggle('reflect')} /> Reflect</label>
        <label className="ck"><input type="checkbox" checked={field.lightScreen} onChange={() => toggle('lightScreen')} /> Light Screen</label>
        <label className="ck"><input type="checkbox" checked={field.multi} onChange={() => toggle('multi')} /> Spread move</label>
        <label className="ck"><input type="checkbox" checked={field.burn} onChange={() => toggle('burn')} /> Attacker burned</label>
      </div>
    </div>
  );
}

function MonForm({ role, form, setForm, boxMons }) {
  const isAtt = role === 'attacker';
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const [bossIdx, setBossIdx] = useState('');
  const sp = findSpecies(form.species);
  const stats = sp ? computeStats(toSpec(form)) : null;

  const fromBox = (id) => {
    const c = boxMons.find((m) => `${m.location_id}:${m.slot}` === id);
    if (!c) return;
    set({ species: c.species, level: c.level || 50, ability: c.ability || '', nature: c.nature || 'Hardy',
      item: '', evs: [0, 0, 0, 0, 0, 0], ivs: [31, 31, 31, 31, 31, 31], bossMoves: null, moveName: '' });
  };
  const fromBossMon = (boss, p) => {
    set({
      species: p.species.replace(/-Mega.*$/, ''), level: p.level || 50, ability: p.ability || '',
      nature: p.nature || 'Hardy', item: p.item || '',
      evs: parseSpread(p.evs, 0), ivs: parseSpread(p.ivs, 31),
      bossMoves: p.moves || [], moveName: isAtt ? (p.moves?.[0] || '') : '',
    });
  };

  const boss = bossIdx === '' ? null : bosses[Number(bossIdx)];
  const moveOptions = form.bossMoves?.length ? form.bossMoves : MOVE_NAMES;

  return (
    <div className="mon-form">
      <div className="mf-head">
        <h3>{isAtt ? '⚔ Attacker' : '🛡 Defender'}</h3>
        {sp && <div className="mf-types">{sp.t.map((t) => <span key={t} className="type-badge" style={{ background: TYPE_COLORS[TYPE_NAMES[t]] }}>{TYPE_NAMES[t]}</span>)}</div>}
      </div>

      <div className="mf-source">
        <select onChange={(e) => { if (e.target.value) fromBox(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="">⤓ From box…</option>
          {boxMons.map((c) => <option key={`${c.location_id}:${c.slot}`} value={`${c.location_id}:${c.slot}`}>
            {c.species}{c.nickname ? ` “${c.nickname}”` : ''} (P{c.slot})
          </option>)}
        </select>
        <select value={bossIdx} onChange={(e) => setBossIdx(e.target.value)}>
          <option value="">⚑ From boss…</option>
          {bosses.map((b, i) => <option key={i} value={i}>{b.name}</option>)}
        </select>
        {boss && (
          <select defaultValue="" onChange={(e) => { if (e.target.value !== '') fromBossMon(boss, boss.pokemon[Number(e.target.value)]); }}>
            <option value="">— pick mon —</option>
            {boss.pokemon.map((p, i) => <option key={i} value={i}>{p.species} Lv{p.level}</option>)}
          </select>
        )}
      </div>

      <label className="mf-row">Species
        <input list="all-species" value={form.species} onChange={(e) => set({ species: e.target.value })} placeholder="Species" />
      </label>
      <div className="mf-grid2">
        <label>Level<input type="number" value={form.level} onChange={(e) => set({ level: e.target.value })} /></label>
        <label>Nature<select value={form.nature} onChange={(e) => set({ nature: e.target.value })}>{NATURE_LIST.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Ability<input list="all-abilities" value={form.ability} onChange={(e) => set({ ability: e.target.value })} /></label>
        <label>Item<select value={form.item} onChange={(e) => set({ item: e.target.value })}>{ITEMS.map((it) => <option key={it} value={it}>{it || '(none)'}</option>)}</select></label>
      </div>

      {isAtt && (
        <label className="mf-row">Move
          <input list={`moves-${role}`} value={form.moveName} onChange={(e) => set({ moveName: e.target.value })} placeholder="Move" />
          <datalist id={`moves-${role}`}>{moveOptions.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
      )}

      <StatEditor form={form} set={set} stats={stats} role={role} />

      <div className="mf-grid2">
        {isAtt
          ? <label>Atk boost<BoostSelect value={form.boost} onChange={(v) => set({ boost: v })} /></label>
          : <>
              <label>Def boost<BoostSelect value={form.defBoost} onChange={(v) => set({ defBoost: v })} /></label>
              <label>SpD boost<BoostSelect value={form.spdBoost} onChange={(v) => set({ spdBoost: v })} /></label>
            </>}
        <label>HP %<input type="number" min="1" max="100" value={form.hpPct} onChange={(e) => set({ hpPct: e.target.value })} /></label>
        {isAtt && <label className="ck">Statused<input type="checkbox" checked={form.status} onChange={(e) => set({ status: e.target.checked })} /></label>}
      </div>

      <datalist id="all-species">{SPECIES_NAMES.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="all-abilities">{ABILITY_NAMES.map((a) => <option key={a} value={a} />)}</datalist>
    </div>
  );
}

function BoostSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((s) => <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>)}
    </select>
  );
}

function StatEditor({ form, set, stats }) {
  const [open, setOpen] = useState(false);
  const setArr = (key, i, v) => { const a = [...form[key]]; a[i] = Math.max(0, Math.min(key === 'ivs' ? 31 : 252, Number(v) || 0)); set({ [key]: a }); };
  return (
    <div className="stat-editor">
      <button className="se-toggle" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▸'} EVs / IVs {stats && <span className="muted small">· {STAT_LABELS.map((l, i) => `${l} ${stats[i]}`).join('  ')}</span>}</button>
      {open && (
        <div className="se-grid">
          <span />{STAT_LABELS.map((l) => <span key={l} className="se-lbl">{l}</span>)}
          <span className="se-lbl">EV</span>{form.evs.map((v, i) => <input key={i} type="number" value={v} onChange={(e) => setArr('evs', i, e.target.value)} />)}
          <span className="se-lbl">IV</span>{form.ivs.map((v, i) => <input key={i} type="number" value={v} onChange={(e) => setArr('ivs', i, e.target.value)} />)}
        </div>
      )}
    </div>
  );
}
