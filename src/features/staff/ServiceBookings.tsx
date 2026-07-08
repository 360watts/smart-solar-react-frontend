import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, MapPin, Phone, Plus, RefreshCw, Search, X } from 'lucide-react';
import { apiService, BookingStatus, ServiceBooking, ServiceVendor } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { getDesignTokens } from '../../shared/theme';
import { EmptyState } from '../../shared/components/EmptyState';
import { SkeletonTableRow } from '../../shared/components/SkeletonLoader';
import PageHeader from '../../shared/layout/PageHeader';

const STATUS_CONFIG: Record<BookingStatus, { color: string; bg: string; label: string }> = {
  pending:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Pending' },
  scheduled: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Scheduled' },
  completed: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Completed' },
  closed:    { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'Closed' },
  cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Cancelled' },
};

const STATUS_FILTERS: Array<BookingStatus | 'all'> = ['all', 'pending', 'scheduled', 'completed', 'closed', 'cancelled'];

function StatusPill({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function VendorPicker({
  vendors, value, onChange, onVendorCreated,
}: {
  vendors: ServiceVendor[];
  value: number | null;
  onChange: (vendorId: number) => void;
  onVendorCreated: (vendor: ServiceVendor) => void;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newVendor, setNewVendor] = useState({ company_name: '', technician_name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const selected = vendors.find(v => v.id === value) ?? null;
  const filtered = vendors.filter(v =>
    !search.trim() ||
    v.company_name.toLowerCase().includes(search.toLowerCase()) ||
    v.technician_name.toLowerCase().includes(search.toLowerCase()),
  );

  async function saveNewVendor() {
    if (!newVendor.company_name || !newVendor.technician_name || !newVendor.phone) return;
    setSaving(true);
    try {
      const created = await apiService.createServiceVendor(newVendor);
      onVendorCreated(created);
      onChange(created.id);
      setShowNewForm(false);
      setShowDropdown(false);
      setNewVendor({ company_name: '', technician_name: '', phone: '', email: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <label style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>
        Vendor / Technician
      </label>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: t.textDim }} />
        <input
          type="text"
          placeholder={selected ? `${selected.technician_name} (${selected.company_name})` : 'Search vendors...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 30px', borderRadius: 8,
            border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 14,
          }}
        />
      </div>
      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
          background: t.surfaceRaised, border: `1px solid ${t.border}`, borderRadius: 10,
          maxHeight: 240, overflowY: 'auto', boxShadow: t.shadow,
        }}>
          {filtered.map(v => (
            <div
              key={v.id}
              onClick={() => { onChange(v.id); setShowDropdown(false); setSearch(''); }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: t.text,
                background: v.id === value ? t.primarySoft : 'transparent',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div style={{ fontWeight: 600 }}>{v.technician_name}</div>
              <div style={{ color: t.textMuted, fontSize: 12 }}>{v.company_name} · {v.phone}</div>
            </div>
          ))}
          {filtered.length === 0 && !showNewForm && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: t.textDim }}>No vendors match.</div>
          )}
          {!showNewForm ? (
            <div
              onClick={() => setShowNewForm(true)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: t.primary, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} /> Add new vendor
            </div>
          ) : (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['company_name', 'technician_name', 'phone', 'email'] as const).map(field => (
                <input
                  key={field}
                  placeholder={field.replace('_', ' ')}
                  value={newVendor[field]}
                  onChange={e => setNewVendor({ ...newVendor, [field]: e.target.value })}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.border}`,
                    background: t.surface, color: t.text, fontSize: 13,
                  }}
                />
              ))}
              <button
                onClick={saveNewVendor}
                disabled={saving}
                style={{
                  padding: '8px 10px', borderRadius: 6, border: 'none', background: t.primary,
                  color: t.textInverse, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save vendor'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignDialog({
  booking, vendors, onClose, onAssigned, onVendorCreated,
}: {
  booking: ServiceBooking;
  vendors: ServiceVendor[];
  onClose: () => void;
  onAssigned: (updated: ServiceBooking) => void;
  onVendorCreated: (vendor: ServiceVendor) => void;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [date, setDate] = useState(booking.preferred_date ?? '');
  const [time, setTime] = useState(booking.preferred_slot === 'afternoon' ? '13:00' : '09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!vendorId || !date || !time) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiService.assignVendor(booking.id, vendorId, date, `${time}:00`);
      onAssigned(updated);
      onClose();
    } catch {
      setError('Failed to assign vendor. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, borderRadius: 16, background: t.surfaceRaised,
        border: `1px solid ${t.border}`, padding: 20, boxShadow: t.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>
            Assign Vendor — {booking.booking_number}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {(booking.preferred_date || booking.preferred_slot) && (
          <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
            Customer requested: <strong style={{ color: t.text }}>
              {booking.preferred_date ?? 'any date'}{booking.preferred_slot ? ` · ${booking.preferred_slot}` : ''}
            </strong>
          </p>
        )}

        <VendorPicker vendors={vendors} value={vendorId} onChange={setVendorId} onVendorCreated={onVendorCreated} />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>
              Service date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 14 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 14 }}
            />
          </div>
        </div>

        {error && <p style={{ color: t.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}

        <button
          onClick={confirm}
          disabled={!vendorId || !date || !time || saving}
          style={{
            marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: t.primary, color: t.textInverse, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', opacity: (!vendorId || !date || !time || saving) ? 0.5 : 1,
          }}
        >
          {saving ? 'Assigning…' : 'Confirm assignment'}
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const content = href ? (
    <a href={href} style={{ color: t.primary, textDecoration: 'none' }}>{value}</a>
  ) : value;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${t.border}`, fontSize: 13 }}>
      <span style={{ color: t.textMuted }}>{label}</span>
      <span style={{ color: t.text, textAlign: 'right', fontWeight: 500 }}>{content || '—'}</span>
    </div>
  );
}

