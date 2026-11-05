import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTokens, Btn, OverflowMenu, ItemAction } from '../siteHardware/ui';
import { useIsMobile } from '../../../shared/hooks/useIsMobile';
import { Avatar, RolePill, SignInDot } from './formParts';
import { Sort, SortKey } from './FilterBar';
import { Person, employmentTag, fullName, relativeTime, roleInfo, roleOf, statusOf } from './roles';

/* Read-only people table (spec "Table"): click a row for the popup; the ⋯ menu holds sign-in and Remove. */

/** "Everything" / "All sites" / site IDs / "N devices", for the Can reach column. */
export function reachOf(p: Person): { text: string; chips?: string[] } {
  const role = roleOf(p);
  if (role === 'admin') return { text: 'Everything' };
  if (role === 'employee') return { text: 'All sites' };
  const sites = p.assigned_sites ?? [];
  const nDev = p.assigned_devices?.length ?? 0;
  const dev = nDev ? `${nDev} device${nDev === 1 ? '' : 's'}` : '';
  if (!sites.length) return { text: dev || 'Nothing yet' };
  return { text: '', chips: [...sites.slice(0, 2), ...(sites.length > 2 ? [`+${sites.length - 2}`] : []), ...(dev ? [dev] : [])] };
}
const deviceOpsText = (p: Person) => (roleOf(p) === 'admin' ? 'Always' : p.device_ops_enabled === false ? 'No' : 'Yes');
const joinedText = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const COLUMNS: { key: string; label: string; sort?: SortKey }[] = [
  { key: 'name', label: 'Name', sort: 'name' }, { key: 'role', label: 'Role', sort: 'role' }, { key: 'reach', label: 'Can reach' },
  { key: 'ops', label: 'Device controls' }, { key: 'team', label: 'Team', sort: 'team' }, { key: 'sign', label: 'Sign-in', sort: 'sign_in' },
  { key: 'last', label: 'Last sign-in', sort: 'last_active' }, { key: 'joined', label: 'Joined', sort: 'joined' },
];
/** Dates start newest first on the first click; text columns start A to Z. */
const FIRST_DESC: SortKey[] = ['last_active', 'joined'];

