import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useTokens, controlStyle } from '../siteHardware/ui';
import { SiteOption } from './roles';

export function SitePicker({ isDark, sites, value, onChange }: {
  isDark: boolean; sites: SiteOption[]; value: string[]; onChange: (next: string[]) => void;
}) {
  const t = useTokens(isDark);
  const control = controlStyle(isDark);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sites.filter((s) => s.display_name.toLowerCase().includes(q) || s.site_id.toLowerCase().includes(q)) : sites;
  }, [sites, query]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: '0.85rem', color: t.ink2 }}>{`${value.length} of ${sites.length} chosen`}</span>
        <label style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 14, color: t.ink2 }} />
          <input
            type="search" aria-label="Find a site" placeholder="Find a site" value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...control, paddingLeft: 34, minHeight: 44, boxSizing: 'border-box' }}
          />
        </label>
      </div>
      {sites.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>No sites yet.</p>
      ) : shown.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>No sites match that search.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
          {shown.map((s) => {
            const on = value.includes(s.site_id);
            return (
              <button
                key={s.site_id} type="button" aria-pressed={on} onClick={() => toggle(s.site_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 14,
                  border: `2px solid ${on ? t.good : t.line}`, background: on ? t.goodBg : t.card2,
                  color: t.ink, fontFamily: t.body, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 6, boxSizing: 'border-box', flexShrink: 0, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${on ? t.good : t.line}`, background: on ? t.good : 'transparent',
                }}>
                  {on && <Check size={11} color="#fff" strokeWidth={3.5} />}
                </span>
                {s.display_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
