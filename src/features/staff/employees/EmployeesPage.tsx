import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTokens, ConfirmDialog, Btn } from '../siteHardware/ui';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { EmptyState } from '../../../shared/components/Feedback';
import { apiService } from '../../../services/api';
import { DEFAULT_SORT, FilterBar, Filters, NO_FILTERS, Sort, View, activeFilterCount, toQuery } from './FilterBar';
import { PeopleTable } from './PeopleTable';
import { PersonDialog } from './PersonDialog';
import { InviteDialog } from './InviteDialog';
import { CompareRoles } from './CompareRoles';
import { Person, SiteOption, Team, buildPayload, formFromPerson, friendlyError, firstNameOf } from './roles';

/* The Employees page (route /employees): one table of everyone who can sign in to the staff
   dashboard. Spec: smart-solar-django-backend/docs/superpowers/specs/2026-11-05-employees-page-redesign-design.md.
   Scenarios: docs/test-scenarios/employees-page.md. */

const PAGE_SIZE = 25;
const PAGE_CSS = `
@keyframes fs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fs-dialog { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: none; } }
.emp-row:hover td { background: var(--surface-muted); }
.emp-row:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
.emp-section + .emp-section { padding-top: 20px; border-top: 1px solid var(--border); }
@media (max-width: 640px) {
  .emp-row2 { grid-template-columns: minmax(0, 1fr) !important; }
  .emp-overlay { padding: 0 !important; }
  .emp-modal { width: 100% !important; min-height: 100%; border-radius: 0 !important; }
}
@media (prefers-reduced-motion: reduce) { .emp-overlay, .emp-modal { animation: none !important; } }
`;
const EMPTY_VIEW: Record<Exclude<View, 'all'>, { title: string; description: string }> = {
  admin: { title: 'No admins yet', description: 'Admins can manage the whole team and see billing.' },
  employee: { title: 'No employees yet', description: 'Employees monitor and fix systems and help customers.' },
  viewer: { title: 'No viewers yet', description: 'Add a partner or freelancer who should only see a few sites.' },
  inactive: { title: 'Everyone can sign in', description: 'People whose sign-in you turn off show up here.' },
};

