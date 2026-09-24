import React, { useEffect, useState } from 'react';
import './diagnostics.css';
import { useTheme } from '../../../contexts/ThemeContext';
import { getEvents, streamDiagnosis } from './api';
import { EventListView } from './EventListView';
import { QueryBox } from './QueryBox';
import { ReportCard } from './ReportCard';
import { ThinkingIndicator } from './ThinkingIndicator';
import { Panel } from './ui';
import { isPlainAnswer } from './types';
import type { DiagnosticReport, UnderperformanceEvent } from './types';

export default function AiDiagnostics() {
  const { isDark } = useTheme();
  const [events, setEvents] = useState<UnderperformanceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [traces, setTraces] = useState<string[]>([]);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [plainAnswer, setPlainAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noAnomaly, setNoAnomaly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEvents(undefined, '400d') // 400d rather than the API's own 30d default - so this
      // prototype's fixed-in-time synthetic dataset shows a real, non-empty demo list out of
      // the box; a real "today"-relative deployment would use the default.
      .then(list => { if (!cancelled) setEvents(list); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const runDiagnosis = (req: Parameters<typeof streamDiagnosis>[0]) => {
    setStreaming(true);
    setTraces([]);
    setReport(null);
    setPlainAnswer(null);
    setError(null);
    setNoAnomaly(false);
    streamDiagnosis(req, {
      onTrace: label => {
        if (label === 'No underperformance event found.') setNoAnomaly(true);
        setTraces(prev => [...prev, label]);
      },
      onResult: r => {
        if (isPlainAnswer(r)) setPlainAnswer(r.plain_answer);
        else setReport(r);
      },
      onError: msg => setError(msg),
    }).finally(() => setStreaming(false));
  };

  const handleSelectEvent = (event: UnderperformanceEvent, index: number) => {
    // QueryBox already disables itself while streaming; the event list didn't, so a click
    // mid-run started a second concurrent stream writing into the same state, with the first
    // one never aborted. Ignoring clicks until the current run ends is the minimal fix.
    if (streaming) return;
    setSelectedIndex(index);
    runDiagnosis({
      site_id: event.site_id, ts_start: event.ts_start, ts_end: event.ts_end,
      avg_deficit_pct: event.avg_deficit_pct,
    });
  };

  const handleAsk = (question: string) => {
    setSelectedIndex(null);
    runDiagnosis({ question });
  };

  return (
    // Fixed to the viewport, not the page - `.staff-main`'s own top+bottom padding is
    // `clamp(16px, 2.5vw, 36px)` each (StaffLayout.tsx), so ~64-72px is already spoken for above
    // and below this element; budgeting 80px covers that with a little room. Both columns below
    // share one flex row (`flex: 1, minHeight: 0`) so they're always the same height by
    // construction, each scrolling internally - no page-level scroll, no position:sticky needed.
    <div
      className={`diag-root${isDark ? '' : ' diag-light'}`}
      style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
        <div>
          <div className="diag-mono-label" style={{ marginBottom: 6 }}>SYSTEM // MULTI-AGENT DIAGNOSTICS</div>
          <h1 className="diag-display" style={{ fontSize: '1.9rem', fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
            AI DIAGNOSTICS
          </h1>
          <div style={{ fontSize: '0.78rem', color: 'var(--diag-muted)', marginTop: 4 }}>
            text-to-SQL analyst → RAG diagnostic engineer → cited report — prototype, synthetic data
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--diag-success)', boxShadow: '0 0 8px var(--diag-success)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--diag-success)', fontWeight: 700, letterSpacing: '0.08em' }}>ONLINE</span>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <QueryBox onAsk={handleAsk} disabled={streaming} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 330px) 1fr', gap: 18, flex: 1, minHeight: 0 }}>
        <Panel style={{ padding: 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="diag-mono-label" style={{ marginBottom: 10, flexShrink: 0 }}>Detected events</div>
          <EventListView events={events} loading={eventsLoading} selectedIndex={selectedIndex} onSelect={handleSelectEvent} />
        </Panel>

        <Panel style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {streaming && <ThinkingIndicator traces={traces} />}
          {error && (
            <div style={{ color: 'var(--diag-danger)', fontSize: '0.8rem' }}>{error}</div>
          )}
          {!streaming && noAnomaly && !error && !plainAnswer && (
            <span className="diag-mono-label">No underperformance event found for this question.</span>
          )}
          {plainAnswer && (
            <div>
              <div className="diag-mono-label" style={{ marginBottom: 6 }}>Direct answer — not an anomaly question</div>
              <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--diag-text)' }}>{plainAnswer}</div>
            </div>
          )}
          {report && <ReportCard report={report} bare />}
          {!streaming && !report && !plainAnswer && !error && !noAnomaly && (
            <span className="diag-mono-label">Select an event on the left, or run a query above.</span>
          )}
        </Panel>
      </div>
    </div>
  );
}
