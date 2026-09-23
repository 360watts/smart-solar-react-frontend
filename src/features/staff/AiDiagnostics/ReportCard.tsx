import React from 'react';
import { CitedText } from './CitationPopover';
import { Panel, Readout, SeverityChip } from './ui';
import type { DiagnosticReport } from './types';

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.4) return 'MED';
  return 'LOW';
}

// `bare` skips the outer Panel shell - used when a caller (index.tsx's right column) already
// provides that framing, so the report doesn't render as a nested bordered box inside another one.
export function ReportCard({ report, bare = false }: { report: DiagnosticReport; bare?: boolean }) {
  const confPct = Math.round(report.confidence * 100);
  const Wrapper = bare ? React.Fragment : Panel;
  const wrapperProps = bare ? {} : { style: { padding: '14px 16px 16px', animation: 'diag-fade-up 0.35s ease-out' } };

  return (
    <Wrapper {...wrapperProps}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div>
          <div className="diag-mono-label" style={{ marginBottom: 3 }}>
            {report.site_id} · {report.ts_start} → {report.ts_end}
          </div>
          <h2 className="diag-display" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--diag-text)' }}>
            {report.headline}
          </h2>
        </div>
        <span
          style={{
            flexShrink: 0, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', padding: '3px 7px',
            borderRadius: 5, border: '1px dashed var(--diag-border-bright)', color: 'var(--diag-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          PROTOTYPE · SYNTHETIC DATA
        </span>
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '9px 12px',
          background: 'var(--diag-raised)', border: '1px solid var(--diag-border)', borderRadius: 8, marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="diag-mono-label">Severity</span>
          <SeverityChip severity={report.severity} />
        </div>
        <Readout label="Confidence" value={`${confPct}%`} sub={confidenceLabel(report.confidence)} accent="var(--diag-cyan)" />
        <Readout label="Deficit" value={report.metric_summary} />
      </div>

      <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--diag-text)', marginBottom: 10 }}>
        <span className="diag-mono-label" style={{ display: 'block', marginBottom: 4 }}>Root cause analysis</span>
        <CitedText text={report.root_cause_text} citations={report.citations} />
      </div>

      <div
        style={{
          background: 'var(--diag-amber-dim)', border: '1px solid var(--diag-amber)', borderRadius: 8,
          padding: '8px 12px', fontSize: '0.78rem', lineHeight: 1.4, color: 'var(--diag-text)',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--diag-amber)', fontFamily: "'Chakra Petch', sans-serif" }}>
          ▸ RECOMMENDED ACTION{'  '}
        </span>
        {report.recommended_action}
      </div>
    </Wrapper>
  );
}
