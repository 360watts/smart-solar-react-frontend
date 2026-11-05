import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTokens } from '../siteHardware/ui';
import type { EmployeeFilters } from '../../../services/api';
import { EMPLOYMENT_LABEL, Employment, RoleKey, SiteOption, Team } from './roles';
import { inputStyle } from './formParts';

/* Views, search, filter chips and the sort line above the people table (spec "Toolbar"). */

export type View = 'all' | RoleKey | 'inactive';
export type SortKey = 'name' | 'role' | 'team' | 'sign_in' | 'last_active' | 'joined';
export interface Sort { key: SortKey; desc: boolean }
export interface Filters { team: number[]; site: string | null; deviceOps: boolean | null; signIn: boolean | null; employment: Employment[] }

export const NO_FILTERS: Filters = { team: [], site: null, deviceOps: null, signIn: null, employment: [] };
export const DEFAULT_SORT: Sort = { key: 'name', desc: false };
export const SORT_LABEL: Record<SortKey, [string, string]> = {
  name: ['Name A to Z', 'Name Z to A'], role: ['Role, admins first', 'Role, viewers first'], team: ['Team A to Z', 'Team Z to A'],
  sign_in: ["Sign-in, can't sign in first", 'Sign-in, can sign in first'], last_active: ['Last sign-in, oldest first', 'Last sign-in, newest first'],
  joined: ['Joined, oldest first', 'Joined, newest first'],
};
const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: 'Everyone' }, { key: 'admin', label: 'Admins' }, { key: 'employee', label: 'Employees' },
  { key: 'viewer', label: 'Viewers' }, { key: 'inactive', label: "Can't sign in" },
];

/** View + chips + sort -> getEmployees' role and `extra` arguments. */
export function toQuery(view: View, f: Filters, sort: Sort): { role?: string; extra: EmployeeFilters } {
  return {
    role: view === 'all' || view === 'inactive' ? undefined : view,
    extra: {
      ordering: `${sort.desc ? '-' : ''}${sort.key}`,
      team: f.team.length ? f.team : undefined,
      site: f.site ?? undefined,
      deviceOps: f.deviceOps ?? undefined,
      isActive: view === 'inactive' ? false : f.signIn ?? undefined,
      employment: f.employment.length ? f.employment : undefined,
    },
  };
}

export const activeFilterCount = (f: Filters) =>
  (f.team.length ? 1 : 0) + (f.site ? 1 : 0) + (f.deviceOps != null ? 1 : 0) + (f.signIn != null ? 1 : 0) + (f.employment.length ? 1 : 0);

/** "Team: Field, Support +1" — at most two values, then +N. */
export function chipText(name: string, values: string[]): string {
  return `${name}: ${values.slice(0, 2).join(', ')}${values.length > 2 ? ` +${values.length - 2}` : ''}`;
}

type Option = { value: string; label: string };

