import React, { useState } from 'react';
import type { Citation } from './types';

/** Inline, clickable [n] marker that expands to the actual retrieved chunk - per the citation-UX
 * research this project's plan cites: "inline numbered references + expandable source cards" is
 * the documented pattern, not a separate list at the bottom of the card. Styled as a component
 * reference tag (like a PCB silkscreen designator), matching the diagnostic-bench aesthetic. */
export function CitationMarker({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          border: '1px solid var(--diag-cyan)', background: 'var(--diag-cyan-dim)', cursor: 'pointer',
          padding: '0 5px', margin: '0 1px', borderRadius: 4, color: 'var(--diag-cyan)', fontWeight: 700,
          fontSize: '0.68em', verticalAlign: 'super', fontFamily: 'IBM Plex Mono, monospace',
        }}
        aria-label={`Show citation ${citation.index}`}
      >
        {citation.index}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', bottom: '130%', left: 0, zIndex: 20, width: 280,
            background: 'var(--diag-raised)', border: '1px solid var(--diag-border-bright)', borderRadius: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,0.5)', padding: '10px 12px', fontSize: '0.78rem',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--diag-amber)', marginBottom: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
            REF {citation.source} · {citation.ref}
          </div>
          <div style={{ color: 'var(--diag-dim)', maxHeight: 160, overflowY: 'auto' }} className="diag-scroll">
            {citation.text}
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ marginTop: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--diag-muted)', fontSize: '0.7rem' }}
          >
            close ×
          </button>
        </div>
      )}
    </span>
  );
}

/** Splits root_cause_text on [n] markers, rendering valid ones (matching a citation) as
 * clickable CitationMarkers and leaving any other bracketed text as plain text - the backend's
 * DiagnosticReport Pydantic validator already strips orphaned markers server-side, this is a
 * defensive second layer, not the only guard. */
export function CitedText({ text, citations }: { text: string; citations: Citation[] }) {
  const byIndex = new Map(citations.map(c => [c.index, c]));
  const parts = text.split(/(\[\d+\])/);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const citation = byIndex.get(Number(match[1]));
          if (citation) return <CitationMarker key={i} citation={citation} />;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
