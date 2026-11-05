import React, { useId, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, Search, X } from 'lucide-react';
import { useTokens, controlStyle } from '../siteHardware/ui';
import { useDialogBehavior } from './useDialogBehavior';
import { Person, RoleKey, ROLES, SiteOption, Team, initialsOf, mobileError } from './roles';

/* Shared pieces for the Employees page forms (spec 2026-11-05-employees-page-redesign-design.md, "Forms"):
   label above the field, a reserved hint/error line so fields in a row stay aligned, one accent colour. */

/** Quiet initials avatar: one neutral tone for everyone (the old pastel palette read as cartoonish). */
export function Avatar({ person, size = 32 }: { person: Pick<Person, 'first_name' | 'last_name' | 'email'>; size?: number }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
      fontFamily: "'Rubik', sans-serif", fontWeight: 600, fontSize: Math.max(12, Math.round(size * 0.36)),
    }}>
      {initialsOf(person)}
    </span>
  );
}

/** Role as quiet text with a small dot; no colour per role. */
export function RolePill({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 999, border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function SignInDot({ on }: { on: boolean }) {
  return <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, display: 'inline-block', background: on ? 'var(--primary)' : 'var(--text-dim)' }} />;
}

/** Label above, control, then one line that always takes its height (hint or error). */
export function FormField({ isDark, label, hint, error, children, htmlFor }: {
  isDark: boolean; label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; htmlFor?: string;
}) {
  const t = useTokens(isDark);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={htmlFor} style={{ fontSize: '0.82rem', fontWeight: 500, color: t.ink }}>{label}</label>
      {children}
      <span role={error ? 'alert' : undefined} style={{ minHeight: 16, fontSize: '0.75rem', lineHeight: '16px', color: error ? t.waitInk : t.ink2 }}>
        {error ?? hint ?? ''}
      </span>
    </div>
  );
}

export function inputStyle(isDark: boolean, bad = false): React.CSSProperties {
  const base = controlStyle(isDark);
  return { ...base, minHeight: 40, boxSizing: 'border-box', background: 'var(--card)', ...(bad ? { borderColor: 'var(--warning)' } : {}) };
}

export function TextField({ isDark, label, value, onChange, type = 'text', hint, error, autoFocus }: {
  isDark: boolean; label: string; value: string; onChange: (v: string) => void; type?: string; hint?: React.ReactNode; error?: string | null; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <FormField isDark={isDark} label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} type={type} value={value} autoComplete="off" autoFocus={autoFocus} aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)} style={inputStyle(isDark, !!error)} />
    </FormField>
  );
}

/** Indian mobile: fixed +91, digits only, checked for 10 digits once you leave the field. `value` is the 10 digits. */
export function MobileField({ isDark, value, onChange, hint }: { isDark: boolean; value: string; onChange: (digits: string) => void; hint?: string }) {
  const t = useTokens(isDark);
  const id = useId();
  const [touched, setTouched] = useState(false);
  const err = touched ? mobileError(value) : null;
  return (
    <FormField isDark={isDark} label="Mobile" hint={hint} error={err} htmlFor={id}>
      <span style={{ ...inputStyle(isDark, !!err), display: 'flex', alignItems: 'center', gap: 8, padding: 0, paddingLeft: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: t.ink2, paddingRight: 8, borderRight: `1px solid ${t.line}` }}>+91</span>
        <input id={id} type="tel" inputMode="numeric" value={value} aria-invalid={!!err} autoComplete="off"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} onBlur={() => setTouched(true)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: t.ink, fontFamily: t.body, fontSize: '0.9rem', padding: '10px 12px 10px 0' }} />
      </span>
    </FormField>
  );
}

