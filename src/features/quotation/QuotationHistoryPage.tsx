import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
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

export default function QuotationHistoryPage() {
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  const statusRef = useRef(status);
  const requestIdRef = useRef(0);
  searchRef.current = search;
  statusRef.current = status;

  const fetchQuotations = useCallback(async (opts: {
    search: string;
    status: StatusFilter;
    cursor?: string;
    append?: boolean;
  }) => {
    const reqId = ++requestIdRef.current;
    setError(null);
    if (opts.append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params: Record<string, string> = {};
      if (opts.search) params.search = opts.search;
      if (opts.status !== 'all') params.status = opts.status;
      if (opts.cursor) params.cursor = opts.cursor;

      const data = await apiService.listQuotations(params as Parameters<typeof apiService.listQuotations>[0]);
      if (reqId !== requestIdRef.current) return;
      if (opts.append) {
        setItems(prev => [...prev, ...data.results]);
      } else {
        setItems(data.results);
      }
      setNextCursor(data.next_cursor);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setError('Failed to load quotations. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    fetchQuotations({ search, status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchQuotations({ search: searchRef.current, status: statusRef.current });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleLoadMore = () => {
    if (nextCursor) {
      fetchQuotations({ search, status, cursor: nextCursor, append: true });
    }
  };

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
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
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
                      <p>No quotations yet. Create your first quote.</p>
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
                      {/* Quote # */}
                      <td className="sq-history-td">
                        <Link to={`/quotation/${item.public_id}`} className="sq-history-quote-link">
                          {item.quote_number}
                        </Link>
                      </td>
                      {/* Customer */}
                      <td className="sq-history-td">
                        <span className="sq-history-customer-name">{item.customer_name}</span>
                        <span className="sq-history-customer-phone">{item.customer_phone}</span>
                      </td>
                      {/* System */}
                      <td className="sq-history-td">
                        <span className="sq-history-kw">{item.system_kw} kW</span>
                        <span className="sq-history-system-badge">{item.system_type}</span>
                      </td>
                      {/* Amount */}
                      <td className="sq-history-td sq-history-amount">
                        {INR.format(Number(item.net_investment))}
                      </td>
                      {/* Status */}
                      <td className="sq-history-td">
                        <StatusBadge status={item.status} />
                      </td>
                      {/* Valid Until */}
                      <td className="sq-history-td">
                        <span className={validUntil.past ? 'sq-history-date-past' : ''}>
                          {validUntil.text}
                        </span>
                      </td>
                      {/* PDF */}
                      <td className="sq-history-td">
                        <span className="sq-history-pdf-status" title={item.pdf_status}>
                          {item.pdf_status === 'ready' ? '📄' : item.pdf_status === 'pending' ? '⏳' : '—'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="sq-history-td">
                        <Link to={`/quotation/${item.public_id}`} className="sq-history-action-link">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {nextCursor && !loading && (
          <div className="sq-history-load-more">
            <button
              className="sq-btn sq-btn-ghost"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
