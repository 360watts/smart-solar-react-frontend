import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Plus, FileText, CheckCircle, XCircle, Send, Trash2, ChevronLeft, MoreVertical } from 'lucide-react';
import { apiService, QuotationListItem } from '../../services/api';
import { generatePdfBlob } from './hooks/usePdfExport';
import type { QuotationData } from './types/quotation';
import QuotationWizard from './QuotationWizard';
import PageHeader from '../../shared/layout/PageHeader';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileQuotationPage from '../mobile/staff/MobileQuotationPage';
import PipelineFlow from './components/PipelineFlow';
import ActionStats from './components/ActionStats';
import { Pagination } from './components/Pagination';
import { daysSince } from './utils/pipelineStats';
import './quotation.css';

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`sq-status-pill sq-status-pill--${status}`}>
      <span className="sq-status-pill__dot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="sq-history-td"><div className="sq-skeleton-cell" /></td>
      ))}
    </tr>
  );
}

function ConfirmDeleteModal({ quote, onConfirm, onCancel }: {
  quote: QuotationListItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sq-modal-backdrop" onClick={onCancel}>
      <div className="sq-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sq-modal-title">Delete Quotation</h3>
        <p className="sq-modal-body">
          Are you sure you want to delete <strong>{quote.quote_number}</strong> for{' '}
          <strong>{quote.customer_name}</strong>? This cannot be undone.
        </p>
        <div className="sq-modal-actions">
          <button className="sq-btn sq-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="sq-btn sq-btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}


function RowActionsMenu({ item, onStatusChange, onDelete }: {
  item: QuotationListItem;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (item: QuotationListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number | string; bottom?: number; right: number }>({ top: 0, right: 0 });
  const [menuReady, setMenuReady] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [sharing, setSharing] = useState<'wa' | 'email' | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const readyAtRef = useRef(0);

  // Gated on menuReady (not just open) — attaching the outside-click/scroll listeners
  // before the position-correction pass below has committed meant a layout-caused
  // scroll during that very first render could self-close the menu before it ever
  // became visible.
  //
  // That alone wasn't the whole story for the *last* row specifically: a button near
  // the bottom of the viewport is exactly the case where the browser's own focus
  // handling scrolls the page a few pixels to bring the just-clicked button fully
  // into view — a native scroll, not a user dismissal, but our capture-phase scroll
  // listener can't tell the difference. Ignoring scrolls in the brief window right
  // after opening filters out that native adjustment while still closing on a real
  // user scroll afterward.
  useEffect(() => {
    if (!open || !menuReady) return;
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onScroll() {
      if (Date.now() - readyAtRef.current < 250) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, menuReady]);

  // The menu's height varies by row (draft/sent rows show different status actions),
  // so its position can't be computed correctly until it's actually rendered. First
  // paint places it below the button as a guess (hidden); this measures the real
  // height and flips it above the button instead if it would run off the viewport
  // bottom — that overflow was reading as the menu "escaping" the card.
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !btnRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const right = window.innerWidth - btnRect.right;
    if (spaceBelow < menuHeight + 12 && btnRect.top > spaceBelow) {
      setMenuPos({ top: 'auto', bottom: window.innerHeight - btnRect.top + 4, right });
    } else {
      setMenuPos({ top: btnRect.bottom + 4, right });
    }
    setMenuReady(true);
    readyAtRef.current = Date.now();
  }, [open]);

  function openMenu() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuReady(false);
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(v => !v);
  }

  const phoneClean = (item.customer_phone ?? '').replace(/\D/g, '');

  async function sharePdf(channel: 'wa' | 'email') {
    setOpen(false);
    setSharing(channel);
    const toastId = toast.loading('Generating PDF…');
    try {
      const detail = await apiService.getQuotation(item.public_id);
      const data = detail.form_data as unknown as QuotationData;
      const { blob, filename } = await generatePdfBlob(data);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Solar Proposal — ${item.quote_number}` });
        toast.success('PDF shared!', { id: toastId });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        if (channel === 'wa' && phoneClean) {
          const msg = encodeURIComponent(`Hi, please find your solar proposal (${item.quote_number}) attached.`);
          window.open(`https://wa.me/${phoneClean}?text=${msg}`, '_blank');
        } else if (channel === 'email') {
          const customerEmail = (data.customer as any).email ?? '';
          const subject = encodeURIComponent(`Solar Proposal — ${item.quote_number}`);
          const body = encodeURIComponent(`Dear Customer,\n\nPlease find your solar proposal (${item.quote_number}) attached.\n\nRegards,\n360Watts Energy Solutions`);
          window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
        }
        toast.success('PDF downloaded — attach it to your message.', { id: toastId });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Share failed. Please try again.', { id: toastId });
      else toast.dismiss(toastId);
    } finally {
      setSharing(null);
    }
  }

  async function action(type: string) {
    setActioning(type);
    setOpen(false);
    try {
      if (type === 'sent') await apiService.sendQuotation(item.public_id, { delivery_method: 'manual' });
      if (type === 'accepted') await apiService.acceptQuotation(item.public_id, {});
      if (type === 'rejected') await apiService.rejectQuotation(item.public_id, { reason: 'Rejected' });
      onStatusChange(item.public_id, type);
    } catch { /* ignore */ }
    finally { setActioning(null); }
  }

  return (
    <div className="sq-row-actions">
      {/* Inline primary action — colour matches the badge it produces */}
      {item.status === 'draft' && (
        <button
          className="sq-inline-action sq-inline-action--send"
          onClick={() => action('sent')}
          disabled={!!actioning}
          title="Mark as Sent"
        >
          {actioning === 'sent'
            ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
            : <Send style={{ width: 10, height: 10 }} />}
          {actioning === 'sent' ? 'Marking…' : 'Mark Sent'}
        </button>
      )}
      {item.status === 'sent' && (
        <button
          className="sq-inline-action sq-inline-action--accept"
          onClick={() => action('accepted')}
          disabled={!!actioning}
          title="Mark as Accepted"
        >
          {actioning === 'accepted'
            ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
            : <CheckCircle style={{ width: 10, height: 10 }} />}
          {actioning === 'accepted' ? 'Accepting…' : 'Accept'}
        </button>
      )}

      {/* ⋮ trigger — only spins for reject/share which stay in the menu */}
      <button
        ref={btnRef}
        className="sq-row-menu-trigger"
        title="More actions"
        onClick={openMenu}
        disabled={actioning === 'rejected' || !!sharing}
      >
        {(actioning === 'rejected' || sharing)
          ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          : <MoreVertical style={{ width: 13, height: 13 }} />}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="sq-row-menu"
          style={{ position: 'fixed', ...menuPos, zIndex: 9999, visibility: menuReady ? 'visible' : 'hidden' }}
        >
          {/* Status actions for sent items */}
          {item.status === 'sent' && (
            <>
              <button className="sq-row-menu-item sq-row-menu-accept" onClick={() => action('accepted')}>
                <CheckCircle style={{ width: 12, height: 12 }} /> Mark as Accepted
              </button>
              <button className="sq-row-menu-item sq-row-menu-reject" onClick={() => action('rejected')}>
                <XCircle style={{ width: 12, height: 12 }} /> Mark as Rejected
              </button>
              <div className="sq-row-menu-divider" />
            </>
          )}
          {/* Share PDF */}
          <span className="sq-row-menu-section">Share PDF</span>
          <button className="sq-row-menu-item" onClick={() => sharePdf('wa')} disabled={!!sharing || !phoneClean} title={!phoneClean ? 'No phone number on this quote' : undefined}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={phoneClean ? '#25D366' : 'currentColor'} style={!phoneClean ? { opacity: 0.4 } : undefined}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp{!phoneClean && ' (no number)'}
          </button>
          <button className="sq-row-menu-item" onClick={() => sharePdf('email')} disabled={!!sharing}>
            <svg width="13" height="10" viewBox="52 42 88 66"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>
            Email
          </button>
          <div className="sq-row-menu-divider" />
          <button className="sq-row-menu-item sq-row-menu-danger" onClick={() => { setOpen(false); onDelete(item); }}>
            <Trash2 style={{ width: 12, height: 12 }} /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function Loader2({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return <svg style={style} className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
}

export default function QuotationPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileQuotationPage />;
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [editId, setEditId] = useState<string | null>(null);

  // List state
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  // Backend aggregate across every status matching the current search (not narrowed by
  // the status filter, not paginated) — replaces the old items.filter(...) approach,
  // which only ever reflected whatever 15 rows happened to be on the current page.
  const [stats, setStats] = useState<Record<string, { count: number; value: number }>>({});
  const stage = (key: string) => stats[key] ?? { count: 0, value: 0 };
  const pipelineTotalCount = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
  const pipelineTotalValue = Object.values(stats).reduce((sum, s) => sum + s.value, 0);
  const lostCount = stage('rejected').count + stage('expired').count;

  function selectPipelineStage(stage: 'draft' | 'sent' | 'accepted') {
    setStatus(status === stage ? 'all' : stage);
  }

  const fetchPage = useCallback(async (p: number, q: string, s: StatusFilter) => {
    const reqId = ++requestIdRef.current;
    setError(null);
    setLoading(true);
    try {
      const params: Parameters<typeof apiService.listQuotations>[0] = { page: p };
      if (q) params.search = q;
      if (s !== 'all') params.status = s;
      const data = await apiService.listQuotations(params);
      if (reqId !== requestIdRef.current) return;
      setItems(data.results);
      setPage(data.page);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setStats(data.stats ?? {});
    } catch {
      if (reqId !== requestIdRef.current) return;
      setError('Failed to load quotations. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== 'list') return;
    setPage(1);
    fetchPage(1, search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, view]);

  useEffect(() => {
    if (view !== 'list') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(1, search, status);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openNew() { setEditId(null); setView('wizard'); }
  function openEdit(id: string) { setEditId(id); setView('wizard'); }
  function backToList() { setView('list'); }

  function handleStatusChange(id: string, newStatus: string) {
    setItems(prev => prev.map(i => i.public_id === id ? { ...i, status: newStatus as QuotationListItem['status'] } : i));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiService.deleteQuotation(deleteTarget.public_id);
      setDeleteTarget(null);
      fetchPage(page, search, status);
    } catch {
      setError('Failed to delete quotation.');
    } finally {
      setDeleting(false);
    }
  }

  if (view === 'wizard') {
    return (
      <div className="admin-container responsive-page sq-root">
        <PageHeader
          icon={<FileText size={20} color="white" />}
          title={editId ? 'Edit Solar Proposal' : 'New Solar Proposal'}
          subtitle="Proposal generator for customer quotation workflows"
          rightSlot={(
            <button type="button" className="btn btn-secondary" onClick={backToList}>
              <ChevronLeft style={{ width: 14, height: 14, marginRight: 6 }} />
              All Quotations
            </button>
          )}
        />
        <div className="sq-page-inner sq-page-inner--embedded">
          <QuotationWizard publicId={editId} onSaved={backToList} />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container responsive-page sq-root">
      <div className="sq-history-page">
        <PageHeader
          icon={<FileText size={20} color="white" />}
          title="Solar Quotations"
          subtitle="Create, share, and manage customer solar proposals"
          rightSlot={(
            <button type="button" className="btn" onClick={openNew}>
            <Plus style={{ width: 14, height: 14 }} />
            New Quotation
          </button>
          )}
        />

        <PipelineFlow
          draft={stage('draft')}
          sent={stage('sent')}
          accepted={stage('accepted')}
          total={{ count: pipelineTotalCount, value: pipelineTotalValue }}
          lostCount={lostCount}
          loading={loading}
          activeStage={status === 'draft' || status === 'sent' || status === 'accepted' ? status : null}
          onSelectStage={selectPipelineStage}
        />

        {!loading && <ActionStats items={items} />}

        <div className="card sq-history-card">
          <div className="sq-history-toolbar">
            <div className="sq-history-toolbar__top">
              <div className="sq-history-toolbar__copy">
                <h2>Quotations{!loading && total > 0 ? ` (${total})` : ''}</h2>
              </div>
              <input
                type="text"
                className="search-input sq-history-search"
                placeholder="Search by customer or quote #..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="sq-filter-pills">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`sq-filter-pill${status === s ? ' active' : ''}`}
                  onClick={() => { setStatus(s as StatusFilter); setPage(1); }}
                >
                  {s !== 'all' && <span className={`sq-filter-pill__dot sq-filter-pill__dot--${s}`} />}
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="sq-history-table-wrap">
          <table className="sq-history-table">
            <thead>
              <tr>
                <th className="sq-history-th">Quote #</th>
                <th className="sq-history-th">Customer</th>
                <th className="sq-history-th">System</th>
                <th className="sq-history-th">Amount</th>
                <th className="sq-history-th">Status</th>
                <th className="sq-history-th">Updated</th>
                <th className="sq-history-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>{error}</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="sq-history-empty">
                    <div>
                      <FileText style={{ width: 36, height: 36, color: 'var(--fg-muted)', margin: '0 auto 12px' }} />
                      {search || status !== 'all' ? (
                        <>
                          <p>No quotes match your filters.</p>
                          <button
                            type="button"
                            className="sq-btn sq-btn-secondary"
                            onClick={() => { setSearch(''); setStatus('all'); setPage(1); }}
                            style={{ marginTop: 12 }}
                          >
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          <p>No quotations yet.</p>
                          <button type="button" className="sq-btn sq-btn-primary" onClick={openNew} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Plus style={{ width: 14, height: 14 }} /> New Quotation
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const isUrgent = item.status === 'sent' && daysSince(item.updated_at) >= 3;
                  return (
                  <tr key={item.id} className={`sq-history-row${isUrgent ? ' is-urgent' : ''}`}>
                    <td className="sq-history-td">
                      <button
                        type="button"
                        className="sq-history-quote-link"
                        onClick={() => openEdit(item.public_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {item.quote_number}
                      </button>
                    </td>
                    <td className="sq-history-td">
                      <span className="sq-history-customer-name">{item.customer_name}</span>
                      <span className="sq-history-customer-phone">{item.customer_phone}</span>
                    </td>
                    <td className="sq-history-td">
                      <span className="sq-history-kw">{item.system_kw} kW</span>
                      <span className="sq-history-system-badge">{item.system_type}</span>
                    </td>
                    <td className="sq-history-td sq-history-amount">
                      {INR.format(Number(item.net_investment))}
                    </td>
                    <td className="sq-history-td">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="sq-history-td">
                      {new Date(item.updated_at ?? item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="sq-history-td">
                      <RowActionsMenu
                        item={item}
                        onStatusChange={handleStatusChange}
                        onDelete={setDeleteTarget}
                      />
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
          </div>

          {!loading && !error && (
            <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); fetchPage(p, search, status); }} />
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          quote={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
