import React, { useMemo, useState } from 'react';
import type { UnderperformanceEvent } from './types';

interface Props {
  events: UnderperformanceEvent[];
  loading: boolean;
  selectedIndex: number | null;
  onSelect: (event: UnderperformanceEvent, index: number) => void;
}

// Sweeping the full fleet over a wide window returns thousands of weather-correlated windows,
// not distinct faults to triage - capping to the worst few dozen groups is what's actually
// useful here, not an unbounded feed.
const MAX_GROUPS = 30;

type GroupMode = 'day' | 'site' | 'severity';

type Row = { event: UnderperformanceEvent; i: number };
type Group = { key: string; label: React.ReactNode; badge?: React.ReactNode; rows: Row[]; worst: number };

function severity(deficit: number): { key: string; label: string; color: string } {
  if (deficit >= 50) return { key: 'high', label: 'HIGH', color: 'var(--diag-danger)' };
  if (deficit >= 25) return { key: 'medium', label: 'MEDIUM', color: 'var(--diag-amber)' };
  return { key: 'low', label: 'LOW', color: 'var(--diag-success)' };
}

const selectStyle: React.CSSProperties = {
  fontSize: '0.72rem', padding: '5px 7px', borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace",
  border: '1px solid var(--diag-border-bright)', background: 'var(--diag-raised)', color: 'var(--diag-text)',
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', borderRadius: 999,
  padding: '1px 7px', border: `1px solid ${color}`, color, whiteSpace: 'nowrap',
});

