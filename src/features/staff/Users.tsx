import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Users as UsersIcon } from 'lucide-react';
import { apiService } from '../../services/api';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileUsers from '../mobile/staff/MobileUsers';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../shared/components/Feedback';
import PhoneInput from '../../shared/components/PhoneInput';
import PageHeader from '../../shared/layout/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../shared/ui/dialog';
import { Input } from '../../shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table';
import { ConfirmDialog } from './siteHardware/ui';
import { DEFAULT_PAGE_SIZE } from '../../app/constants';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
  is_active: boolean;
  customer_id: string | null;
  date_joined: string;
}

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  provisioned_at?: string;
  config_version?: string;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type Form = { email: string; first_name: string; last_name: string; mobile_number: string; address: string };
const EMPTY: Form = { email: '', first_name: '', last_name: '', mobile_number: '', address: '' };

const AVATARS = ['#2EF0CC', '#E9B949', '#8FB8F0', '#F0A58F', '#C9A6F0', '#9BE3A0'];
const avatarColor = (s: string) => AVATARS[Math.abs([...s].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % AVATARS.length];
const initials = (u: User) =>
  (u.first_name && u.last_name ? u.first_name[0] + u.last_name[0] : (u.first_name || u.username).slice(0, 2)).toUpperCase();
const fullName = (u: User) => `${u.first_name} ${u.last_name}`.trim() || u.username;
const day = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString() : '-';
};

function Field({ label, error, children, wide }: { label: string; error?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label className="text-[0.78rem] font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <span className="text-[0.75rem] leading-tight text-destructive" role="alert">{error}</span>}
    </div>
  );
}

