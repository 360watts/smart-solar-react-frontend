import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, ChevronLeft } from 'lucide-react';
import { apiService, QuotationDetail, QuotationEvent, QuotationListItem } from '../../services/api';
import { generatePdfBlob } from './hooks/usePdfExport';
import type { QuotationData } from './types/quotation';
import QuotationWizard from './QuotationWizard';
import PageHeader from '../../shared/layout/PageHeader';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useTheme } from '../../contexts/ThemeContext';
import MobileQuotationPage from '../mobile/staff/MobileQuotationPage';
import { Input } from '../../shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table';
import { ConfirmDialog } from '../staff/siteHardware/ui';
import { daysSince } from './utils/pipelineStats';
import './quotation.css';

type Filter = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'follow_up';
type Stat = { count: number; value: number };

const FOLLOW_UP_DAYS = 3; // keep in step with FOLLOW_UP_DAYS in the backend's views/quotations.py
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const stamp = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SYSTEM: Record<string, string> = { on_grid: 'On-grid', hybrid: 'Hybrid', off_grid: 'Off-grid' };
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const sentDays = (q: QuotationListItem) => daysSince(q.sent_at ?? q.updated_at);
const needsFollowUp = (q: QuotationListItem) => q.status === 'sent' && sentDays(q) >= FOLLOW_UP_DAYS;

const PILL: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  accepted: 'bg-primary/15 text-primary',
  rejected: 'border border-border text-muted-foreground',
  expired: 'border border-border text-muted-foreground',
};
function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[status] ?? PILL.draft}`}>
      <span className="size-[7px] rounded-full bg-current" />{cap(status)}
    </span>
  );
}

const SENT_BY: Record<string, string> = { manual: 'Marked sent', whatsapp: 'Sent by WhatsApp', email: 'Sent by email', link: 'Sent as a link', print: 'Printed and handed over' };
function eventLabel(e: QuotationEvent): string {
  const m = (e.metadata ?? {}) as Record<string, string>;
  switch (e.event_type) {
    case 'created': return 'Created';
    case 'updated': return 'Edited';
    case 'sent': return SENT_BY[m.delivery_method] ?? 'Sent';
    case 'accepted': return 'Accepted';
    case 'rejected': return m.reason ? `Rejected: ${m.reason}` : 'Rejected';
    case 'revised': return m.parent_quote_number ? `Revised from ${m.parent_quote_number}` : 'Revised';
    case 'validity_extended': return `Validity extended to ${m.valid_until ? day(m.valid_until) : 'a new date'}`;
    case 'archived': return 'Deleted';
    default: return cap(e.event_type.replace(/_/g, ' '));
  }
}

/** Newest first; a run of auto-saves reads as one "Edited (5 times)" line. */
function history(events: QuotationEvent[]) {
  const sorted = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out: { label: string; when: string; who: string | null; times: number }[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (prev && e.event_type === 'updated' && prev.label === 'Edited') { prev.times += 1; continue; }
    out.push({ label: eventLabel(e), when: e.created_at, who: e.actor_name, times: 1 });
  }
  return out;
}

async function sharePdf(item: QuotationListItem, channel: 'wa' | 'email') {
  const toastId = toast.loading('Making the PDF…');
  try {
    const detail = await apiService.getQuotation(item.public_id);
    const data = detail.form_data as unknown as QuotationData;
    const { blob, filename } = await generatePdfBlob(data);
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Solar proposal ${item.quote_number}` });
      toast.success('PDF shared', { id: toastId });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    const phone = (item.customer_phone ?? '').replace(/\D/g, '');
    if (channel === 'wa' && phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hi, please find your solar proposal (${item.quote_number}) attached.`)}`, '_blank');
    } else if (channel === 'email') {
      const subject = encodeURIComponent(`Solar proposal ${item.quote_number}`);
      const body = encodeURIComponent(`Dear Customer,\n\nPlease find your solar proposal (${item.quote_number}) attached.\n\nRegards,\n360Watts Energy Solutions`);
      window.location.href = `mailto:${item.customer_email ?? ''}?subject=${subject}&body=${body}`;
    }
    toast.success('PDF downloaded. Attach it to your message.', { id: toastId });
  } catch (err: any) {
    if (err?.name === 'AbortError') toast.dismiss(toastId);
    else toast.error('Could not make the PDF. Try again.', { id: toastId });
  }
}