/** Type to find a team; the list floats over the form and ends with "Create team". */
export function TeamCombo({ isDark, teams, value, onChange, onCreate }: {
  isDark: boolean; teams: Team[]; value?: number; onChange: (id: number | undefined) => void; onCreate?: (name: string) => Promise<Team | null>;
}) {
  const t = useTokens(isDark);
  const id = useId();
  const listId = `${id}-list`;
  const current = teams.find((tm) => tm.id === value);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const open = query !== null;
  const q = (query ?? '').trim();
  const shown = teams.filter((tm) => tm.name.toLowerCase().includes(q.toLowerCase()));
  const canCreate = !!onCreate && q !== '' && !teams.some((tm) => tm.name.toLowerCase() === q.toLowerCase());
  const options: { key: string; label: string; pick: () => void }[] = [
    { key: 'none', label: 'No team', pick: () => onChange(undefined) },
    ...shown.map((tm) => ({ key: String(tm.id), label: tm.name, pick: () => onChange(tm.id) })),
    ...(canCreate ? [{
      key: 'create', label: `Create team “${q}”`, pick: async () => {
        setBusy(true);
        const made = await onCreate!(q).finally(() => setBusy(false));
        if (made) onChange(made.id);
      },
    }] : []),
  ];
  const choose = (i: number) => { options[i]?.pick(); setQuery(null); };

  return (
    <FormField isDark={isDark} label="Team" hint="Optional" htmlFor={id}>
      <div style={{ position: 'relative' }}>
        <input
          id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
          aria-activedescendant={open ? `${listId}-${active}` : undefined} disabled={busy}
          value={open ? query! : current?.name ?? ''} placeholder="No team"
          onFocus={() => { setQuery(''); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onBlur={() => setTimeout(() => setQuery(null), 120)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
            else if (e.key === 'Escape') { e.stopPropagation(); setQuery(null); }
          }}
          style={inputStyle(isDark)}
        />
        {open && (
          <ul id={listId} role="listbox" style={{
            position: 'absolute', zIndex: 5, top: 'calc(100% + 4px)', left: 0, right: 0, margin: 0, padding: 6, listStyle: 'none',
            maxHeight: 220, overflowY: 'auto', background: 'var(--popover)', border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: 'var(--shadow-tooltip)',
          }}>
            {options.map((o, i) => (
              <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}
                style={{ padding: '7px 10px', borderRadius: 8, fontSize: '0.88rem', cursor: 'pointer', background: i === active ? t.idleBg : 'transparent', color: o.key === 'create' ? t.goodInk : t.ink }}>
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormField>
  );
}

/** Compact role list: one row per role (name + one-line blurb). Arrow keys move the choice. */
export function RoleList({ isDark, value, onChange, disabled = false }: { isDark: boolean; value: RoleKey; onChange: (r: RoleKey) => void; disabled?: boolean }) {
  const t = useTokens(isDark);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (from: number, d: number) => {
    const next = (from + d + ROLES.length) % ROLES.length;
    onChange(ROLES[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Role" style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${t.line}`, borderRadius: 14, overflow: 'hidden' }}>
      {ROLES.map((r, i) => {
        const on = r.key === value;
        return (
          <button key={r.key} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled}
            onClick={() => onChange(r.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
              else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
            }}
            style={{
              display: 'grid', gridTemplateColumns: '16px 84px minmax(0, 1fr)', columnGap: 12, alignItems: 'center', textAlign: 'left',
              padding: '11px 14px', border: 0, borderTop: i ? `1px solid ${t.line2}` : 0, background: on ? t.goodBg : 'transparent',
              color: t.ink, fontFamily: t.body, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !on ? 0.55 : 1,
            }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 999, boxSizing: 'border-box', border: on ? `5px solid ${t.good}` : `2px solid ${t.line}` }} />
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.label}</span>
            <span style={{ fontSize: '0.8rem', color: t.ink2 }}>{r.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Small pick-one control (Admin / Employee / Viewer, Working / On leave / Left). */
export function Segmented<T extends string>({ isDark, label, value, options, onChange, disabled = false }: {
  isDark: boolean; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  const t = useTokens(isDark);
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', padding: 3, gap: 2, borderRadius: 10, background: t.idleBg, maxWidth: '100%' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.value)}
            style={{
              flex: 1, minHeight: 34, padding: '0 12px', border: 0, borderRadius: 8, whiteSpace: 'nowrap', fontFamily: t.body, fontSize: '0.85rem', fontWeight: on ? 600 : 500,
              background: on ? t.card : 'transparent', color: on ? t.ink : t.ink2, boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !on ? 0.55 : 1,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** One bordered row with a switch and its plain-words label. */
export function SwitchRow({ isDark, checked, onChange, label }: { isDark: boolean; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTokens(isDark);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.line}`, cursor: 'pointer', fontSize: '0.88rem', color: t.ink }}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: t.good, width: 18, height: 18, margin: 0, flexShrink: 0 }} />
      {label}
    </label>
  );
}

/** Sites or single devices for a viewer: two tabs, picked items as chips on top, search, checkboxes. Device options carry the id as `site_id`. */
export function ReachPicker({ isDark, sites, devices, siteValue, deviceValue, onSites, onDevices }: {
  isDark: boolean; sites: SiteOption[]; devices: SiteOption[]; siteValue: string[]; deviceValue: string[];
  onSites: (v: string[]) => void; onDevices: (v: string[]) => void;
}) {
  const t = useTokens(isDark);
  const [tab, setTab] = useState<'sites' | 'devices'>('sites');
  const [query, setQuery] = useState('');
  const list = tab === 'sites' ? sites : devices;
  const value = tab === 'sites' ? siteValue : deviceValue;
  const set = tab === 'sites' ? onSites : onDevices;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((s) => s.display_name.toLowerCase().includes(q) || s.site_id.toLowerCase().includes(q)) : list;
  }, [list, query]);
  const nameOf = (opts: SiteOption[], id: string) => opts.find((o) => o.site_id === id)?.display_name ?? id;
  const chips = [
    ...siteValue.map((id) => ({ key: `s${id}`, label: id, remove: () => onSites(siteValue.filter((v) => v !== id)) })),
    ...deviceValue.map((id) => ({ key: `d${id}`, label: `${nameOf(devices, id)} (device)`, remove: () => onDevices(deviceValue.filter((v) => v !== id)) })),
  ];
  const toggle = (id: string) => set(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const noun = tab === 'sites' ? 'site' : 'device';

  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: 14, overflow: 'hidden' }}>
      <div role="tablist" aria-label="Reach by" style={{ display: 'flex', gap: 2, padding: 6, background: t.idleBg }}>
        {(['sites', 'devices'] as const).map((k) => {
          const on = k === tab;
          const n = k === 'sites' ? siteValue.length : deviceValue.length;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setTab(k); setQuery(''); }}
              style={{ flex: 1, minHeight: 32, border: 0, borderRadius: 8, fontFamily: t.body, fontSize: '0.84rem', fontWeight: on ? 600 : 500, background: on ? t.card : 'transparent', color: on ? t.ink : t.ink2, boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none', cursor: 'pointer' }}>
              {k === 'sites' ? 'Sites' : 'Single devices'} {n > 0 && <span style={{ color: t.ink2 }}>{n}</span>}
            </button>
          );
        })}
      </div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', borderBottom: `1px solid ${t.line2}` }}>
          {chips.map((c) => (
            <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 9px', borderRadius: 8, background: t.goodBg, color: t.goodInk, fontSize: '0.8rem' }}>
              {c.label}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove}
                style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, border: 0, borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ padding: '10px 12px 6px', position: 'relative' }}>
        <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 24, top: 22, color: t.ink2 }} />
        <input type="search" aria-label={`Find a ${noun}`} placeholder={tab === 'sites' ? 'Find a site by name or ID' : 'Find a device by serial or site'}
          value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputStyle(isDark), paddingLeft: 34 }} />
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {list.length === 0 ? <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.85rem', color: t.ink2 }}>{`No ${noun}s yet.`}</p>
          : shown.length === 0 ? <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.85rem', color: t.ink2 }}>{`No ${noun}s match that search.`}</p>
          : shown.map((s) => {
            const on = value.includes(s.site_id);
            return (
              <label key={s.site_id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 12px', borderTop: `1px solid ${t.line2}`, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(s.site_id)} style={{ accentColor: t.good, width: 16, height: 16, margin: 0 }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab === 'sites' ? <>{s.site_id}{s.display_name !== s.site_id && <span style={{ color: t.ink2 }}> · {s.display_name}</span>}</> : s.display_name}
                </span>
                {on && <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto', color: t.good }} />}
              </label>
            );
          })}
      </div>
    </div>
  );
}

/** Centred popup (full screen on phones): focus trap, Esc, focus back on close, backdrop click closes. */
export function Modal({ isDark, label, width = 600, onClose, header, children, footer }: {
  isDark: boolean; label: string; width?: number; onClose: () => void; header: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const t = useTokens(isDark);
  const ref = useDialogBehavior(onClose);
  return ReactDOM.createPortal(
    <div className="emp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto', background: isDark ? 'rgba(6,8,11,0.66)' : 'rgba(17,24,39,0.45)', animation: 'fs-fade 160ms ease-out' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="emp-modal"
        style={{ width: `min(${width}px, 100%)`, background: t.card, color: t.ink, fontFamily: t.body, borderRadius: 22, border: `1px solid ${t.line}`, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', animation: 'fs-dialog 180ms ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderBottom: `1px solid ${t.line2}` }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 }}>{header}</div>
          <button type="button" aria-label="Close" onClick={onClose}
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={17} />
          </button>
        </div>
        {children}
        {footer && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: `1px solid ${t.line2}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Section inside a form: bold title, optional link at the right, then the fields. Sections after the first get a thin line above. */
export function FormSection({ isDark, title, aside, children }: { isDark: boolean; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const t = useTokens(isDark);
  return (
    <section className="emp-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ margin: 0, fontFamily: t.head, fontSize: '0.95rem', fontWeight: 600 }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Two fields side by side; one column on phones (the .emp-row2 rule in EmployeesPage). */
export const Row2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="emp-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>{children}</div>
);

export const LinkButton: React.FC<{ isDark: boolean; onClick: () => void; children: React.ReactNode }> = ({ isDark, onClick, children }) => {
  const t = useTokens(isDark);
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 0, padding: 0, minHeight: 32, color: t.goodInk, fontFamily: t.body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </button>
  );
};