const Users: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { addToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  const [dialog, setDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [form, setForm] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.getUsers(debouncedSearch || undefined, page, pageSize);
      setUsers(r.results || []);
      setTotalCount(r.count ?? 0);
      setTotalPages(r.total_pages ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const visible = users.filter((u) => statusFilter === 'all' || (statusFilter === 'active') === u.is_active);
  const selected = users.find((u) => u.id === selectedId) ?? visible[0] ?? null;
  const selectedKey = selected?.id ?? null;

  useEffect(() => {
    if (selectedKey === null) { setDevices([]); return; }
    let live = true;
    setLoadingDevices(true); setDeviceSearch('');
    apiService.getUserDevices(selectedKey)
      .then((d) => { if (live) setDevices(Array.isArray(d) ? d : []); })
      .catch(() => { if (live) setDevices([]); })
      .finally(() => { if (live) setLoadingDevices(false); });
    return () => { live = false; };
  }, [selectedKey]);

  const openDialog = (user: User | null) => {
    setForm(user ? {
      email: user.email, first_name: user.first_name, last_name: user.last_name,
      mobile_number: user.mobile_number || '', address: user.address || '',
    } : EMPTY);
    setTried(false); setDialogError(null); setDialog({ open: true, user });
  };
  const closeDialog = () => setDialog({ open: false, user: null });

  const errs: Partial<Record<keyof Form, string>> = {};
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email';
  if (!form.first_name.trim()) errs.first_name = 'Required';
  if (!form.last_name.trim()) errs.last_name = 'Required';
  if (!form.mobile_number.trim()) errs.mobile_number = 'Required';

  const save = async () => {
    setTried(true);
    if (Object.keys(errs).length) return;
    setSaving(true); setDialogError(null);
    try {
      if (dialog.user) await apiService.updateUser(dialog.user.id, form);
      else await apiService.createUser(form);
      closeDialog();
      addToast({ type: 'success', title: dialog.user ? 'User saved' : 'User added', message: dialog.user ? undefined : 'The account starts inactive. Use Activate to send the setup email.' });
      await load();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not save the user');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (u: User) => {
    try {
      await apiService.activateUser(u.id);
      addToast({ type: 'success', title: 'Account activated', message: `Setup email sent to ${u.email}.` });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate user');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiService.deleteUser(deleteTarget.id);
      addToast({ type: 'success', title: 'User deleted', message: deleteTarget.username });
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (isMobile) return <MobileUsers />;

  const dq = deviceSearch.trim().toLowerCase();
  const shownDevices = devices.filter((d) => !dq || d.device_serial.toLowerCase().includes(dq) || (d.hw_id || '').toLowerCase().includes(dq));
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 } as const;

  return (
    <div className="admin-container responsive-page">
      <PageHeader icon={<UsersIcon size={20} color="white" />} title="Users" subtitle="Customer accounts and their devices" />

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error" style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <section className="overflow-hidden rounded-[20px] border border-border bg-card" aria-label="Users">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border px-4 py-3.5">
          <div className="flex min-w-0 flex-[1_1_240px] flex-wrap items-center gap-x-3.5 gap-y-2.5">
            <h2 className="m-0 text-[1.05rem] font-semibold">Users</h2>
            {totalCount > 0 && <span className="font-mono text-[0.85rem] text-muted-foreground">{totalCount} users</span>}
            <Input type="search" aria-label="Search users" placeholder="Search name, email or mobile" value={search}
              onChange={(e) => setSearch(e.target.value)} className="max-w-80 flex-[1_1_200px]" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-auto min-w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button type="button" className="ui-btn ui-btn--main" onClick={() => openDialog(null)}>Add user</button>
        </div>

        {loading && users.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-sm text-muted-foreground">Loading users...</p>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <UsersIcon size={40} strokeWidth={1.25} className="mx-auto mb-3 text-muted-foreground" />
            <p className="m-0 font-semibold">{totalCount === 0 && !debouncedSearch ? 'No users yet' : 'No users match'}</p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {totalCount === 0 && !debouncedSearch ? 'Use Add user to create the first one.' : 'Change the search or the status filter.'}
            </p>
          </div>
        ) : (
          <Table containerClassName="rounded-none border-0">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Mobile</TableHead>
                <TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((u) => (
                <TableRow key={u.id} data-testid={`user-row-${u.id}`} tabIndex={0} aria-selected={selected?.id === u.id}
                  onClick={() => setSelectedId(u.id)} onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(u.id); }}
                  className={`cursor-pointer ${selected?.id === u.id ? 'bg-primary/10' : ''}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-[34px] shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold text-[#06070B]" style={{ background: avatarColor(u.username) }}>{initials(u)}</span>
                      <div className="min-w-0">
                        <div className="font-medium">{fullName(u)}</div>
                        <div className="font-mono text-[0.78rem] text-text-dim">@{u.username}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="font-mono">{u.mobile_number || '-'}</TableCell>
                  <TableCell>{day(u.date_joined)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-primary/15 text-primary' : 'bg-secondary/20 text-secondary'}`}>
                      <span className="size-[7px] rounded-full bg-current" />{u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {!u.is_active && <button type="button" className="ui-btn ui-btn--main ui-btn--sm" onClick={(e) => { e.stopPropagation(); activate(u); }}>Activate</button>}
                      <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={(e) => { e.stopPropagation(); openDialog(u); }}>Edit</button>
                      <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}>Delete</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="font-mono text-[0.85rem] text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                <SelectTrigger aria-label="Rows per page" className="w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>)}</SelectContent>
              </Select>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="mt-5 overflow-hidden rounded-[20px] border border-border bg-card" aria-label="User details">
          <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 border-b border-border px-4 py-3.5">
            <div className="min-w-0">
              <h2 className="m-0 text-[1.05rem] font-semibold">{fullName(selected)}</h2>
              <span className="font-mono text-[0.82rem] text-text-dim">@{selected.username}{selected.customer_id ? ` · ${selected.customer_id}` : ''}</span>
            </div>
            <button type="button" className="ui-btn ui-btn--support" onClick={() => openDialog(selected)}>Edit user</button>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3.5 border-b border-border px-4 py-3.5">
            {[['Email', selected.email], ['Mobile', selected.mobile_number || '-'], ['Joined', day(selected.date_joined)]].map(([k, v]) => (
              <div key={k} className="min-w-[140px]"><div className="text-[0.78rem] text-text-dim">{k}</div><div className="break-words text-[0.92rem]">{v}</div></div>
            ))}
            <div className="min-w-[220px] flex-[1_1_220px]"><div className="text-[0.78rem] text-text-dim">Address</div><div className="break-words text-[0.92rem]">{selected.address || '-'}</div></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
            <h3 className="m-0 text-[0.95rem] font-semibold">Devices <span className="font-mono font-normal text-text-dim">({devices.length}{dq ? `, ${shownDevices.length} shown` : ''})</span></h3>
            {devices.length > 0 && <Input type="search" aria-label="Search devices" placeholder="Search serial or hardware ID" value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)} className="max-w-64" />}
          </div>
          {loadingDevices ? (
            <p className="m-0 px-4 pb-5 text-sm text-muted-foreground">Loading devices...</p>
          ) : devices.length === 0 ? (
            <EmptyState icon={Cpu} title="No devices assigned yet" />
          ) : (
            <Table containerClassName="rounded-none border-0 border-t">
              <TableHeader>
                <TableRow><TableHead>Serial</TableHead><TableHead>Hardware ID</TableHead><TableHead>Model</TableHead><TableHead>Config version</TableHead><TableHead>Provisioned</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {shownDevices.map((d) => (
                  <TableRow key={d.id} data-testid={`device-row-${d.id}`} className="cursor-pointer" onClick={() => navigate(`/devices/${d.id}/dashboard`)}>
                    <TableCell className="font-mono">{d.device_serial}</TableCell>
                    <TableCell className="font-mono">{d.hw_id || '-'}</TableCell>
                    <TableCell>{d.model || '-'}</TableCell>
                    <TableCell className="font-mono">{d.config_version || '-'}</TableCell>
                    <TableCell>{day(d.provisioned_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[20px] bg-popover p-0 sm:max-w-lg">
          <div className="border-b border-border px-4 py-2.5 pr-12">
            <DialogTitle className="m-0 text-base">{dialog.user ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription className="m-0 font-mono text-[0.78rem]">{dialog.user ? `@${dialog.user.username}` : 'New customer account'}</DialogDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {dialogError && <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive" role="alert">{dialogError}</div>}
            <div style={grid}>
              <Field label="Email" wide error={tried ? errs.email : undefined}>
                <Input aria-label="Email" type="email" value={form.email} className="h-8 px-2.5 text-[0.85rem]" autoComplete="off"
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="First name" error={tried ? errs.first_name : undefined}>
                <Input aria-label="First name" value={form.first_name} className="h-8 px-2.5 text-[0.85rem]" onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </Field>
              <Field label="Last name" error={tried ? errs.last_name : undefined}>
                <Input aria-label="Last name" value={form.last_name} className="h-8 px-2.5 text-[0.85rem]" onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Field>
              <Field label="Mobile" error={tried ? errs.mobile_number : undefined}>
                <PhoneInput value={form.mobile_number} onChange={(v) => setForm({ ...form, mobile_number: v })} required isDark={isDark} inlineStyle />
              </Field>
              <Field label="Address">
                <Input aria-label="Address" value={form.address} className="h-8 px-2.5 text-[0.85rem]" autoComplete="off" onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-2.5">
            {!dialog.user && <span className="mr-auto text-[0.82rem] text-text-dim">Starts inactive. Activate it to send the setup email.</span>}
            <button type="button" className="ui-btn ui-btn--link" onClick={closeDialog}>Cancel</button>
            <button type="button" className="ui-btn ui-btn--main" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save user'}</button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isDark={isDark}
        open={!!deleteTarget}
        title="Delete this user?"
        body={deleteTarget && `${fullName(deleteTarget)} (@${deleteTarget.username}) and their sign-in will be removed. This cannot be undone.`}
        confirmLabel="Delete user"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Users;