function DetailPanel({ item, onChanged, onEdit, onDelete }: {
  item: QuotationListItem;
  onChanged: () => void;
  onEdit: (id: string) => void;
  onDelete: (item: QuotationListItem) => void;
}) {
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setDetail(null); setLoadError(null); setRejecting(false); setReason('');
    apiService.getQuotation(item.public_id)
      .then(d => { if (live) setDetail(d); })
      .catch(e => { if (live) setLoadError(errText(e, 'Could not load the history.')); });
    return () => { live = false; };
  }, [item.public_id, item.status, item.updated_at, attempt]);

  async function run(kind: 'sent' | 'accepted' | 'rejected') {
    setBusy(kind);
    try {
      if (kind === 'sent') await apiService.sendQuotation(item.public_id, { delivery_method: 'manual' });
      if (kind === 'accepted') await apiService.acceptQuotation(item.public_id, {});
      if (kind === 'rejected') await apiService.rejectQuotation(item.public_id, { reason: reason.trim() || 'No reason given' });
      toast.success(kind === 'sent' ? 'Marked sent' : kind === 'accepted' ? 'Marked accepted' : 'Marked rejected');
      onChanged();
    } catch (e) {
      toast.error(errText(e, 'Could not change the status. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  const left = -daysSince(item.valid_until);
  const validEnded = left < 0;
  const validWarn = item.status === 'sent' && left <= 3;
  const validText = validEnded ? `Ended ${day(item.valid_until)}` : left === 0 ? 'Ends today' : `${day(item.valid_until)}, ${left} day${left === 1 ? '' : 's'} left`;
  const phone = (item.customer_phone ?? '').replace(/\D/g, '');
  const customerAccount = detail?.customer;

  let next: React.ReactNode = null;
  if (item.status === 'draft') next = (<>
    <p className="m-0">Not sent yet. Finish the proposal, share it, then mark it sent.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-btn ui-btn--main" onClick={() => onEdit(item.public_id)}>Edit proposal</button>
      <button type="button" className="ui-btn ui-btn--support" disabled={!!busy} onClick={() => run('sent')}>{busy === 'sent' ? 'Marking…' : 'Mark sent'}</button>
    </div>
  </>);
  if (item.status === 'sent' && !rejecting) next = (<>
    <p className="m-0">{needsFollowUp(item) ? `Sent ${sentDays(item)} days ago with no answer. Worth a call.` : 'Waiting for the customer.'}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-btn ui-btn--main" disabled={!!busy} onClick={() => run('accepted')}>{busy === 'accepted' ? 'Saving…' : 'Mark accepted'}</button>
      <button type="button" className="ui-btn ui-btn--support" onClick={() => setRejecting(true)}>Mark rejected</button>
      <button type="button" className="ui-btn ui-btn--support" onClick={() => onEdit(item.public_id)}>Revise</button>
    </div>
    {validWarn && <p className="m-0 text-amber-600 dark:text-amber-400">{validEnded ? 'Validity has ended.' : 'Validity ends soon.'} Revise it to send current prices.</p>}
  </>);
  if (item.status === 'sent' && rejecting) next = (<>
    <label htmlFor="q-reject-reason">Why did they say no?</label>
    <textarea id="q-reject-reason" rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
      placeholder="For example: chose another installer, price too high"
      className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm" />
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-btn ui-btn--main" disabled={!!busy} onClick={() => run('rejected')}>{busy === 'rejected' ? 'Saving…' : 'Mark rejected'}</button>
      <button type="button" className="ui-btn ui-btn--link" onClick={() => setRejecting(false)}>Keep it open</button>
    </div>
  </>);
  if (item.status === 'accepted') next = (
    <p className="m-0">
      Accepted{item.accepted_at ? ` on ${day(item.accepted_at)}` : ''}.{' '}
      {customerAccount ? 'A customer account was created from their email. Activate it from Users.' : item.customer_email ? '' : 'No email on this quote, so no customer account was created.'}
    </p>
  );
  if (item.status === 'rejected' || item.status === 'expired') next = (<>
    <p className="m-0">{item.status === 'expired' ? `The validity ended on ${day(item.valid_until)}.` : 'The customer said no.'} Revise it to send an updated proposal.</p>
    <div><button type="button" className="ui-btn ui-btn--support" onClick={() => onEdit(item.public_id)}>Revise and resend</button></div>
  </>);

  const rows: [string, React.ReactNode, string?][] = [
    ['System', `${Number(item.system_kw)} kW ${(SYSTEM[item.system_type] ?? item.system_type).toLowerCase()}`, 'font-mono'],
    ['Phone', item.customer_phone || '–', 'font-mono'],
    ['Email', item.customer_email || <span className="text-muted-foreground">Not given</span>],
    ['Valid until', validText, validWarn ? 'text-amber-600 dark:text-amber-400' : ''],
    ['Created', `${day(item.created_at)}${item.created_by_name ? `, ${item.created_by_name}` : ''}`],
  ];
  if (item.revision_number > 1) rows.push(['Revision', `${item.revision_number}${detail?.parent_quote_number ? ` (from ${detail.parent_quote_number})` : ''}`]);

  return (
    <>
      <div className="border-b border-border px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm text-muted-foreground">{item.quote_number}</span>
          <StatusPill status={item.status} />
        </div>
        <h2 className="m-0 mt-1 text-xl font-semibold leading-tight">{item.customer_name}</h2>
        <div className="mt-1 font-mono text-[1.75rem] font-medium text-primary">{INR.format(Number(item.net_investment))}</div>
        <div className="text-sm text-muted-foreground">Net investment after subsidy and discount</div>
      </div>

      {next && <div className="flex flex-col gap-2.5 border-b border-border bg-muted/40 px-5 py-3.5 text-sm">{next}</div>}

      <dl className="m-0 [display:grid] grid-cols-[auto_1fr] gap-x-4 border-b border-border px-5 py-1.5 text-sm">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="contents">
            <dt className="py-2 text-muted-foreground">{k}</dt>
            <dd className={`m-0 py-2 text-right ${cls ?? ''}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-border px-5 py-3">
        <h3 className="m-0 mb-2 text-[0.9375rem] font-medium text-muted-foreground">History</h3>
        {loadError ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-amber-600 dark:text-amber-400">{loadError}</span>
            <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={() => setAttempt(a => a + 1)}>Try again</button>
          </div>
        ) : !detail ? <p className="m-0 text-sm text-muted-foreground">Loading…</p> : (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {history(detail.events ?? []).map((h, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
                <div>
                  <div>{h.label}{h.times > 1 ? ` (${h.times} times)` : ''}</div>
                  <div className="text-muted-foreground">{stamp(h.when)}{h.who ? `, ${h.who}` : ''}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-3.5">
        <span className="text-sm text-muted-foreground">Share</span>
        <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={!phone} title={phone ? undefined : 'No phone number on this quote'} onClick={() => sharePdf(item, 'wa')}>WhatsApp</button>
        <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => sharePdf(item, 'email')}>Email</button>
        <button type="button" className="ui-btn ui-btn--danger ui-btn--sm ml-auto" onClick={() => onDelete(item)}>Delete</button>
      </div>
    </>
  );
}

export default function QuotationPage() {
  return useIsMobile() ? <MobileQuotationPage /> : <QuotationDesktop />;
}

function QuotationDesktop() {
  const { isDark } = useTheme();
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [editId, setEditId] = useState<string | null>(null);

  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [followUp, setFollowUp] = useState<Stat>({ count: 0, value: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (p: number, q: string, f: Filter) => {
    const reqId = ++requestIdRef.current;
    setError(null); setLoading(true);
    try {
      const data = await apiService.listQuotations({
        page: p,
        ...(q ? { search: q } : {}),
        ...(f === 'follow_up' ? { follow_up: true } : f !== 'all' ? { status: f } : {}),
      });
      if (reqId !== requestIdRef.current) return;
      setItems(data.results); setPage(data.page); setTotalPages(data.total_pages); setTotal(data.total);
      setPageSize(data.page_size || 15);
      setStats(data.stats ?? {}); setFollowUp(data.follow_up ?? { count: 0, value: 0 });
    } catch {
      if (reqId === requestIdRef.current) setError('Could not load quotations. Check your connection and try again.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Search waits 300 ms after typing; a filter change loads at once.
  useEffect(() => {
    if (view !== 'list') return;
    const t = setTimeout(() => fetchPage(1, search, filter), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, filter, view, fetchPage]);

  const reload = () => fetchPage(page, search, filter);
  const openEdit = (id: string | null) => { setEditId(id); setView('wizard'); };

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiService.deleteQuotation(deleteTarget.public_id);
      if (selectedId === deleteTarget.public_id) setSelectedId(null);
      setDeleteTarget(null);
      toast.success('Quotation deleted');
      reload();
    } catch (e) {
      toast.error(errText(e, 'Could not delete the quotation. Try again.'));
    } finally {
      setDeleting(false);
    }
  }

  if (view === 'wizard') {
    return (
      <div className="admin-container responsive-page sq-root">
        <PageHeader
          icon={<FileText size={20} color="white" />}
          title={editId ? 'Edit proposal' : 'New proposal'}
          subtitle="Customer, sizing, bill of materials and review"
          rightSlot={(
            <button type="button" className="ui-btn ui-btn--support" onClick={() => setView('list')}>
              <ChevronLeft style={{ width: 14, height: 14, marginRight: 6 }} />
              All quotations
            </button>
          )}
        />
        <div className="sq-page-inner sq-page-inner--embedded">
          <QuotationWizard publicId={editId} onSaved={() => setView('list')} />
        </div>
      </div>
    );
  }

  const stage = (k: string) => stats[k] ?? { count: 0, value: 0 };
  const stages: { key: Filter; label: string; s: Stat; sub: string; warn?: boolean }[] = [
    { key: 'draft', label: 'Draft', s: stage('draft'), sub: INR.format(stage('draft').value) },
    { key: 'sent', label: 'Sent, waiting', s: stage('sent'), sub: INR.format(stage('sent').value) },
    { key: 'accepted', label: 'Accepted', s: stage('accepted'), sub: INR.format(stage('accepted').value) },
    { key: 'follow_up', label: 'Needs a follow-up call', s: followUp, sub: `sent ${FOLLOW_UP_DAYS}+ days ago`, warn: true },
  ];
  const selected = items.find(i => i.public_id === selectedId) ?? null;
  const hasFilters = search !== '' || filter !== 'all';

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<FileText size={20} color="white" />}
        title="Quotations"
        subtitle="Solar proposals for customers. Pick one to see where it stands and what to do next."
        rightSlot={<button type="button" className="ui-btn ui-btn--main" onClick={() => openEdit(null)}>New quotation</button>}
      />

      <div aria-label="Pipeline" className="mb-4 [display:grid] grid-cols-[repeat(2,minmax(0,1fr))] overflow-hidden rounded-[20px] border border-border bg-card md:grid-cols-[repeat(4,minmax(0,1fr))]">{/* not grid-cols-2: App.css redefines that class */}
        {stages.map((st, i) => {
          const on = filter === st.key;
          return (
            <button key={st.key} type="button" aria-pressed={on} onClick={() => setFilter(on ? 'all' : st.key)}
              className={`relative flex flex-col items-start gap-0.5 border-border px-5 py-3.5 text-left ${i % 2 ? 'border-l' : ''} ${i > 0 ? 'md:border-l' : ''} ${i > 1 ? 'border-t md:border-t-0' : ''} ${on ? 'bg-primary/10' : 'hover:bg-muted/60'}`}>
              <span className="text-sm text-muted-foreground">{st.label}</span>
              <span className={`font-mono text-2xl font-medium leading-tight ${st.warn && st.s.count > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{loading && !total ? '–' : st.s.count}</span>
              <span className="font-mono text-sm text-muted-foreground">{st.sub}</span>
              {on && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-primary" />}
            </button>
          );
        })}
      </div>

      <div className="[display:grid] grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Quotations" className="min-w-0 overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3.5">
            <Input type="search" aria-label="Search quotations" placeholder="Search customer or quote number"
              value={search} onChange={e => setSearch(e.target.value)} className="max-w-80 flex-[1_1_220px]" />
            <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
              <SelectTrigger aria-label="Status" className="w-auto min-w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="follow_up">Needs a follow-up call</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>}
            {!loading && <span className="ml-auto font-mono text-[0.85rem] text-muted-foreground">{total} quotation{total === 1 ? '' : 's'}</span>}
          </div>

          {error ? (
            <div className="px-5 py-12 text-center">
              <p className="m-0 font-semibold">{error}</p>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm mt-3" onClick={reload}>Try again</button>
            </div>
          ) : loading && items.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-sm text-muted-foreground">Loading quotations…</p>
          ) : items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText size={40} strokeWidth={1.25} className="mx-auto mb-3 text-muted-foreground" />
              <p className="m-0 font-semibold">{hasFilters ? 'No quotations match' : 'No quotations yet'}</p>
              <p className="m-0 mt-1 text-sm text-muted-foreground">{hasFilters ? 'Change the search or the status.' : 'Use New quotation to start one. Drafts save as you go.'}</p>
            </div>
          ) : (
            <Table containerClassName={`rounded-none border-0 ${loading ? 'opacity-60' : ''}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">System</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(q => (
                  <TableRow key={q.public_id} tabIndex={0} aria-selected={q.public_id === selectedId}
                    onClick={() => setSelectedId(q.public_id)}
                    onKeyDown={e => { if (e.key === 'Enter') setSelectedId(q.public_id); }}
                    className={`cursor-pointer ${q.public_id === selectedId ? 'bg-primary/10' : ''}`}>
                    <TableCell>
                      <div className="font-mono text-sm">{q.quote_number}</div>
                      <div className="text-sm text-muted-foreground">Updated {day(q.updated_at ?? q.created_at)}</div>
                    </TableCell>
                    <TableCell className="min-w-[160px] whitespace-normal">
                      <div className="font-medium">{q.customer_name}</div>
                      <div className="font-mono text-sm text-muted-foreground">{q.customer_phone}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono">{Number(q.system_kw)} kW</div>
                      <div className="text-sm text-muted-foreground">{SYSTEM[q.system_type] ?? q.system_type}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{INR.format(Number(q.net_investment))}</TableCell>
                    <TableCell>
                      <StatusPill status={q.status} />
                      {needsFollowUp(q) && <div className="mt-1 text-sm text-amber-600 dark:text-amber-400">Follow up, {sentDays(q)} days</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!error && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="font-mono text-[0.85rem] text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
              </span>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, search, filter)}>Previous</button>
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1, search, filter)}>Next</button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside aria-label="Quotation details" aria-live="polite" className="overflow-hidden rounded-[20px] border border-border bg-card">
          {selected
            ? <DetailPanel item={selected} onChanged={reload} onEdit={openEdit} onDelete={setDeleteTarget} />
            : <p className="m-0 px-6 py-16 text-center text-sm text-muted-foreground">Pick a quotation to see its amount, history and next step.</p>}
        </aside>
      </div>

      <ConfirmDialog isDark={isDark} open={!!deleteTarget} busy={deleting} title="Delete this quotation?"
        body={deleteTarget ? `${deleteTarget.quote_number} for ${deleteTarget.customer_name} leaves the list and the pipeline totals.` : undefined}
        confirmLabel="Delete" cancelLabel="Keep it" onConfirm={handleDelete} onCancel={() => !deleting && setDeleteTarget(null)} />
    </div>
  );
}
