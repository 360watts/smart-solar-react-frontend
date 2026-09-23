import React, { useState } from 'react';
import { Panel } from './ui';

export function QueryBox({ onAsk, disabled }: { onAsk: (question: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const canSubmit = !disabled && value.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onAsk(value.trim());
    setValue('');
  };

  return (
    <div style={{ marginBottom: 18, flexShrink: 0 }}>
      <div className="diag-mono-label" style={{ marginBottom: 8 }}>Query input</div>
      <Panel
        style={{
          display: 'flex', alignItems: 'stretch', padding: 0, overflow: 'hidden',
          borderColor: focused ? 'var(--diag-amber)' : 'var(--diag-border)',
          boxShadow: focused ? '0 0 0 3px var(--diag-amber-dim)' : 'none',
          transition: 'box-shadow 120ms, border-color 120ms',
        }}
      >
        <span
          style={{
            display: 'flex', alignItems: 'center', padding: '0 4px 0 14px',
            color: 'var(--diag-amber)', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
          }}
        >
          {'>'}
        </span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="query the fleet — e.g. why did h_0011 underperform on 2024-11-12?"
          disabled={disabled}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--diag-text)',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', padding: '11px 10px',
          }}
        />
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            flexShrink: 0, padding: '0 22px', border: 'none', borderLeft: '1px solid var(--diag-border)',
            cursor: canSubmit ? 'pointer' : 'default',
            background: canSubmit ? 'var(--diag-amber)' : 'var(--diag-raised)',
            color: canSubmit ? 'var(--diag-amber-on)' : 'var(--diag-muted)',
            fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em', fontFamily: "'Chakra Petch', sans-serif",
            transition: 'background 120ms, color 120ms',
          }}
        >
          RUN
        </button>
      </Panel>
    </div>
  );
}