function BookingDetailsModal({ booking, onClose }: { booking: ServiceBooking; onClose: () => void }) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const mapHref = booking.site_latitude != null && booking.site_longitude != null
    ? `https://www.google.com/maps?q=${booking.site_latitude},${booking.site_longitude}`
    : undefined;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', padding: 16,
    }} onClick={onClose}>
      <div
        style={{ width: '100%', maxWidth: 460, borderRadius: 16, background: t.surfaceRaised, border: `1px solid ${t.border}`, padding: 20, boxShadow: t.shadow }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>Booking Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, fontFamily: 'monospace', color: t.textDim, marginBottom: 14 }}>{booking.booking_number}</p>

        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: t.textDim, marginBottom: 4 }}>Customer</p>
        <DetailRow label="Name" value={booking.customer_name} />
        <DetailRow label="Phone" value={booking.customer_phone} href={booking.customer_phone ? `tel:${booking.customer_phone}` : undefined} />
        <DetailRow label="Email" value={booking.customer_email} href={booking.customer_email ? `mailto:${booking.customer_email}` : undefined} />
        <DetailRow label="Address" value={booking.customer_address} />

        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: t.textDim, marginTop: 14, marginBottom: 4 }}>Site</p>
        <DetailRow label="Site" value={`${booking.site_name || booking.site_id} (${booking.site_id})`} />
        <DetailRow
          label="Coordinates"
          value={mapHref ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> Open in Maps</span> : '—'}
          href={mapHref}
        />

        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: t.textDim, marginTop: 14, marginBottom: 4 }}>Issue</p>
        <DetailRow label="Category" value={<span style={{ textTransform: 'capitalize' }}>{booking.issue_category}</span>} />
        <div style={{ padding: '8px 0', fontSize: 13, color: t.text }}>
          {booking.issue_description || <span style={{ color: t.textMuted }}>No description provided.</span>}
        </div>
        {booking.technician_notes && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: t.textDim, marginTop: 14, marginBottom: 4 }}>Technician Notes</p>
            <div style={{ padding: '8px 0', fontSize: 13, color: t.text }}>{booking.technician_notes}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ServiceBookings() {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [vendors, setVendors] = useState<ServiceVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [assigningBooking, setAssigningBooking] = useState<ServiceBooking | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<ServiceBooking | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [bookingsData, vendorsData] = await Promise.all([
        apiService.getServiceBookings(statusFilter === 'all' ? undefined : statusFilter),
        apiService.getServiceVendors(),
      ]);
      setBookings(bookingsData);
      setVendors(vendorsData);
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
    bookings.forEach(b => { c[b.status] = (c[b.status] ?? 0) + 1; });
    return c;
  }, [bookings]);

  async function markStatus(booking: ServiceBooking, next: 'completed' | 'closed') {
    const updated = await apiService.updateBookingStatus(booking.id, next);
    setBookings(prev => prev.map(b => (b.id === updated.id ? updated : b)));
  }

  return (
    <div>
      <PageHeader
        icon={<CalendarCheck size={22} />}
        title="360Care Service Bookings"
        subtitle="Assign vendors, schedule visits, and track jobs through completion"
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
              <th style={{ padding: '12px 16px' }}>Booking</th>
              <th style={{ padding: '12px 16px' }}>Customer</th>
              <th style={{ padding: '12px 16px' }}>Site</th>
              <th style={{ padding: '12px 16px' }}>Issue</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Vendor</th>
              <th style={{ padding: '12px 16px' }}>Scheduled</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} columns={8} />)}
            {!loading && bookings.map(b => (
              <tr key={b.id} style={{ borderTop: `1px solid ${t.border}`, fontSize: 13, color: t.text }}>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => setDetailsBooking(b)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', color: t.primary, textDecoration: 'underline', fontSize: 13 }}
                  >
                    {b.booking_number}
                  </button>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{b.customer_name || '—'}</div>
                  {b.customer_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                      <Phone size={11} /> {b.customer_phone}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>{b.site_name || b.site_id}</td>
                <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{b.issue_category}</td>
                <td style={{ padding: '12px 16px' }}><StatusPill status={b.status} /></td>
                <td style={{ padding: '12px 16px' }}>
                  {b.vendor_name ? `${b.vendor_name} (${b.vendor_company})` : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {b.service_date ? (
                    `${b.service_date} ${b.service_time ?? ''}`
                  ) : (b.preferred_date || b.preferred_slot) ? (
                    <span style={{ fontStyle: 'italic', color: t.textMuted }}>
                      Requested: {b.preferred_date ?? 'any date'}{b.preferred_slot ? ` · ${b.preferred_slot}` : ''}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {b.status === 'pending' && (
                    <button
                      onClick={() => setAssigningBooking(b)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: t.primary, color: t.textInverse, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Assign
                    </button>
                  )}
                  {b.status === 'scheduled' && (
                    <button
                      onClick={() => markStatus(b, 'completed')}
                      style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark completed
                    </button>
                  )}
                  {b.status === 'completed' && (
                    <button
                      onClick={() => markStatus(b, 'closed')}
                      style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && bookings.length === 0 && (
          <EmptyState icon={<CalendarCheck size={32} />} title="No bookings" description="No service bookings match this filter." />
        )}
      </div>

      {assigningBooking && (
        <AssignDialog
          booking={assigningBooking}
          vendors={vendors}
          onClose={() => setAssigningBooking(null)}
          onAssigned={updated => setBookings(prev => prev.map(b => (b.id === updated.id ? updated : b)))}
          onVendorCreated={vendor => setVendors(prev => [...prev, vendor])}
        />
      )}

      {detailsBooking && (
        <BookingDetailsModal booking={detailsBooking} onClose={() => setDetailsBooking(null)} />
      )}
    </div>
  );
}
