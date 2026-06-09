import { useEffect, useRef, useState } from 'react';
import { Plus, FileText, Search, MoreVertical, ChevronLeft, Send, CheckCircle, XCircle, Trash2, Menu } from 'lucide-react';
import { apiService, QuotationListItem } from '../../services/api';
import QuotationWizard from '../quotation/QuotationWizard';
import finalLogo from '../../assets/finalLogo.png';
import { useTheme } from '../../contexts/ThemeContext';

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { color: string; bg: string }> = {
    draft: { color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
    sent: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    accepted: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    expired: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  };
  const p = palette[status] ?? palette.draft;
  return <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 700, color: p.color, background: p.bg }}>{status}</span>;
}

export default function MobileQuotationPage() {
  const { isDark } = useTheme();
  const bg = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent = '#2FBF71';

  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationListItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  async function fetchPage(p: number, q: string, s: StatusFilter) {
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
      if (reqId === requestIdRef.current) setError('Failed to load quotations.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (view !== 'list') return;
    setPage(1);
    fetchPage(1, search, status);
  }, [status, view]);

  useEffect(() => {
    if (view !== 'list') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(1, search, status);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, view]);

  async function updateStatus(item: QuotationListItem, next: 'sent' | 'accepted' | 'rejected') {
    try {
      if (next === 'sent') await apiService.sendQuotation(item.public_id, { delivery_method: 'manual' });
      if (next === 'accepted') await apiService.acceptQuotation(item.public_id, {});
      if (next === 'rejected') await apiService.rejectQuotation(item.public_id, { reason: 'Rejected' });
      setItems(prev => prev.map(q => q.public_id === item.public_id ? { ...q, status: next } : q));
    } finally {
      setOpenMenu(null);
    }
  }

  async function deleteQuotation() {
    if (!deleteTarget) return;
    await apiService.deleteQuotation(deleteTarget.public_id);
    setDeleteTarget(null);
    fetchPage(page, search, status);
  }

  if (view === 'wizard') {
    return (
      <div style={{ background: bg, minHeight: '100dvh', padding: '12px 12px 88px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setView('list')} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${border}`, background: surface, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: muted }}>Quotation</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text }}>{editId ? 'Edit proposal' : 'New proposal'}</div>
          </div>
        </div>
        <QuotationWizard publicId={editId} onSaved={() => setView('list')} />
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 88 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`, padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)', border: '1px solid rgba(47,191,113,0.18)', boxShadow: '0 2px 8px rgba(47,191,113,0.2)' }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: text }}>360Watts</span>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))} style={{ background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: '1px solid rgba(47,191,113,0.22)', borderRadius: 9, color: accent, padding: 6, display: 'flex' }}>
            <Menu size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Quotations</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: text, marginTop: 2 }}>{total} proposals</div>
          </div>
          <button onClick={() => { setEditId(null); setView('wizard'); }} style={{ background: accent, border: 'none', borderRadius: 10, color: '#fff', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 700 }}>
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or quote #" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 36px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text, fontSize: '0.82rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {STATUS_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setStatus(opt)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap', background: status === opt ? `${accent}18` : surface, color: status === opt ? accent : muted, fontSize: '0.7rem', fontWeight: 700 }}>
              {opt === 'all' ? 'All' : opt}
            </button>
          ))}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{error}</div>}
        {loading ? <div style={{ color: muted, fontSize: '0.8rem', padding: '20px 4px' }}>Loading quotations...</div> : items.map(item => (
          <div key={item.public_id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 14, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(47,191,113,0.12)', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <button onClick={() => { setEditId(item.public_id); setView('wizard'); }} style={{ background: 'none', border: 'none', padding: 0, color: text, fontSize: '0.88rem', fontWeight: 700, textAlign: 'left' }}>{item.quote_number}</button>
                  <StatusPill status={item.status} />
                </div>
                <div style={{ fontSize: '0.8rem', color: text, fontWeight: 600 }}>{item.customer_name}</div>
                <div style={{ fontSize: '0.68rem', color: muted, marginTop: 2 }}>{item.customer_phone}</div>
              </div>
              <button onClick={() => setOpenMenu(openMenu === item.public_id ? null : item.public_id)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MoreVertical size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
              <div><div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase' }}>System</div><div style={{ fontSize: '0.76rem', color: text, fontWeight: 700 }}>{item.system_kw} kW</div></div>
              <div><div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase' }}>Type</div><div style={{ fontSize: '0.76rem', color: text, fontWeight: 700 }}>{item.system_type}</div></div>
              <div><div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase' }}>Amount</div><div style={{ fontSize: '0.76rem', color: accent, fontWeight: 700 }}>{INR.format(Number(item.net_investment))}</div></div>
            </div>
            <div style={{ fontSize: '0.64rem', color: muted, marginTop: 10 }}>
              Updated {new Date(item.updated_at ?? item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            {openMenu === item.public_id && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                <button onClick={() => { setEditId(item.public_id); setView('wizard'); }} style={{ padding: '10px', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: text }}>Edit</button>
                {item.status === 'draft' && <button onClick={() => updateStatus(item, 'sent')} style={{ padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Send size={12} />Mark Sent</button>}
                {item.status === 'sent' && <button onClick={() => updateStatus(item, 'accepted')} style={{ padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(22,163,74,0.12)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle size={12} />Accept</button>}
                {item.status === 'sent' && <button onClick={() => updateStatus(item, 'rejected')} style={{ padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><XCircle size={12} />Reject</button>}
                <button onClick={() => setDeleteTarget(item)} style={{ padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Trash2 size={12} />Delete</button>
              </div>
            )}
          </div>
        ))}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 0' }}>
            <button disabled={page <= 1} onClick={() => fetchPage(page - 1, search, status)} style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${border}`, background: 'transparent', color: page <= 1 ? muted : accent }}>Prev</button>
            <span style={{ fontSize: '0.75rem', color: muted }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => fetchPage(page + 1, search, status)} style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${border}`, background: 'transparent', color: page >= totalPages ? muted : accent }}>Next</button>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', border: `1px solid ${border}`, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text, marginBottom: 8 }}>Delete quotation?</div>
            <div style={{ fontSize: '0.82rem', color: muted, lineHeight: 1.5, marginBottom: 16 }}>{deleteTarget.quote_number} for {deleteTarget.customer_name} will be permanently removed.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: text }}>Cancel</button>
              <button onClick={deleteQuotation} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
