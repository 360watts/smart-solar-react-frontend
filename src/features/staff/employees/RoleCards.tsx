import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import { useTokens } from '../siteHardware/ui';
import { ROLES, RoleKey } from './roles';

export function RoleCards({ isDark, value, onChange, disabled = false }: {
  isDark: boolean; value: RoleKey; onChange: (r: RoleKey) => void; disabled?: boolean;
}) {
  const t = useTokens(isDark);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + ROLES.length) % ROLES.length;
    onChange(ROLES[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Role" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {ROLES.map((r, i) => {
        const on = r.key === value;
        return (
          <button
            key={r.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(r.key)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
            }}
            style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 14, minHeight: 96,
              border: `2px solid ${on ? t.good : t.line}`, background: on ? t.goodBg : t.card2,
              color: t.ink, fontFamily: t.body, cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled && !on ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: t.head, fontWeight: 700, fontSize: '1rem' }}>{r.label}</span>
              <span style={{
                width: 22, height: 22, borderRadius: 999, boxSizing: 'border-box', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${on ? t.good : t.line}`, background: on ? t.good : 'transparent',
              }}>
                {on && <Check size={12} color="#fff" strokeWidth={3.5} />}
              </span>
            </span>
            <span style={{ fontSize: '0.82rem', lineHeight: 1.45, color: t.ink2 }}>{r.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