export function EventListView({ events, loading, selectedIndex, onSelect }: Props) {
  const [groupMode, setGroupMode] = useState<GroupMode>('day');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  // Defaults on: most raw events are fleet-wide weather correlation (near-identical rows,
  // "18 SITES / worst -100%" repeated 30 times) - genuinely diagnosable single-site faults are
  // the minority and were getting buried under that noise. Off = see everything.
  const [isolatedOnly, setIsolatedOnly] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Before any click, group 0 is open by convention (not recorded in `expanded`) - `touched`
  // tracks whether the user has actually toggled anything, so a click on group 0 can register as
  // "closed" instead of being a no-op against a Set it was never really in.
  const [touched, setTouched] = useState(false);

  const sites = useMemo(
    () => Array.from(new Set(events.map(e => e.site_id))).sort(),
    [events],
  );

  // A "day" with only one site affected is much more likely a real site-specific fault than
  // fleet-wide weather correlation (confirmed by this project's own anomaly sweep - most raw
  // events are same-day across many sites at once). Computed client-side from whatever page of
  // events is already loaded, not an exact backend signal.
  const isolatedDates = useMemo(() => {
    const sitesByDate = new Map<string, Set<string>>();
    for (const e of events) {
      const day = e.ts_start.slice(0, 10);
      if (!sitesByDate.has(day)) sitesByDate.set(day, new Set());
      sitesByDate.get(day)!.add(e.site_id);
    }
    return new Set([...sitesByDate].filter(([, s]) => s.size === 1).map(([day]) => day));
  }, [events]);

  const filtered = events
    .map((event, i) => ({ event, i }))
    .filter(({ event }) => siteFilter === 'all' || event.site_id === siteFilter)
    .filter(({ event }) => !isolatedOnly || isolatedDates.has(event.ts_start.slice(0, 10)));

  const groups: Group[] = useMemo(() => {
    if (groupMode === 'day') {
      const byDay = new Map<string, Row[]>();
      for (const row of filtered) {
        const day = row.event.ts_start.slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(row);
      }
      return [...byDay.entries()]
        .map(([day, rows]) => {
          const worst = Math.max(...rows.map(r => r.event.avg_deficit_pct));
          const isolated = rows.length === 1;
          return {
            key: day, label: day, rows: rows.sort((a, b) => b.event.avg_deficit_pct - a.event.avg_deficit_pct), worst,
            badge: (
              <span style={badgeStyle(isolated ? 'var(--diag-success)' : 'var(--diag-muted)')}>
                {isolated ? 'SINGLE-SITE' : `${rows.length} SITES`}
              </span>
            ),
          };
        })
        .sort((a, b) => b.worst - a.worst)
        .slice(0, MAX_GROUPS);
    }
    if (groupMode === 'site') {
      const bySite = new Map<string, Row[]>();
      for (const row of filtered) {
        if (!bySite.has(row.event.site_id)) bySite.set(row.event.site_id, []);
        bySite.get(row.event.site_id)!.push(row);
      }
      return [...bySite.entries()]
        .map(([site, rows]) => {
          const worst = Math.max(...rows.map(r => r.event.avg_deficit_pct));
          return {
            key: site, label: site, rows: rows.sort((a, b) => b.event.avg_deficit_pct - a.event.avg_deficit_pct), worst,
            badge: <span style={badgeStyle('var(--diag-cyan)')}>{rows.length} EVENT{rows.length > 1 ? 'S' : ''}</span>,
          };
        })
        .sort((a, b) => b.worst - a.worst)
        .slice(0, MAX_GROUPS);
    }
    // severity - fixed 3 bands, high -> medium -> low
    const bands: Record<string, Row[]> = { high: [], medium: [], low: [] };
    for (const row of filtered) bands[severity(row.event.avg_deficit_pct).key].push(row);
    return (['high', 'medium', 'low'] as const)
      .filter(key => bands[key].length > 0)
      .map(key => {
        const rows = bands[key].sort((a, b) => b.event.avg_deficit_pct - a.event.avg_deficit_pct);
        const sev = severity(rows[0].event.avg_deficit_pct);
        return {
          key, label: `${sev.label} SEVERITY`, rows, worst: rows[0].event.avg_deficit_pct,
          badge: <span style={badgeStyle(sev.color)}>{rows.length}</span>,
        };
      });
  }, [filtered, groupMode]);

  if (loading) {
    return <div className="diag-mono-label" style={{ padding: 24 }}>LOADING EVENT FEED…</div>;
  }
  if (events.length === 0) {
    return <div className="diag-mono-label" style={{ padding: 24 }}>NO EVENTS IN THIS WINDOW</div>;
  }

  const isOpen = (key: string, i: number) => (touched ? expanded.has(key) : i === 0);
  const toggle = (key: string, i: number) => {
    const wasOpen = isOpen(key, i); // read before setTouched - needs the pre-click state
    setTouched(true);
    setExpanded(prev => {
      const next = new Set(prev);
      if (wasOpen) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    // Fills its parent Panel (a flex column with a fixed height from index.tsx's grid row) -
    // filters/count stay fixed height, the group list gets the remaining space and scrolls
    // internally instead of guessing a page-scroll-relative maxHeight.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <select
          value={groupMode}
          onChange={e => { setGroupMode(e.target.value as GroupMode); setExpanded(new Set()); setTouched(false); }}
          style={selectStyle}
        >
          <option value="day">GROUP: DAY</option>
          <option value="site">GROUP: SITE</option>
          <option value="severity">GROUP: SEVERITY</option>
        </select>
        <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} style={selectStyle}>
          <option value="all">ALL SITES</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--diag-dim)',
            cursor: 'pointer', letterSpacing: '0.04em',
          }}
        >
          <input type="checkbox" checked={isolatedOnly} onChange={e => setIsolatedOnly(e.target.checked)} />
          SINGLE-SITE ONLY
        </label>
      </div>

      <div className="diag-mono-label" style={{ marginBottom: 8, flexShrink: 0 }}>
        {filtered.length} event{filtered.length === 1 ? '' : 's'} · {groups.length} group{groups.length === 1 ? '' : 's'}
        {groups.length >= MAX_GROUPS ? ` (worst ${MAX_GROUPS} shown)` : ''}
      </div>

      <div
        className="diag-scroll"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}
      >
        {groups.length === 0 && (
          <div className="diag-mono-label" style={{ padding: 16 }}>NO MATCHES FOR THESE FILTERS</div>
        )}
        {groups.map((group, gi) => {
          const open = isOpen(group.key, gi);
          return (
            <div key={group.key} style={{ border: '1px solid var(--diag-border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <button
                onClick={() => toggle(group.key, gi)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '9px 11px', background: 'var(--diag-raised)', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span className="diag-display" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--diag-text)' }}>
                  {group.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {group.badge}
                  <span style={{ fontSize: '0.7rem', color: 'var(--diag-dim)' }}>worst −{group.worst.toFixed(0)}%</span>
                  <span style={{ color: 'var(--diag-dim)', fontSize: '0.7rem', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
                </span>
              </button>
              {open && (
                <div className="diag-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {group.rows.map(({ event, i }) => {
                    const selected = i === selectedIndex;
                    const sev = severity(event.avg_deficit_pct);
                    return (
                      <button
                        key={`${event.site_id}-${event.ts_start}`}
                        onClick={() => onSelect(event, i)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          textAlign: 'left', padding: '7px 11px', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--diag-border)',
                          background: selected ? 'var(--diag-cyan-dim)' : 'transparent',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev.color, flexShrink: 0 }} />
                          {groupMode !== 'site' && (
                            <span className="diag-display" style={{ fontWeight: 700, color: 'var(--diag-text)' }}>{event.site_id}</span>
                          )}
                          <span style={{ color: 'var(--diag-dim)', fontSize: '0.7rem' }}>
                            {groupMode === 'day' ? `${event.ts_start.slice(11)} → ${event.ts_end.slice(11)}` : `${event.ts_start} → ${event.ts_end}`}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: sev.color }}>
                          −{event.avg_deficit_pct.toFixed(0)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