const EmployeesPage: React.FC = () => {
  const { isDark } = useTheme();
  const { user: me } = useAuth();
  const { addToast } = useToast();
  const t = useTokens(isDark);

  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<View, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [devices, setDevices] = useState<SiteOption[]>([]);  // site_id holds the device id
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const toast = (type: 'success' | 'error', title: string) => addToast({ type, title });

  useEffect(() => {
    // Only reset to page 1 when the search text actually changed (a Next click within 300 ms of loading must stick).
    const id = setTimeout(() => {
      const next = search.trim();
      if (next !== debounced) { setDebounced(next); setPage(1); }
    }, 300);
    return () => clearTimeout(id);
  }, [search, debounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { role, extra } = toQuery(view, filters, sort);
    apiService.getEmployees(debounced || undefined, page, PAGE_SIZE, role, extra)
      .then((res) => { if (!cancelled) { setPeople(res.results ?? []); setTotal(res.count ?? 0); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view, filters, sort, debounced, page, version]);

  useEffect(() => {
    apiService.getEmployeeRoleCounts()
      .then((c) => setCounts({ all: c.all, admin: c.admin, employee: c.employee, viewer: c.viewer, inactive: c.inactive }))
      .catch(() => undefined);
  }, [version]);

  useEffect(() => {
    apiService.getSitesList({ includeInactive: true })
      .then((rows) => setSites((rows ?? []).map((s: any) => ({ site_id: s.site_id, display_name: s.display_name || s.site_id }))))
      .catch(() => undefined);
    // The devices endpoint caps a page at 100; walk the pages (a fleet is a few hundred).
    (async () => {
      const out: SiteOption[] = [];
      for (let p = 1; p <= 20; p++) {
        const res = await apiService.getDevices(undefined, p, 100);
        for (const d of res.results ?? []) out.push({ site_id: String(d.id), display_name: d.site_id ? `${d.device_serial} (${d.site_id})` : d.device_serial });
        if (!res.has_next) break;
      }
      setDevices(out);
    })().catch(() => undefined);
    apiService.getTeams()
      .then((res) => setTeams((res.results ?? []).filter((x: any) => x.is_active !== false).map((x: any) => ({ id: x.id, name: x.name }))))
      .catch(() => undefined);
  }, []);

  // If the list shrank (the last person on the last page was removed), step back to the last page.
  useEffect(() => {
    const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (!loading && page > 1 && page > last) setPage(last);
  }, [total, page, loading]);

  const createTeam = useCallback(async (name: string): Promise<Team | null> => {
    try {
      const created = await apiService.createTeam({ name });
      const team: Team = { id: created.id, name: created.name };
      setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
      return team;
    } catch (err) {
      toast('error', friendlyError(err));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (p: Person) => {
    const nowOn = p.is_active !== false;
    try {
      await apiService.updateEmployee(p.id, buildPayload(formFromPerson(p), { address: p.address, is_active: !nowOn }));
      toast('success', nowOn ? `${firstNameOf(p)} can no longer sign in.` : `${firstNameOf(p)} can sign in again.`);
      setOpen(null);
      reload();
    } catch (err) {
      toast('error', friendlyError(err));
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await apiService.deleteEmployee(removing.id);
      toast('success', `Removed ${firstNameOf(removing)}.`);
      setRemoving(null);
      setOpen(null);
      reload();
    } catch (err) {
      toast('error', friendlyError(err));
    } finally {
      setRemoveBusy(false);
    }
  };

  const changeView = (v: View) => { setView(v); setPage(1); };
  const changeFilters = (f: Filters) => { setFilters(f); setPage(1); };
  const changeSort = (s: Sort) => { setSort(s); setPage(1); };
  const narrowed = !!debounced || activeFilterCount(filters) > 0;
  const total0 = counts.all;

  const body = useMemo(() => {
    if (error) return <EmptyState title="Couldn't load your team" description="Check your connection, then try again." onRetry={reload} />;
    if (loading && people.length === 0) {
      return (
        <div aria-busy="true" aria-label="Loading people" style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ height: 52, borderRadius: 12, background: t.idleBg }} />)}
        </div>
      );
    }
    if (people.length === 0) {
      if (narrowed) {
        return <EmptyState title="No one matches" description="Try a different search, or clear some filters."
          action={{ label: 'Clear filters and search', onClick: () => { setSearch(''); setDebounced(''); changeFilters(NO_FILTERS); } }} />;
      }
      if (view === 'all') return <EmptyState title="No one on the team yet" description="Invite your first teammate to get started." action={{ label: 'Invite teammate', onClick: () => setInviting(true) }} />;
      return <EmptyState title={EMPTY_VIEW[view].title} description={EMPTY_VIEW[view].description} />;
    }
    return (
      <PeopleTable isDark={isDark} people={people} sort={sort} onSort={changeSort}
        page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} currentUserId={me?.id}
        onOpen={setOpen} onToggleActive={toggleActive} onRemove={setRemoving} />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, loading, people, narrowed, view, isDark, sort, page, total, me?.id, t.idleBg]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 4px 48px', fontFamily: t.body, color: t.ink, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{PAGE_CSS}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontFamily: t.head, fontWeight: 700, fontSize: '1.6rem', letterSpacing: '-0.015em' }}>
            Team{total0 != null && <span style={{ fontWeight: 400, fontSize: '1rem', color: t.ink2, marginLeft: 10 }}>{`${total0} ${total0 === 1 ? 'person' : 'people'}`}</span>}
          </h1>
          <p style={{ margin: 0, color: t.ink2, fontSize: '0.92rem' }}>Everyone who can sign in to the staff dashboard, and what each person can do.</p>
        </div>
        <span style={{ display: 'flex', gap: 10 }}>
          <Btn isDark={isDark} variant="plain" onClick={() => setComparing(true)}>Compare roles</Btn>
          <Btn isDark={isDark} onClick={() => setInviting(true)}><UserPlus size={17} aria-hidden="true" />Invite teammate</Btn>
        </span>
      </div>

      <FilterBar isDark={isDark} view={view} onView={changeView} counts={counts} search={search} onSearch={setSearch}
        filters={filters} onFilters={changeFilters} sort={sort} onSort={changeSort} teams={teams} sites={sites} />

      {body}

      {open && (
        <PersonDialog isDark={isDark} person={open} sites={sites} devices={devices} teams={teams} isSelf={open.id === me?.id}
          onClose={() => setOpen(null)} onSaved={(m) => { toast('success', m); setOpen(null); reload(); }}
          onToggleActive={toggleActive} onRemove={setRemoving} onCreateTeam={createTeam} onCompareRoles={() => setComparing(true)} />
      )}
      {inviting && (
        <InviteDialog isDark={isDark} sites={sites} devices={devices} teams={teams}
          defaultRole={view === 'admin' || view === 'viewer' ? view : 'employee'}
          onClose={() => setInviting(false)} onCreateTeam={createTeam} onCompareRoles={() => setComparing(true)}
          onCreated={(_first, email) => { toast('success', `Welcome email sent to ${email}.`); setInviting(false); reload(); }} />
      )}
      {comparing && <CompareRoles isDark={isDark} onClose={() => setComparing(false)} />}

      <ConfirmDialog isDark={isDark} open={!!removing} title={removing ? `Remove ${firstNameOf(removing)}?` : ''}
        body="Their account is deleted for good." confirmLabel="Remove" cancelLabel="Keep them" busy={removeBusy}
        onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
    </div>
  );
};

export default EmployeesPage;
