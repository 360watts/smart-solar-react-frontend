import React from 'react';
import { Search } from 'lucide-react';
import { useTokens, StatusChip, EmptyState, Btn, OverflowMenu, ItemAction } from '../siteHardware/ui';
import { useIsMobile } from '../../../shared/hooks/useIsMobile';
import { Avatar, RolePill } from './parts';
import { Person, RoleKey, roleOf, roleInfo, worksOn, statusOf, fullName } from './roles';

export type TabKey = 'all' | RoleKey;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'admin', label: 'Admins' },
  { key: 'employee', label: 'Employees' },
  { key: 'viewer', label: 'Viewers' },
];
const EMPTY_COPY: Record<RoleKey, { headline: string; detail: string }> = {
  admin: { headline: 'No admins yet', detail: 'Admins can manage the whole team and see billing.' },
  employee: { headline: 'No employees yet', detail: 'Employees monitor and fix systems and help customers.' },
  viewer: { headline: 'No viewers yet', detail: 'Add a partner or freelancer who should only see a few sites.' },
};

interface Props {
  isDark: boolean;
  people: Person[];
  siteNames: Record<string, string>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  tab: TabKey;
  onTab: (t: TabKey) => void;
  counts: Record<TabKey, number | undefined>;
  search: string;
  onSearch: (s: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  currentUserId?: number;
  onOpen: (p: Person) => void;
  onToggleActive: (p: Person) => void;
  onRemove: (p: Person) => void;
  onAdd: (role?: RoleKey) => void;
}

export function PeopleList(props: Props) {
  const {
    isDark, people, siteNames, loading, error, onRetry, tab, onTab, counts, search, onSearch,
    page, pageSize, total, onPage, currentUserId, onOpen, onToggleActive, onRemove, onAdd,
  } = props;
  const t = useTokens(isDark);
  const isMobile = useIsMobile();

  const actionsFor = (p: Person): ItemAction[] => {
    const active = statusOf(p).key !== 'inactive';
    const list: ItemAction[] = [{ label: 'Edit access', onClick: () => onOpen(p) }];
    if (p.id !== currentUserId) {
      list.push({
        label: active ? 'Turn off sign-in' : 'Turn on sign-in',
        hint: active ? "They stay on the team but can't sign in" : undefined,
        onClick: () => onToggleActive(p),
      });
      list.push({ label: 'Remove', danger: true, hint: 'Deletes the account for good', onClick: () => onRemove(p) });
    }
    return list;
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: t.body, color: t.ink }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div role="tablist" aria-label="Filter by role" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', padding: 4, borderRadius: 14, background: t.idleBg, gap: 2, maxWidth: '100%' }}>
          {TABS.map((tb) => {
            const on = tb.key === tab;
            const c = counts[tb.key];
            return (
              <button
                key={tb.key} type="button" role="tab" aria-selected={on} onClick={() => onTab(tb.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 16px', border: 0,
                  borderRadius: 10, background: on ? t.card : 'transparent', whiteSpace: 'nowrap',
                  boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', color: on ? t.ink : t.ink2,
                  fontFamily: t.body, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {tb.label}{c != null && <span style={{ fontSize: '0.78rem', color: t.ink2 }}> {c}</span>}
              </button>
            );
          })}
        </div>
        <label style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 13, top: 14, color: t.ink2 }} />
          <input
            type="search" aria-label="Search people" placeholder="Search by name or email" value={search}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 14px 0 38px', borderRadius: 12,
              border: `1px solid ${t.line}`, background: t.card, color: t.ink, fontFamily: t.body, fontSize: '0.9rem', outline: 'none',
            }}
          />
        </label>
      </div>

      {error ? (
        <EmptyState
          isDark={isDark}
          headline="Couldn't load your team"
          detail="Check your connection, then try again."
          action={<Btn isDark={isDark} variant="soft" onClick={onRetry}>Try again</Btn>}
        />
      ) : loading && people.length === 0 ? (
        <div aria-busy="true" aria-label="Loading people" style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: t.idleBg }} />
          ))}
        </div>
      ) : people.length === 0 ? (
        search.trim() ? (
          <EmptyState isDark={isDark} headline={`No one matches “${search.trim()}”`} detail="Try a different name or email." />
        ) : tab === 'all' ? (
          <EmptyState isDark={isDark} headline="No one on the team yet" detail="Add your first teammate to get started." action={<Btn isDark={isDark} onClick={() => onAdd()}>Add a teammate</Btn>} />
        ) : (
          <EmptyState
            isDark={isDark} headline={EMPTY_COPY[tab].headline} detail={EMPTY_COPY[tab].detail}
            action={<Btn isDark={isDark} variant="soft" onClick={() => onAdd(tab)}>{`Add ${tab === 'admin' ? 'an' : 'a'} ${tab}`}</Btn>}
          />
        )
      ) : (
        <div style={{ background: t.card, borderRadius: 18, border: `1px solid ${t.line}`, overflow: 'hidden' }}>
          {people.map((p, i) => {
            const role = roleOf(p);
            const w = worksOn(p, siteNames);
            const st = statusOf(p);
            const name = fullName(p);
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? 10 : 16,
                  padding: isMobile ? '14px 14px' : '14px 20px', borderTop: i === 0 ? 'none' : `1px solid ${t.line2}`,
                }}
              >
                <button
                  type="button" onClick={() => onOpen(p)} aria-label={name}
                  style={{
                    flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    background: 'none', border: 0, padding: 0, minHeight: 44, cursor: 'pointer', color: t.ink, fontFamily: t.body,
                  }}
                >
                  <Avatar person={p} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.96rem' }}>{name}</span>
                    <span style={{ display: 'block', fontSize: '0.82rem', color: t.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.email}{p.team ? ` · ${p.team.name}` : ''}
                    </span>
                  </span>
                </button>
                <div style={{ flex: '0 0 auto' }}><RolePill isDark={isDark} role={role} label={roleInfo(role).label} /></div>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{w.headline}</div>
                  <div style={{ fontSize: '0.8rem', color: t.ink2 }}>{w.note}</div>
                </div>
                <StatusChip isDark={isDark} state={st.key === 'active' ? 'good' : st.key === 'on_leave' ? 'wait' : 'idle'}>{st.label}</StatusChip>
                <OverflowMenu isDark={isDark} actions={actionsFor(p)} label={`More actions for ${name}`} />
              </div>
            );
          })}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 20px', borderTop: `1px solid ${t.line2}`, fontSize: '0.82rem', color: t.ink2 }}>
            <span>{`Showing ${from}–${to} of ${total} people`}</span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Btn isDark={isDark} variant="plain" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
              <Btn isDark={isDark} variant="plain" size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Next</Btn>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
