import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import {
  apiService, SupportInquiryCategory, SupportInquiryDetail, SupportInquiryListItem, SupportInquirySeverity, SupportInquiryStatus,
} from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { getDesignTokens } from '../../shared/theme';
import { EmptyState } from '../../shared/components/EmptyState';
import { SkeletonTableRow } from '../../shared/components/SkeletonLoader';
import { StatusPill as StatusPillBase } from '../../shared/components/StatusPill';
import PageHeader from '../../shared/layout/PageHeader';

const STATUS_CONFIG: Record<SupportInquiryStatus, { color: string; bg: string; label: string }> = {
  ai_handling: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', label: 'AI Handling' },
  open:        { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Open' },
  in_progress: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'In Progress' },
  resolved:    { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Resolved' },
  closed:      { color: 'var(--muted-foreground)', bg: 'color-mix(in srgb, var(--muted-foreground) 12%, transparent)', label: 'Closed' },
};

const CATEGORY_LABELS: Record<SupportInquiryCategory, string> = {
  account: 'Account',
  billing: 'Billing',
  app: 'App / Portal',
  other: 'Other',
};

const SEVERITY_CONFIG: Record<SupportInquirySeverity, { color: string; bg: string; label: string }> = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Warning' },
  info:     { color: 'var(--muted-foreground)', bg: 'color-mix(in srgb, var(--muted-foreground) 12%, transparent)', label: 'Info' },
};

// Escalation only — de-escalating is rare enough that it's not worth a
// dedicated control; staff can still do it via the same endpoint if needed,
// just not surfaced as a one-click button here.
const SEVERITY_ESCALATIONS: Record<SupportInquirySeverity, SupportInquirySeverity[]> = {
  info: ['warning', 'critical'],
  warning: ['critical'],
  critical: [],
};

const STATUS_FILTERS: Array<SupportInquiryStatus | 'all'> = ['all', 'ai_handling', 'open', 'in_progress', 'resolved', 'closed'];

