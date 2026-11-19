/** 30-day calendar (mockup C): one tile per day coloured by the chosen measure, amber ring on flagged days. */
import React from 'react';
import type { HouseDay } from '../../../../services/api';
import { calendarCells, fmtDay, type Metric, type Range } from './historyModel';
import { KpiTile, Seg } from './cardParts';

const SHADES = ['#E6F4F2', '#B7E3DC', '#6FC7BA', '#1F9E8E', '#0B6B60'];
const SHADES_DARK = ['#12302C', '#174A43', '#1E6B60', '#2A9C8B', '#5EEAD4'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const HistoryCalendar: React.FC<{
  days: HouseDay[]; range: Range; flagged: Set<string>; isDark: boolean;
  metric: Metric; onMetric: (m: Metric) => void; picked: string | null; onPick: (d: string) => void; onOpen: (d: string) => void;
}> = ({ days, range, flagged, isDark, metric, onMetric, picked, onPick, onOpen }) => {
  const cells = calendarCells(days, range, metric, flagged);
  const shades = isDark ? SHADES_DARK : SHADES;
  const sel = days.find(d => d.date === picked) ?? null;
  const own = sel && sel.home_kwh ? Math.round((((sel.from_solar_kwh ?? 0) + (sel.from_battery_kwh ?? 0)) / sel.home_kwh) * 100) : null;
  const fmt = (v: number | null) => (v == null ? '–' : metric === 'own' ? `${v}%` : v.toFixed(1));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Seg<Metric> label="Colour by" value={metric} isDark={isDark} onChange={onMetric}
          options={[['own', 'Own power'], ['pv', 'Solar made'], ['grid', 'Grid bought']]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {DOW.map(d => <div key={d} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textAlign: 'center' }}>{d}</div>)}
          {cells.map((c, i) => c.date == null ? <div key={`pad-${i}`} /> : (
            <button key={c.date} type="button" onClick={() => onPick(c.date!)} aria-pressed={picked === c.date}
              aria-label={`${fmtDay(c.date)}: ${fmt(c.value)}${c.flagged ? ', has a flag' : ''}${c.whole ? '' : ', inverter circuits only'}`}
              style={{
                border: 'none', borderRadius: 12, minHeight: 56, padding: 6, cursor: 'pointer', textAlign: 'left', minWidth: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Rubik, sans-serif',
                background: c.level < 0 ? 'transparent' : shades[c.level],
                color: c.level >= 3 && !isDark ? '#fff' : 'var(--foreground)',
                opacity: c.whole ? 1 : 0.55,
                boxShadow: c.flagged ? '0 0 0 3px #B45309' : c.level < 0 ? 'inset 0 0 0 1px var(--border)' : undefined,
                outline: picked === c.date ? '3px solid var(--foreground)' : undefined, outlineOffset: 2,
              }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{Number(c.date.slice(8))}</span>
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmt(c.value)}</span>
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
          Darker = better for the home. Amber ring = a flag that day. Faded = inverter circuits only.
        </p>
      </div>
      <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sel ? (
          <>
            <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'Rubik, sans-serif' }}>{fmtDay(sel.date)}</h3>
            <KpiTile isDark={isDark} tone="orange" label="Own power" value={own ?? '–'} unit={own != null ? '%' : undefined}
              sub={sel.whole_home ? undefined : 'Inverter circuits only'} />
            <KpiTile isDark={isDark} tone="blue" label="Grid bought" value={(sel.bought_kwh ?? sel.from_grid_kwh)?.toFixed(1) ?? '–'} unit="kWh"
              sub={`Solar made ${sel.pv_kwh?.toFixed(1) ?? '–'} kWh · home ${sel.home_kwh?.toFixed(1) ?? '–'} kWh`} />
            <button type="button" onClick={() => onOpen(sel.date)}
              style={{ minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--foreground)', color: 'var(--background)', fontWeight: 600, cursor: 'pointer' }}>
              Open this day
            </button>
          </>
        ) : <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Pick a day to see its numbers.</p>}
      </div>
    </div>
  );
};
