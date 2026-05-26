import { useEffect, useState } from 'react';
import { Plus, FileText, Clock, CheckCircle, XCircle, Send, Archive, ChevronRight, RotateCcw } from 'lucide-react';
import { apiService } from '../../services/api';
import { formatINR } from './utils/roiCalculator';
import QuotationWizard from './QuotationWizard';
import './quotation.css';

interface QuotationSummary {
  public_id: string;
  quote_number: string;
  revision_number: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  system_type: string;
  system_kw: string;
  net_investment: string;
  currency: string;
  valid_until: string;
  pdf_status: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft:    { label: 'Draft',    icon: Clock,        color: 'var(--fg-muted, #64748b)' },
  sent:     { label: 'Sent',     icon: Send,         color: 'var(--blue, #3b82f6)' },
  accepted: { label: 'Accepted', icon: CheckCircle,  color: 'var(--green, #00a63e)' },
  rejected: { label: 'Rejected', icon: XCircle,      color: 'var(--red, #ef4444)' },
  revised:  { label: 'Revised',  icon: RotateCcw,    color: 'var(--amber, #f59e0b)' },
  archived: { label: 'Archived', icon: Archive,      color: 'var(--fg-muted, #64748b)' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: meta.color,
    }}>
      <Icon style={{ width: 10, height: 10 }} />
      {meta.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function QuotationPage() {
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  function loadQuotes(cursor?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    apiService.request_(`/v1/quotations/${params.toString() ? '?' + params : ''}`)
      .then((res: { results: QuotationSummary[]; next_cursor: string | null }) => {
        setQuotes(prev => cursor ? [...prev, ...res.results] : res.results);
        setNextCursor(res.next_cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadQuotes(); }, []);

  function openNew() { setEditId(null); setView('wizard'); }
  function openEdit(id: string) { setEditId(id); setView('wizard'); }
  function backToList() { setView('list'); loadQuotes(); }

  if (view === 'wizard') {
    return (
      <div className="sq-root sq-page">
        <div className="sq-page-inner">
          <header className="sq-header">
            <div className="sq-header-left">
              <button
                type="button"
                onClick={backToList}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.75rem', padding: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ← All Quotations
              </button>
              <h1 className="sq-header-title">{editId ? 'Edit' : 'New'} <em>Solar</em> Proposal</h1>
            </div>
            <span className="sq-header-badge">Proposal Generator v2</span>
          </header>
          <QuotationWizard publicId={editId} onSaved={backToList} />
        </div>
      </div>
    );
  }

  return (
    <div className="sq-root sq-page">
      <div className="sq-page-inner">

        <header className="sq-header">
          <div className="sq-header-left">
            <p className="sq-header-eyebrow">360Watts CRM</p>
            <h1 className="sq-header-title">Solar <em>Quotations</em></h1>
          </div>
          <button type="button" className="sq-btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} />
            New Quotation
          </button>
        </header>

        {loading && quotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-muted)' }}>Loading…</div>
        ) : quotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <FileText style={{ width: 40, height: 40, color: 'var(--fg-muted)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No quotations yet</p>
            <button type="button" className="sq-btn-primary" onClick={openNew} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 14, height: 14 }} /> Create your first quotation
            </button>
          </div>
        ) : (
          <>
            <div className="sq-quote-list">
              {quotes.map(q => (
                <button
                  key={q.public_id}
                  type="button"
                  className="sq-quote-row"
                  onClick={() => openEdit(q.public_id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{q.quote_number}</span>
                      <StatusBadge status={q.status} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.customer_name || '—'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                      {q.system_kw} kWp · {q.system_type.replace('_', '-').toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--fg)' }}>
                      {Number(q.net_investment) > 0 ? formatINR(Number(q.net_investment)) : '—'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{formatDate(q.updated_at)}</span>
                    {q.created_by_name && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', opacity: 0.7 }}>{q.created_by_name}</span>
                    )}
                  </div>

                  <ChevronRight style={{ width: 14, height: 14, color: 'var(--fg-muted)', flexShrink: 0 }} />
                </button>
              ))}
            </div>

            {nextCursor && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="sq-btn-secondary"
                  onClick={() => loadQuotes(nextCursor)}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