// Next status a staff member can move an inquiry to, in the order the
// lifecycle actually progresses — no point offering "reopen" from this menu
// since that only happens implicitly (customer replies to a resolved/closed
// inquiry, handled server-side). ai_handling is AI-owned (turns to `open`
// automatically once the AI escalates or its turn cap is hit), but staff can
// still jump in early.
const NEXT_STATUS_OPTIONS: Record<SupportInquiryStatus, SupportInquiryStatus[]> = {
  ai_handling: ['open', 'closed'],
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

function StatusPill({ status }: { status: SupportInquiryStatus }) {
  // Defense-in-depth: fall back rather than crash the page if the backend
  // ever serializes a status value this map doesn't know about yet — this is
  // exactly how the ai_handling gap crashed the page before it was added here.
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return <StatusPillBase cfg={cfg} />;
}

function SeverityPill({ severity }: { severity: SupportInquirySeverity }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function InquiryDetailModal({
  inquiryId, onClose, onChanged,
}: {
  inquiryId: number;
  onClose: () => void;
  onChanged: (updated: SupportInquiryListItem) => void;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const [detail, setDetail] = useState<SupportInquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getSupportInquiry(inquiryId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setError('Failed to load this inquiry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inquiryId]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const message = replyText.trim();
    if (!message) return;
    setSending(true);
    setError(null);
    try {
      const updated = await apiService.replySupportInquiry(inquiryId, message);
      setDetail(updated);
      setReplyText('');
      onChanged({
        id: updated.id, category: updated.category, message: updated.message, status: updated.status,
        severity: updated.severity, slaDueAt: updated.slaDueAt, slaBreached: updated.slaBreached,
        createdAt: updated.createdAt, updatedAt: updated.updatedAt, replyCount: updated.replies.length,
        customerName: updated.customerName, customerEmail: updated.customerEmail,
      });
    } catch {
      setError('Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleSetStatus(next: SupportInquiryStatus) {
    try {
      const updated = await apiService.setSupportInquiryStatus(inquiryId, next);
      setDetail(prev => (prev ? { ...prev, status: updated.status } : prev));
      onChanged(updated);
    } catch {
      setError('Failed to update status. Please try again.');
    }
  }

  async function handleSetSeverity(next: SupportInquirySeverity) {
    try {
      const updated = await apiService.setSupportInquirySeverity(inquiryId, next);
      setDetail(prev => (prev ? { ...prev, severity: updated.severity, slaDueAt: updated.slaDueAt, slaBreached: updated.slaBreached } : prev));
      onChanged(updated);
    } catch {
      setError('Failed to update severity. Please try again.');
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: 16, background: t.surfaceRaised, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>
              {detail ? CATEGORY_LABELS[detail.category] : 'Loading…'}
            </h3>
            {detail && <p style={{ margin: '2px 0 0', fontSize: 12, color: t.textDim }}>{detail.customerName} · {detail.customerEmail}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && <p style={{ fontSize: 13, color: t.textMuted }}>Loading conversation…</p>}
          {!loading && detail && (
            <>
              {detail.slaBreached && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 14,
                  fontSize: 12, fontWeight: 600, color: '#EF4444',
                }}>
                  <AlertTriangle size={14} /> First-response SLA breached — no staff reply yet
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <SeverityPill severity={detail.severity} />
                {SEVERITY_ESCALATIONS[detail.severity].map(next => (
                  <button
                    key={next}
                    onClick={() => handleSetSeverity(next)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${t.border}`, background: t.surface, color: t.textMuted,
                    }}
                  >
                    Escalate to {SEVERITY_CONFIG[next].label}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: t.textDim }}>{detail.customerName || 'Customer'}</p>
                <p style={{ fontSize: 13, color: t.text, marginTop: 2 }}>{detail.message}</p>
                <p style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{formatTimestamp(detail.createdAt)}</p>
              </div>
              {detail.replies.map(r => (
                <div key={r.id} style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: r.isStaffReply ? t.primary : t.textDim }}>
                    {r.isStaffReply ? 'You (Support)' : (r.authorName || 'Customer')}
                  </p>
                  <p style={{ fontSize: 13, color: t.text, marginTop: 2 }}>{r.message}</p>
                  <p style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{formatTimestamp(r.createdAt)}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {detail && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusPill status={detail.status} />
              {(NEXT_STATUS_OPTIONS[detail.status] ?? NEXT_STATUS_OPTIONS.open).map(next => (
                <button
                  key={next}
                  onClick={() => handleSetStatus(next)}
                  style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${t.border}`, background: t.surface, color: t.textMuted,
                  }}
                >
                  Mark {STATUS_CONFIG[next].label}
                </button>
              ))}
            </div>
            {error && <p style={{ fontSize: 12, color: t.danger, marginBottom: 8 }}>{error}</p>}
            <form onSubmit={handleReply} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Reply to customer…"
                rows={2}
                style={{
                  flex: 1, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text,
                  padding: '8px 10px', fontSize: 13, resize: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${t.primary}`, background: t.primarySoft, color: t.primary, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, opacity: sending || !replyText.trim() ? 0.5 : 1,
                }}
              >
                <Send size={13} /> Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupportInbox() {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);

  const [inquiries, setInquiries] = useState<SupportInquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SupportInquiryStatus | 'all'>('all');
  const [openInquiryId, setOpenInquiryId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiService.getSupportInquiries(statusFilter === 'all' ? undefined : { status: statusFilter });
      setInquiries(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    inquiries.forEach(i => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [inquiries]);

  function handleChanged(updated: SupportInquiryListItem) {
    setInquiries(prev => prev.map(i => (i.id === updated.id ? updated : i)));
  }

  return (
    <div>
      <PageHeader
        icon={<MessageCircle size={22} />}
        title="Support Inbox"
        subtitle="Customer Help & Support inquiries from the portal"
        rightSlot={
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${t.border}`, background: t.surface, color: t.text, cursor: 'pointer', fontSize: 13,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${statusFilter === s ? t.primary : t.border}`,
              background: statusFilter === s ? t.primarySoft : t.surface,
              color: statusFilter === s ? t.primary : t.textMuted,
            }}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            {s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div style={{ borderRadius: 14, border: `1px solid ${t.border}`, background: t.surface, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 12, color: t.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <th style={{ padding: '12px 16px' }}>Customer</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Message</th>
              <th style={{ padding: '12px 16px' }}>Severity</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Replies</th>
              <th style={{ padding: '12px 16px' }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} columns={7} />)}
            {!loading && inquiries.map(inq => (
              <tr
                key={inq.id}
                onClick={() => setOpenInquiryId(inq.id)}
                style={{ borderTop: `1px solid ${t.border}`, fontSize: 13, color: t.text, cursor: 'pointer' }}
              >
                <td style={{ padding: '12px 16px' }}>{inq.customerName || '—'}</td>
                <td style={{ padding: '12px 16px' }}>{CATEGORY_LABELS[inq.category] ?? inq.category}</td>
                <td style={{ padding: '12px 16px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inq.message}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SeverityPill severity={inq.severity} />
                    {inq.slaBreached && <AlertTriangle size={14} color="#EF4444" />}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}><StatusPill status={inq.status} /></td>
                <td style={{ padding: '12px 16px' }}>{inq.replyCount || '—'}</td>
                <td style={{ padding: '12px 16px', color: t.textMuted }}>{formatTimestamp(inq.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && inquiries.length === 0 && (
          <EmptyState icon={<MessageCircle size={32} strokeWidth={1.5} />} title="No support inquiries" description="Customer Help & Support messages will show up here." />
        )}
      </div>

      {openInquiryId != null && (
        <InquiryDetailModal
          inquiryId={openInquiryId}
          onClose={() => setOpenInquiryId(null)}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}
