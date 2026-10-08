import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTokens, ConfirmDialog, Btn } from '../siteHardware/ui';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiService } from '../../../services/api';
import { PeopleList, TabKey } from './PeopleList';
import { PersonPanel } from './PersonPanel';
import { AddTeammateDialog } from './AddTeammateDialog';
import {
  Person, RoleKey, SiteOption, Team, buildPayload, formFromPerson, friendlyError, firstNameOf, statusOf,
} from './roles';

const PAGE_SIZE = 25;
// The drawer/dialog/confirm animations come from the shared friendly-UI keyframes,
// which are normally injected by SetupShell; this page does not use SetupShell.
const KEYFRAMES = `
@keyframes fs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fs-dialog { from { opacity: 0; transform: scale(0.95) translateY(6px); } to { opacity: 1; transform: none; } }
`;

const EmployeesPage: React.FC = () => {
  const { isDark } = useTheme();
  const { user: me } = useAuth();
  const { addToast } = useToast();
  const t = useTokens(isDark);

  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<TabKey, number | undefined>>({ all: undefined, admin: undefined, employee: undefined, viewer: undefined });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState<Person | null>(null);
  const [adding, setAdding] = useState<{ role: RoleKey } | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    // Only reset to page 1 when the search text actually changed; an unconditional reset
    // would bounce a user who clicks Next within 300 ms of the page loading.
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
    apiService.getEmployees(debounced || undefined, page, PAGE_SIZE, tab === 'all' ? undefined : tab)
      .then((res) => { if (!cancelled) { setPeople(res.results ?? []); setTotal(res.count ?? 0); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, debounced, page, version]);

  useEffect(() => {
    apiService.getEmployeeRoleCounts().then(setCounts).catch(() => undefined);
  }, [version]);

  useEffect(() => {
    apiService.getSitesList({ includeInactive: true })
      .then((rows) => setSites((rows ?? []).map((s: any) => ({ site_id: s.site_id, display_name: s.display_name || s.site_id }))))
      .catch(() => undefined);
    apiService.getTeams()
      .then((res) => setTeams((res.results ?? []).filter((x: any) => x.is_active !== false).map((x: any) => ({ id: x.id, name: x.name }))))
      .catch(() => undefined);
  }, []);

  // If the list shrank (e.g. the last person on the last page was removed), step back to the last page.
  useEffect(() => {
    const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (!loading && page > 1 && page > last) setPage(last);
  }, [total, page, loading]);

  const siteNames = useMemo(() => Object.fromEntries(sites.map((s) => [s.site_id, s.display_name])), [sites]);

  const toast = (type: 'success' | 'error', title: string) => addToast({ type, title });

  const toggleActive = async (p: Person) => {
    const nowActive = statusOf(p).key !== 'inactive';
    try {
      await apiService.updateEmployee(p.id, buildPayload(formFromPerson(p), { address: p.address, is_active: !nowActive }));
      toast('success', nowActive ? `${firstNameOf(p)} can no longer sign in.` : `${firstNameOf(p)} can sign in again.`);
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
      reload();
    } catch (err) {
      toast('error', friendlyError(err));
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1184, margin: '0 auto', padding: '8px 4px 48px', fontFamily: t.body, color: t.ink }}>
      <style>{KEYFRAMES}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontFamily: t.head, fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.015em' }}>Your team</h1>
          <p style={{ margin: 0, color: t.ink2, fontSize: '0.95rem', maxWidth: '56ch', lineHeight: 1.5 }}>
            Everyone who can sign in to the staff dashboard, and what each person can do.
          </p>
        </div>
        <Btn isDark={isDark} onClick={() => setAdding({ role: 'employee' })}><UserPlus size={17} aria-hidden="true" />Add a teammate</Btn>
      </div>

      <PeopleList
        isDark={isDark} people={people} siteNames={siteNames} loading={loading} error={error} onRetry={reload}
        tab={tab} onTab={(k) => { setTab(k); setPage(1); }} counts={counts}
        search={search} onSearch={setSearch} page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage}
        currentUserId={me?.id} onOpen={setOpen} onToggleActive={toggleActive} onRemove={setRemoving}
        onAdd={(role) => setAdding({ role: role ?? 'employee' })}
      />

      {open && (
        <PersonPanel
          isDark={isDark} person={open} sites={sites} teams={teams} isSelf={open.id === me?.id}
          onClose={() => setOpen(null)}
          onSaved={(message) => { toast('success', message); setOpen(null); reload(); }}
        />
      )}

      {adding && (
        <AddTeammateDialog
          isDark={isDark} sites={sites} teams={teams} defaultRole={adding.role}
          onClose={() => setAdding(null)}
          onTeamAdded={(team) => setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)))}
          onCreated={(_firstName, email) => { toast('success', `Invite sent to ${email}.`); setAdding(null); reload(); }}
        />
      )}

      <ConfirmDialog
        isDark={isDark} open={!!removing} title={removing ? `Remove ${firstNameOf(removing)}?` : ''}
        body="Their account is deleted for good." confirmLabel="Remove" cancelLabel="Keep them" busy={removeBusy}
        onConfirm={confirmRemove} onCancel={() => setRemoving(null)}
      />
    </div>
  );
};

export default EmployeesPage;
