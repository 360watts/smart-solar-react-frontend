import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import './quotation.css';
import { apiService, QuotationListItem } from '../../services/api';

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string): { text: string; past: boolean } {
  const d = new Date(dateStr);
  const text = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const past = d < new Date();
  return { text, past };
}

function StatusBadge({ status }: { status: QuotationListItem['status'] }) {
  return (
    <span className="sq-status-badge" data-status={status}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="sq-history-td">
          <div className="sq-skeleton-cell" />
        </td>
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="sq-pagination">
      <button
        className="sq-page-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="sq-page-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`sq-page-btn ${page === p ? 'active' : ''}`}
            onClick={() => onChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="sq-page-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

export default function QuotationHistoryPage() {
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
    } catch {
      if (reqId !== requestIdRef.current) return;
      setError('Failed to load quotations. Please try again.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Filter/status change resets to page 1
  useEffect(() => {
    setPage(1);
    fetchPage(1, search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Debounced search resets to page 1
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(1, search, status);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchPage(p, search, status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  return (
    <div className="sq-root sq-page">
      <div className="sq-history-page">
        {/* Header */}
        <div className="sq-history-header">
          <div>
            <p className="sq-header-eyebrow">360Watts CRM</p>
            <h1 className="sq-header-title">Quotation <em>History</em></h1>
          </div>
          <Link to="/quotation" className="sq-btn sq-btn-primary">
            + New Quotation
          </Link>
        </div>

        {/* Filters */}
        <div className="sq-history-filters">
          <input
            type="text"
            className="sq-input sq-history-search"
            placeholder="Search by customer or quote #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="sq-select"
            value={status}
            onChange={e => setStatus(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          {!loading && total > 0 && (
            <span className="sq-history-count">{total} quote{total !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Table */}
        <div className="sq-history-table-wrap">
          <table className="sq-history-table">
            <thead>
              <tr>
                <th className="sq-history-th">Quote #</th>
                <th className="sq-history-th">Customer</th>
                <th className="sq-history-th">System</th>
                <th className="sq-history-th">Amount</th>
                <th className="sq-history-th">Status</th>
                <th className="sq-history-th">Valid Until</th>
                <th className="sq-history-th">PDF</th>
                <th className="sq-history-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="sq-history-empty">
                    <div>
                      <p>No quotations found.</p>
                      <Link to="/quotation" className="sq-btn sq-btn-primary" style={{ marginTop: 12, display: 'inline-block' }}>
                        + New Quotation
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const validUntil = formatDate(item.valid_until);
                  return (
                    <tr key={item.id} className="sq-history-row">
                      <td className="sq-history-td">
                        <Link to={`/quotation/${item.public_id}`} className="sq-history-quote-link">
                          {item.quote_number}
                        </Link>
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
                        <span className={validUntil.past ? 'sq-history-date-past' : ''}>
                          {validUntil.text}
                        </span>
                      </td>
                      <td className="sq-history-td">
                        <span className="sq-history-pdf-status" title={item.pdf_status}>
                          {item.pdf_status === 'ready' ? '📄' : item.pdf_status === 'pending' ? '⏳' : '—'}
                        </span>
                      </td>
                      <td className="sq-history-td">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Link to={`/quotation/${item.public_id}`} className="sq-history-action-link">
                            View
                          </Link>
                          <button
                            className="sq-history-delete-btn"
                            title="Delete quotation"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && (
          <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
        )}
      </div>

      {/* Delete confirmation modal */}
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
