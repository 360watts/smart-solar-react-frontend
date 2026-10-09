import React from 'react';
import { RoleKey, initialsOf, Person } from './roles';
import { useTokens } from '../siteHardware/ui';

const PALETTE: [string, string][] = [
  ['#e3e1fb', '#2b2a6b'], ['#D9EFEE', '#0B4D49'], ['#fbe8cf', '#7a4504'],
  ['#dcecf3', '#0b4a60'], ['#f5dde6', '#6e1f43'], ['#e9ecd2', '#4a5210'],
];

function paletteFor(email: string): [string, string] {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ person, size = 44 }: { person: Pick<Person, 'first_name' | 'last_name' | 'email'>; size?: number }) {
  const [bg, fg] = paletteFor(person.email);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: 999, flexShrink: 0, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', background: bg, color: fg,
        fontFamily: "'Rubik', sans-serif", fontWeight: 600, fontSize: Math.round(size * 0.34),
      }}
    >
      {initialsOf(person)}
    </span>
  );
}

const TONES = (dark: boolean): Record<RoleKey, { bg: string; fg: string }> => ({
  admin: dark ? { bg: 'rgba(129,140,248,0.18)', fg: '#c7d2fe' } : { bg: 'rgba(79,70,229,0.11)', fg: '#3730a3' },
  employee: dark ? { bg: 'rgba(255,255,255,0.08)', fg: '#e5e5e0' } : { bg: 'rgba(0,0,0,0.055)', fg: '#3b3b38' },
  viewer: dark ? { bg: 'rgba(34,211,238,0.14)', fg: '#a5f3fc' } : { bg: 'rgba(14,116,144,0.12)', fg: '#0b5870' },
});

export function RolePill({ isDark, role, label }: { isDark: boolean; role: RoleKey; label: string }) {
  const c = TONES(isDark)[role];
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: '0.8rem', fontWeight: 600 }}>
      {label}
    </span>
  );
}

/** "Device operations" on/off for employees and viewers. Callers hide it for admins. */
export function DeviceOpsSwitch({ isDark, checked, onChange }: { isDark: boolean; checked: boolean; onChange: (v: boolean) => void }) {
  const t = useTokens(isDark);
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 44, padding: '11px 13px', borderRadius: 12,
      border: `1.5px solid ${checked ? t.good : t.line}`, background: checked ? t.goodBg : t.card2, cursor: 'pointer',
    }}>
      <input
        type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: t.good, width: 20, height: 20, marginTop: 1, flexShrink: 0 }}
      />
      <span>
        <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600, color: t.ink }}>Device operations</span>
        <span style={{ display: 'block', fontSize: '0.84rem', color: t.ink2, marginTop: 2 }}>
          {checked ? 'Can restart devices and change their settings.' : 'Can watch devices but not change them.'}
        </span>
      </span>
    </label>
  );
}