function ChipMenu({ isDark, name, values, options, multi, searchable, onChange }: {
  isDark: boolean; name: string; values: string[]; options: Option[]; multi: boolean; searchable?: boolean; onChange: (v: string[]) => void;
}) {
  const t = useTokens(isDark);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const set = values.length > 0;
  const labels = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const shown = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const pick = (v: string) => {
    if (multi) onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    else { onChange(values[0] === v ? [] : [v]); setOpen(false); }
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', borderRadius: 10, whiteSpace: 'nowrap', fontSize: '0.82rem',
        border: set ? `1px solid ${t.good}` : `1px dashed ${t.line}`, background: set ? t.goodBg : 'transparent', color: set ? t.goodInk : t.ink2,
      }}>
        <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          style={{ border: 0, background: 'none', color: 'inherit', font: 'inherit', padding: '6px 4px 6px 11px', paddingRight: set ? 4 : 11, minHeight: 32, cursor: 'pointer' }}>
          {set ? chipText(name, labels) : `+ ${name}`}
        </button>
        {set && (
          <button type="button" aria-label={`Clear ${name} filter`} onClick={() => onChange([])}
            style={{ border: 0, background: 'none', color: 'inherit', padding: '0 8px 0 2px', minHeight: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={13} /></button>
        )}
      </span>
      {open && (
        <div role="dialog" aria-label={`${name} filter`} style={{
          position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, width: 240, padding: 6,
          background: 'var(--popover)', border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: 'var(--shadow-tooltip)',
        }}>
          {searchable && <input type="search" aria-label={`Find a ${name.toLowerCase()}`} placeholder={`Find a ${name.toLowerCase()}`} value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus style={{ ...inputStyle(isDark), minHeight: 34, marginBottom: 4 }} />}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {shown.length === 0 && <p style={{ margin: 0, padding: '8px 10px', fontSize: '0.82rem', color: t.ink2 }}>Nothing matches.</p>}
            {shown.map((o) => (
              <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, fontSize: '0.86rem', color: t.ink, cursor: 'pointer' }}>
                <input type={multi ? 'checkbox' : 'radio'} name={`f-${name}`} checked={values.includes(o.value)} onChange={() => pick(o.value)}
                  style={{ accentColor: t.good, margin: 0 }} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({ isDark, view, onView, counts, search, onSearch, filters, onFilters, sort, onSort, teams, sites }: {
  isDark: boolean; view: View; onView: (v: View) => void; counts: Partial<Record<View, number>>;
  search: string; onSearch: (s: string) => void; filters: Filters; onFilters: (f: Filters) => void;
  sort: Sort; onSort: (s: Sort) => void; teams: Team[]; sites: SiteOption[];
}) {
  const t = useTokens(isDark);
  const bool = (v: boolean | null) => (v == null ? [] : [String(v)]);
  const unbool = (v: string[]) => (v.length ? v[0] === 'true' : null);
  const isDefaultSort = sort.key === DEFAULT_SORT.key && sort.desc === DEFAULT_SORT.desc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div role="tablist" aria-label="Views" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 12, background: t.idleBg, overflowX: 'auto', maxWidth: '100%' }}>
          {VIEWS.map((v) => {
            const on = v.key === view;
            const n = counts[v.key];
            return (
              <button key={v.key} type="button" role="tab" aria-selected={on} onClick={() => onView(v.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 13px', border: 0, borderRadius: 9, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: t.body, fontSize: '0.85rem', fontWeight: on ? 600 : 500, background: on ? t.card : 'transparent', color: on ? t.ink : t.ink2, boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>
                {v.label}{n != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: t.ink2 }}>{n}</span>}
              </button>
            );
          })}
        </div>
        <label style={{ position: 'relative', flex: '0 1 320px', minWidth: 200 }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: t.ink2 }} />
          <input type="search" aria-label="Search people" placeholder="Search name, email, phone or site" value={search}
            onChange={(e) => onSearch(e.target.value)} style={{ ...inputStyle(isDark), paddingLeft: 34 }} />
        </label>
      </div>

      <div className="emp-chips" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ChipMenu isDark={isDark} name="Team" multi values={filters.team.map(String)}
          options={teams.map((tm) => ({ value: String(tm.id), label: tm.name }))} onChange={(v) => onFilters({ ...filters, team: v.map(Number) })} />
        <ChipMenu isDark={isDark} name="Site" multi={false} searchable values={filters.site ? [filters.site] : []}
          options={sites.map((s) => ({ value: s.site_id, label: s.display_name === s.site_id ? s.site_id : `${s.site_id} · ${s.display_name}` }))}
          onChange={(v) => onFilters({ ...filters, site: v[0] ?? null })} />
        <ChipMenu isDark={isDark} name="Device controls" multi={false} values={bool(filters.deviceOps)}
          options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(v) => onFilters({ ...filters, deviceOps: unbool(v) })} />
        {view !== 'inactive' && (
          <ChipMenu isDark={isDark} name="Sign-in" multi={false} values={bool(filters.signIn)}
            options={[{ value: 'true', label: 'Can sign in' }, { value: 'false', label: "Can't sign in" }]} onChange={(v) => onFilters({ ...filters, signIn: unbool(v) })} />
        )}
        <ChipMenu isDark={isDark} name="Employment" multi values={filters.employment}
          options={(Object.keys(EMPLOYMENT_LABEL) as Employment[]).map((k) => ({ value: k, label: EMPLOYMENT_LABEL[k] }))}
          onChange={(v) => onFilters({ ...filters, employment: v as Employment[] })} />
        {activeFilterCount(filters) > 0 && (
          <button type="button" onClick={() => onFilters(NO_FILTERS)}
            style={{ border: 0, background: 'none', padding: '0 4px', minHeight: 32, color: t.goodInk, fontFamily: t.body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Clear all</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: t.ink2, whiteSpace: 'nowrap' }}>
          Sorted by {SORT_LABEL[sort.key][sort.desc ? 1 : 0].replace(/^./, (c) => c.toLowerCase())}
          {!isDefaultSort && <> · <button type="button" onClick={() => onSort(DEFAULT_SORT)}
            style={{ border: 0, background: 'none', padding: 0, color: t.goodInk, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Reset to Name A to Z</button></>}
        </span>
      </div>
    </div>
  );
}
