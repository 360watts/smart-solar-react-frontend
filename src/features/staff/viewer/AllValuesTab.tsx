import React, { useMemo, useState } from 'react';
import { hexCode } from './deviceChart';
import './allValues.css';

type Reading = { id: string; label: string; unit: string; keys: string[] };
type Point = { t: string } & Record<string, number>;
type Row = { key: string; label: string; unit: string; phase: number; value: unknown; line: number[]; code: boolean; changing: boolean; active: boolean };
type Group = { name: string; rows: Row[] };

const PH = ['R', 'Y', 'B'], PH_COLOR = ['var(--dc-r)', 'var(--dc-y)', 'var(--dc-b)'];
const FAULTS = 'Faults and warnings';
const CAP = 5, GROUP_CAP = 6;
const ICONS: Record<string, [string, string]> = {
  Solar: ['var(--dc-y)', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  Grid: ['var(--dc-b)', 'M13 2L4 14h7l-1 8 9-12h-7z'],
  [FAULTS]: ['var(--dc-warn-text)', 'M12 3l10 18H2zM12 10v5M12 18v.5'],
  'Home use': ['var(--dc-one)', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],
  Battery: ['var(--dc-one)', 'M4 8h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM22 11v3'],
  'Energy counters': ['var(--muted-foreground)', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
};
const DEFAULT_ICON: [string, string] = ['var(--muted-foreground)', 'M5 5h14v14H5zM9 9h6v6H9z'];

const fmt = (v: unknown) => (typeof v === 'number' ? (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-IN') : String(Math.round(v * 100) / 100)) : String(v));

function Spark({ line, color }: { line: number[]; color: string }) {
  if (line.length < 2) return <span />;
  const lo = Math.min(...line), span = Math.max(...line) - lo || 1, n = line.length - 1;
  return (
    <svg className="av-spark" viewBox="0 0 64 22" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" stroke={color}
        points={line.map((v, j) => `${(j / n) * 64},${20 - ((v - lo) / span) * 18}`).join(' ')} />
    </svg>
  );
}

/** All values: one card per group, each reading with its key, value and a last-hour line. */
const AllValuesTab: React.FC<{ sections: [string, Reading[]][]; latest: Record<string, unknown> | null; history: Point[]; lastReadingAt: string | null }> = ({ sections, latest, history, lastReadingAt }) => {
  const [find, setFind] = useState('');
  const [mode, setMode] = useState<'all' | 'changing' | 'faults'>('all');
  const [more, setMore] = useState<Set<string>>(new Set());
  const [allGroups, setAllGroups] = useState(false);
  const [copied, setCopied] = useState('');

  const groups = useMemo(() => {
    const end = history.length ? Date.parse(history[history.length - 1].t) : 0;
    const hour = history.filter(p => Date.parse(p.t) >= end - 3.6e6);
    const out = new Map<string, Row[]>();
    for (const [sec, readings] of sections) for (const r of readings) r.keys.forEach((key, i) => {
      const name = sec === 'Status and codes' && /fault|warning/.test(r.id) ? FAULTS : sec;
      const value = latest?.[key];
      const phased = r.keys.length > 1;
      const code = name === FAULTS;
      // counters (kWh) only go up and codes are not measurements: no line for them
      const line = name === 'Energy counters' || r.unit === 'kWh' || code || !r.unit ? [] : hour.flatMap(p => (typeof p[key] === 'number' ? [p[key]] : []));
      const row: Row = {
        key, label: phased ? r.label.replace(/ per phase$/, '') : r.label, unit: r.unit, phase: phased ? i : -1, value, line, code,
        changing: line.length > 1 && Math.min(...line) !== Math.max(...line), active: code && typeof value === 'number' && value !== 0,
      };
      out.set(name, [...(out.get(name) ?? []), row]);
    });
    const list: Group[] = [...out].map(([name, rows]) => ({ name, rows }));
    const f = list.findIndex(x => x.name === FAULTS), g = list.findIndex(x => x.name === 'Grid');
    if (f > g + 1 && g >= 0) list.splice(g + 1, 0, ...list.splice(f, 1)); // faults card right after Grid, as in the mockup
    return list;
  }, [sections, latest, history]);

  const all = groups.flatMap(g => g.rows);
  const changing = all.filter(r => r.changing).length, faults = all.filter(r => r.active).length;
  const q = find.trim().toLowerCase();
  const shown = groups.map(g => ({ ...g, rows: g.rows.filter(r =>
    (!q || r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)) && (mode === 'all' || (mode === 'changing' ? r.changing : r.active))) }))
    .filter(g => g.rows.length);
  const filtering = !!q || mode !== 'all';
  const capped = !allGroups && !filtering && shown.length > GROUP_CAP;
  const cards = capped ? shown.slice(0, GROUP_CAP) : shown;

  const copy = (key: string) => { navigator.clipboard?.writeText(key); setCopied(key); setTimeout(() => setCopied(c => (c === key ? '' : c)), 1500); };
  const toggle = (name: string) => setMore(s => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const time = lastReadingAt ? new Date(lastReadingAt).toLocaleTimeString('en-GB') : '';

  return (
    <>
      <div className="av-bar">
        <label className="av-find">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input type="search" aria-label="Find a value" placeholder="Find a value, e.g. grid voltage or pv2" value={find} onChange={e => setFind(e.target.value)} />
        </label>
        <button type="button" className="av-pill" aria-pressed={mode === 'all'} onClick={() => setMode('all')}>All {all.length}</button>
        <button type="button" className="av-pill" aria-pressed={mode === 'changing'} onClick={() => setMode('changing')}>Changing now <span className="av-cnt">{changing}</span></button>
        <button type="button" className="av-pill" aria-pressed={mode === 'faults'} onClick={() => setMode('faults')}>Faults and warnings <span className="av-cnt warn">{faults}</span></button>
        <span className="av-hint">{time && <>Latest reading <span className="av-num">{time}</span>. </>}Little line = last hour.</span>
      </div>
      {cards.length === 0 && <p className="av-empty">{mode === 'faults' && !q ? 'No faults or warnings right now.' : 'No value matches that.'}</p>}
      <div className="av-grid">
        {cards.map(g => {
          const open = more.has(g.name) || filtering, rows = open ? g.rows : g.rows.slice(0, CAP), fault = g.name === FAULTS;
          const [tone, path] = ICONS[g.name] ?? DEFAULT_ICON;
          const id = `av-${g.name.replace(/\W+/g, '-')}`;
          const active = g.rows.filter(r => r.active).length;
          return (
            <section key={g.name} className={`av-card${fault ? ' fault' : ''}`} aria-labelledby={id}>
              <div className="av-head">
                <span className="av-tile" style={{ ['--tone' as string]: tone }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg></span>
                <h3 id={id}>{g.name}</h3>
                <span className={`av-cnt${fault && active ? ' warn' : ''}`}>{fault ? `${active} active` : g.rows.length}</span>
              </div>
              {rows.map(r => {
                const v = r.value;
                const text = v == null ? '–' : r.code && typeof v === 'number' ? hexCode(v) : fmt(v);
                return (
                  <div className="av-row" key={r.key}>
                    <div className="av-l">
                      {r.phase >= 0 && <b style={{ color: PH_COLOR[r.phase] }}>{PH[r.phase]} </b>}{r.label}
                      <button type="button" className="av-key" onClick={() => copy(r.key)} title="Copy key">{copied === r.key ? 'Copied' : r.key}</button>
                    </div>
                    <div className={`av-v av-num${r.active ? ' warn' : ''}`}>{text}{r.unit && v != null && <span className="av-unit">{r.unit}</span>}</div>
                    <Spark line={r.line} color={r.phase >= 0 ? PH_COLOR[r.phase] : 'var(--dc-one)'} />
                  </div>
                );
              })}
              {!filtering && g.rows.length > CAP && <button type="button" className="av-more" onClick={() => toggle(g.name)}>{open ? 'Show fewer' : `Show ${g.rows.length - CAP} more`}</button>}
              {fault && <p className="av-note">Codes show as hex, exactly as the device sends them.</p>}
              {g.name === 'Energy counters' && <p className="av-note">Counters only go up, so no little line.</p>}
            </section>
          );
        })}
      </div>
      <div className="av-foot">
        {capped && <span>Showing {GROUP_CAP} of {shown.length} groups. <button type="button" className="av-link" onClick={() => setAllGroups(true)}>Show all groups</button></span>}
        <span>Tap a key to copy it.</span>
      </div>
    </>
  );
};

export default AllValuesTab;
