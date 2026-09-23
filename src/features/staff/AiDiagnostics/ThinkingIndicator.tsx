import React from 'react';

const STEPS = [
  { match: 'Querying telemetry...', label: 'Data Analyst' },
  { match: 'Checking fault manual...', label: 'Diagnostic Engineer' },
  { match: 'Drafting explanation...', label: 'Reporter' },
] as const;

const NO_ANOMALY_TRACE = 'No underperformance event found.';

type StepStatus = 'done' | 'active' | 'pending' | 'skipped';

/** Replaces AiChat.tsx's three-bouncing-dots pattern with a real 3-step progress tracker mapped
 * onto the graph's actual node_trace labels - each node appends its label to node_trace before
 * it starts work (see graph.py), so "trace i present" means "step i has started", and the last
 * trace present is the currently-running step. Makes the multi-agent pipeline visibly real,
 * step by step, not a black-box spinner. */
export function ThinkingIndicator({ traces }: { traces: string[] }) {
  if (traces.length === 0) return null;

  const noAnomaly = traces.includes(NO_ANOMALY_TRACE);
  const stepStatus = (i: number): StepStatus => {
    if (noAnomaly && i > 0) return 'skipped'; // Data Analyst alone decides "no anomaly", ends the run
    if (i >= traces.length) return 'pending';
    return i === traces.length - 1 ? 'active' : 'done';
  };
  const current = traces[traces.length - 1];

  return (
    // No outer Panel here - this renders inside index.tsx's already-framed right-column shell,
    // a divider is enough to separate it from what follows without nesting another bordered box.
    <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--diag-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="diag-mono-label">Pipeline progress</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--diag-amber)',
              animation: 'diag-pulse-ring 1.4s ease-out infinite',
            }}
          />
          <span style={{ fontSize: '0.6rem', color: 'var(--diag-amber)', fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
        {STEPS.map((step, i) => {
          const status = stepStatus(i);
          const color =
            status === 'done' ? 'var(--diag-cyan)' :
            status === 'active' ? 'var(--diag-amber)' :
            status === 'skipped' ? 'var(--diag-muted)' : 'var(--diag-border-bright)';
          return (
            <React.Fragment key={step.label}>
              {i > 0 && (
                <div
                  style={{
                    flex: 1, height: 2, marginTop: 8, background:
                      stepStatus(i - 1) === 'done' || stepStatus(i - 1) === 'active' ? 'var(--diag-cyan)' : 'var(--diag-border)',
                  }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div
                  style={{
                    width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${color}`, background: status === 'active' ? 'var(--diag-amber-dim)' : 'transparent',
                    color, fontSize: '0.55rem', fontWeight: 700,
                    animation: status === 'active' ? 'diag-pulse-ring 1.4s ease-out infinite' : 'none',
                  }}
                >
                  {status === 'done' ? '✓' : status === 'skipped' ? '–' : i + 1}
                </div>
                <span
                  className="diag-mono-label"
                  style={{ color, fontSize: '0.56rem', textAlign: 'center', maxWidth: 78, letterSpacing: '0.02em', lineHeight: 1.2 }}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--diag-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--diag-muted)' }}>▸</span>
        {noAnomaly ? 'No underperformance event found — stopping.' : current}
        <span className="diag-cursor" />
      </div>
    </div>
  );
}