export function PeopleTable({ isDark, people, sort, onSort, page, pageSize, total, onPage, currentUserId, onOpen, onToggleActive, onRemove }: {
  isDark: boolean; people: Person[]; sort: Sort; onSort: (s: Sort) => void;
  page: number; pageSize: number; total: number; onPage: (p: number) => void;
  currentUserId?: number; onOpen: (p: Person) => void; onToggleActive: (p: Person) => void; onRemove: (p: Person) => void;
}) {
  const t = useTokens(isDark);
  const isMobile = useIsMobile();
  const actionsFor = (p: Person): ItemAction[] => {
    const on = p.is_active !== false;
    return [
      { label: 'Open', onClick: () => onOpen(p) },
      { label: on ? 'Turn off sign-in' : 'Turn on sign-in', hint: on ? "They stay on the team but can't sign in" : undefined, onClick: () => onToggleActive(p) },
      { label: 'Remove', danger: true, hint: 'Deletes the account for good', onClick: () => onRemove(p) },
    ];
  };
  const menu = (p: Person) => (p.id === currentUserId ? null : (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <OverflowMenu isDark={isDark} actions={actionsFor(p)} label={`More actions for ${fullName(p)}`} />
    </span>
  ));
  const signIn = (p: Person) => {
    const tag = employmentTag(p);
    const on = statusOf(p).key !== 'inactive';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <SignInDot on={on} />{on ? 'On' : 'Off'}
        {tag && <span style={{ fontSize: '0.76rem', padding: '1px 7px', borderRadius: 6, background: t.idleBg, color: t.ink2 }}>{tag}</span>}
      </span>
    );
  };
  const reach = (p: Person) => {
    const r = reachOf(p);
    return r.chips
      ? <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>{r.chips.map((c) => <span key={c} style={{ fontSize: '0.78rem', padding: '1px 7px', borderRadius: 6, background: t.idleBg, fontFamily: c.includes('device') || c.startsWith('+') ? t.body : 'var(--font-mono)' }}>{c}</span>)}</span>
      : <span style={{ color: r.text === 'Nothing yet' ? t.waitInk : undefined }}>{r.text}</span>;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const open = (p: Person) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p); } };

  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 18px', borderTop: `1px solid ${t.line2}`, fontSize: '0.82rem', color: t.ink2 }}>
      <span>{`Showing ${from} to ${to} of ${total} ${total === 1 ? 'person' : 'people'}`}</span>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <Btn isDark={isDark} variant="plain" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
        <Btn isDark={isDark} variant="plain" size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Next</Btn>
      </span>
    </div>
  );
  const shell: React.CSSProperties = { background: t.card, borderRadius: 18, border: `1px solid ${t.line}`, overflow: 'hidden' };

  if (isMobile) {
    return (
      <div style={shell}>
        {people.map((p, i) => (
          <div key={p.id} role="button" tabIndex={0} aria-label={fullName(p)} onClick={() => onOpen(p)} onKeyDown={open(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${t.line2}` : 0, cursor: 'pointer' }}>
            <Avatar person={p} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{fullName(p)}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: t.ink2 }}>
                <RolePill label={roleInfo(roleOf(p)).label} />{reach(p)}{signIn(p)}
              </span>
            </div>
            {menu(p)}
          </div>
        ))}
        {footer}
      </div>
    );
  }

  const th: React.CSSProperties = { textAlign: 'left', fontWeight: 500, fontSize: '0.8rem', color: t.ink2, padding: '10px 14px', borderBottom: `1px solid ${t.line}`, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 14px', borderTop: `1px solid ${t.line2}`, fontSize: '0.88rem', verticalAlign: 'middle' };
  return (
    <div style={shell}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const on = c.sort === sort.key;
                const Icon = on ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
                return (
                  <th key={c.key} scope="col" style={th} aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                    {c.sort ? (
                      <button type="button" onClick={() => onSort(on ? { key: c.sort!, desc: !sort.desc } : { key: c.sort!, desc: FIRST_DESC.includes(c.sort!) })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, background: 'none', padding: 0, font: 'inherit', color: on ? t.ink : t.ink2, cursor: 'pointer' }}>
                        {c.label}<Icon size={13} aria-hidden="true" style={{ opacity: on ? 1 : 0.5 }} />
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
              <th style={{ ...th, width: 48 }}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} tabIndex={0} aria-label={fullName(p)} onClick={() => onOpen(p)} onKeyDown={open(p)} className="emp-row" style={{ cursor: 'pointer' }}>
                <td style={td}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar person={p} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500 }}>{fullName(p)}{p.id === currentUserId && <span style={{ color: t.ink2, fontWeight: 400 }}> (you)</span>}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span>
                    </span>
                  </span>
                </td>
                <td style={td}><RolePill label={roleInfo(roleOf(p)).label} /></td>
                <td style={td}>{reach(p)}</td>
                <td style={{ ...td, color: deviceOpsText(p) === 'No' ? t.ink2 : undefined }}>{deviceOpsText(p)}</td>
                <td style={td}>{p.team ? <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: 6, background: t.idleBg }}>{p.team.name}</span> : <span style={{ color: t.ink2 }}>—</span>}</td>
                <td style={td}>{signIn(p)}</td>
                <td style={{ ...td, color: t.ink2, fontSize: p.last_login ? '0.82rem' : '0.78rem', fontFamily: p.last_login ? 'var(--font-mono)' : undefined, whiteSpace: 'nowrap' }}>{relativeTime(p.last_login)}</td>
                <td style={{ ...td, color: t.ink2, fontSize: '0.82rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{joinedText(p.date_joined)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{menu(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
