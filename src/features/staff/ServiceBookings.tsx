import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, Check, MapPin, Phone, Plus, RefreshCw, Search, User, X } from 'lucide-react';
import { apiService, BookingStatus, ServiceBooking, ServiceVendor, Technician } from '../../services/api';
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

/** Closes a dropdown/popover when the user clicks or focuses anything outside `ref` — without this, a picker left open (e.g. clicking straight into the next field instead of choosing a row) stays floating on top of the fields below it. */
function useCloseOnOutsideInteraction(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent | FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('focusin', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('focusin', handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Escape closes, ArrowUp/Down move a highlighted row, Enter picks it — keeps both pickers usable without a mouse. */
function handleDropdownKeyDown(
  e: React.KeyboardEvent,
  opts: { itemCount: number; highlight: number; setHighlight: (i: number) => void; onPick: (i: number) => void; onClose: () => void },
) {
  const { itemCount, highlight, setHighlight, onPick, onClose } = opts;
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (itemCount > 0) setHighlight((highlight + 1) % itemCount);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (itemCount > 0) setHighlight((highlight - 1 + itemCount) % itemCount);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlight >= 0 && highlight < itemCount) onPick(highlight);
  }
}

/** Shared floating panel shell used by both VendorPicker and TechnicianPicker — same container, empty-state message, and "add new" trigger/inline-form slot in both. */
function DropdownPanel({
  children, showEmpty, emptyMessage, addNewLabel, showNewForm, onAddNewClick, formChildren,
}: {
  children: React.ReactNode;
  showEmpty: boolean;
  emptyMessage: string;
  addNewLabel: string;
  showNewForm: boolean;
  onAddNewClick: () => void;
  formChildren: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
      background: t.surfaceRaised, border: `1px solid ${t.border}`, borderRadius: 10,
      maxHeight: 240, overflowY: 'auto', boxShadow: t.shadow,
    }}>
      {children}
      {showEmpty && !showNewForm && (
        <div style={{ padding: '12px 14px', fontSize: 13, color: t.textDim }}>{emptyMessage}</div>
      )}
      {!showNewForm ? (
        <div
          onClick={onAddNewClick}
          style={{
            padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: t.primary, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> {addNewLabel}
        </div>
      ) : formChildren}
    </div>
  );
}

/** Shared row used inside DropdownPanel — highlighted (keyboard/hover) or selected (current value) both render the same soft-primary background. */
function DropdownRow({
  onClick, onMouseEnter, active, children,
}: {
  onClick: () => void;
  onMouseEnter: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: t.text,
        background: active ? t.primarySoft : 'transparent',
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      {children}
    </div>
  );
}

/** The confirmed-selection state for both pickers — an unmistakable filled card, never a placeholder (placeholders read as "nothing chosen yet", which is why a made selection didn't look selected before). */
function SelectedCard({
  primary, secondary, onChange,
}: {
  primary: string;
  secondary?: string;
  onChange: () => void;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px 9px 12px',
      borderRadius: 8, border: `1px solid ${t.primary}`, background: t.primarySoft,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999, background: t.primary, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={13} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {primary}
        </div>
        {secondary && <div style={{ fontSize: 12, color: t.textMuted }}>{secondary}</div>}
      </div>
      <button
        type="button"
        onClick={onChange}
        style={{ background: 'none', border: 'none', color: t.primary, fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0, padding: '4px 2px' }}
      >
        Change
      </button>
    </div>
  );
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newVendor, setNewVendor] = useState({ company_name: '', technician_name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const selected = vendors.find(v => v.id === value) ?? null;

  useCloseOnOutsideInteraction(rootRef, () => {
    setShowDropdown(false);
    if (selected) setEditing(false);
  });

  const filtered = vendors.filter(v =>
    !search.trim() ||
    v.company_name.toLowerCase().includes(search.toLowerCase()) ||
    v.technician_name.toLowerCase().includes(search.toLowerCase()),
  );

  function openEditing() {
    setEditing(true);
    setShowDropdown(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(vendorId: number) {
    onChange(vendorId);
    setShowDropdown(false);
    setSearch('');
    setEditing(false);
    inputRef.current?.blur();
  }

  async function saveNewVendor() {
    if (!newVendor.company_name || !newVendor.technician_name || !newVendor.phone) return;
    setSaving(true);
    try {
      const created = await apiService.createServiceVendor(newVendor);
      onVendorCreated(created);
      onChange(created.id);
      setShowNewForm(false);
      setShowDropdown(false);
      setEditing(false);
      setNewVendor({ company_name: '', technician_name: '', phone: '', email: '' });
      inputRef.current?.blur();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>
        Vendor company
      </label>
      {selected && !editing ? (
        <SelectedCard
          primary={selected.company_name}
          secondary={`${selected.technician_name} · ${selected.phone}`}
          onChange={openEditing}
        />
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); setHighlight(-1); }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={e => handleDropdownKeyDown(e, {
                itemCount: filtered.length,
                highlight,
                setHighlight,
                onPick: i => pick(filtered[i].id),
                onClose: () => setShowDropdown(false),
              })}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 30px', borderRadius: 8,
                border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 14,
              }}
            />
          </div>
          {showDropdown && (
            <DropdownPanel
              showEmpty={filtered.length === 0}
              emptyMessage="No vendors match."
              addNewLabel="Add new vendor"
              showNewForm={showNewForm}
              onAddNewClick={() => setShowNewForm(true)}
              formChildren={
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
              }
            >
              {filtered.map((v, i) => (
                <DropdownRow
                  key={v.id}
                  active={i === highlight || v.id === value}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(v.id)}
                >
                  <div style={{ fontWeight: 600 }}>{v.company_name}</div>
                  <div style={{ color: t.textMuted, fontSize: 12 }}>{v.technician_name} · {v.phone}</div>
                </DropdownRow>
              ))}
            </DropdownPanel>
          )}
        </>
      )}
    </div>
  );
}

function TechnicianPicker({
  vendor, value, onSelect,
}: {
  vendor: ServiceVendor;
  value: number | null;
  onSelect: (technician: Technician | null) => void;
}) {
  const { isDark } = useTheme();
  const t = getDesignTokens(isDark);
  const rosterRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [roster, setRoster] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTechnician, setNewTechnician] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [retryTick, setRetryTick] = useState(0);

  useCloseOnOutsideInteraction(rosterRef, () => {
    setShowDropdown(false);
    setEditing(false);
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // New vendor picked — any in-progress search/edit belonged to the old roster, so drop it.
    setEditing(false);
    setShowDropdown(false);
    setSearch('');
    apiService.getTechnicians(vendor.id).then(data => {
      if (!cancelled) setRoster(data);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vendor.id, retryTick]);

  const selectedTech = roster.find(tech => tech.id === value) ?? null;
  const isDefaultSelected = value === null;

  const defaultMatchesSearch = !search.trim() || vendor.technician_name.toLowerCase().includes(search.toLowerCase());
  const filteredRoster = roster.filter(tech =>
    !search.trim() || tech.name.toLowerCase().includes(search.toLowerCase()),
  );
  // One combined, keyboard-navigable list: the vendor's registered contact pinned first, then the roster —
  // a single selection mechanism instead of a separately-always-checked default plus a second search list.
  const navOptions: Array<{ kind: 'default' } | { kind: 'tech'; tech: Technician }> = [
    ...(defaultMatchesSearch ? [{ kind: 'default' as const }] : []),
    ...filteredRoster.map(tech => ({ kind: 'tech' as const, tech })),
  ];

  function openEditing() {
    setEditing(true);
    setShowDropdown(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(tech: Technician | null) {
    onSelect(tech);
    setShowDropdown(false);
    setSearch('');
    setEditing(false);
    inputRef.current?.blur();
  }

  async function saveNewTechnician() {
    if (!newTechnician.name || !newTechnician.phone) return;
    setSaving(true);
    try {
      const created = await apiService.createTechnician({ vendor: vendor.id, ...newTechnician });
      setRoster(prev => [...prev, created]);
      onSelect(created);
      setShowNewForm(false);
      setShowDropdown(false);
      setEditing(false);
      setNewTechnician({ name: '', phone: '' });
      inputRef.current?.blur();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>
        Technician for this visit
      </label>
      <div ref={rosterRef} style={{ position: 'relative' }}>
        {!editing ? (
          <SelectedCard
            primary={isDefaultSelected ? vendor.technician_name : (selectedTech?.name ?? '')}
            secondary={isDefaultSelected ? `${vendor.phone} · Registered contact` : selectedTech?.phone}
            onChange={openEditing}
          />
        ) : (
          <>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: t.textDim }} />
              <input
                ref={inputRef}
                type="text"
                placeholder={error ? 'Could not load roster' : loading ? 'Loading roster…' : 'Search technicians…'}
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDropdown(true); setHighlight(-1); }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={e => handleDropdownKeyDown(e, {
                  itemCount: navOptions.length,
                  highlight,
                  setHighlight,
                  onPick: i => {
                    const opt = navOptions[i];
                    pick(opt.kind === 'default' ? null : opt.tech);
                  },
                  onClose: () => setShowDropdown(false),
                })}
                disabled={loading || error}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 30px', borderRadius: 8,
                  border: `1px solid ${error ? '#EF4444' : t.primary}`, background: t.surface, color: t.text, fontSize: 13,
                }}
              />
            </div>
            {error && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Couldn&apos;t load technicians for {vendor.company_name}.</span>
                <button
                  onClick={() => setRetryTick(n => n + 1)}
                  style={{ background: 'none', border: 'none', color: t.primary, fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}
                >
                  Retry
                </button>
              </div>
            )}
            {showDropdown && !loading && !error && (
              <DropdownPanel
                showEmpty={navOptions.length === 0}
                emptyMessage={`No one on the roster yet for ${vendor.company_name}.`}
                addNewLabel={`Add a technician to ${vendor.company_name}'s roster`}
                showNewForm={showNewForm}
                onAddNewClick={() => setShowNewForm(true)}
                formChildren={
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      placeholder="Technician name"
                      value={newTechnician.name}
                      onChange={e => setNewTechnician({ ...newTechnician, name: e.target.value })}
                      style={{ padding: '7px 9px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 13 }}
                    />
                    <input
                      placeholder="Phone"
                      value={newTechnician.phone}
                      onChange={e => setNewTechnician({ ...newTechnician, phone: e.target.value })}
                      style={{ padding: '7px 9px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 13 }}
                    />
                    <button
                      onClick={saveNewTechnician}
                      disabled={saving}
                      style={{ padding: '7px 9px', borderRadius: 6, border: 'none', background: t.primary, color: t.textInverse, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      {saving ? 'Saving…' : 'Save & select'}
                    </button>
                  </div>
                }
              >
                {navOptions.map((opt, i) => opt.kind === 'default' ? (
                  <DropdownRow
                    key="default"
                    active={i === highlight || isDefaultSelected}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(null)}
                  >
                    <div style={{ fontWeight: 600 }}>{vendor.technician_name}</div>
                    <div style={{ color: t.textMuted, fontSize: 12 }}>{vendor.phone} · Registered contact</div>
                  </DropdownRow>
                ) : (
                  <DropdownRow
                    key={opt.tech.id}
                    active={i === highlight || opt.tech.id === value}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(opt.tech)}
                  >
                    <div style={{ fontWeight: 600 }}>{opt.tech.name}</div>
                    <div style={{ color: t.textMuted, fontSize: 12 }}>{opt.tech.phone}</div>
                  </DropdownRow>
                ))}
              </DropdownPanel>
            )}
          </>
        )}
      </div>
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
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [date, setDate] = useState(booking.preferred_date ?? '');
  const [time, setTime] = useState(booking.preferred_slot === 'afternoon' ? '13:00' : '09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVendor = vendors.find(v => v.id === vendorId) ?? null;
  const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

  function handleVendorChange(id: number) {
    setVendorId(id);
    setTechnician(null); // a technician only makes sense scoped to the vendor just picked
  }

  async function confirm() {
    if (!vendorId || !date || !time) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiService.assignVendor(booking.id, vendorId, date, `${time}:00`, technician?.id ?? null);
      onAssigned(updated);
      onClose();
    } catch {
      setError("Couldn't confirm this dispatch. Please try again.");
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
        width: '100%', maxWidth: 440, borderRadius: 16, background: t.surfaceRaised,
        border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ ...mono, margin: 0, fontSize: 11, color: t.textDim, letterSpacing: 0.6 }}>
                DISPATCH · {booking.booking_number}
              </p>
              <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 700, color: t.text }}>
                {booking.site_name || booking.site_id}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}>
              <X size={18} />
            </button>
          </div>
          {(booking.preferred_date || booking.preferred_slot) && (
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 8, marginBottom: 0 }}>
              Customer asked for <strong style={{ color: t.text }}>
                {booking.preferred_date ?? 'any date'}{booking.preferred_slot ? ` · ${booking.preferred_slot}` : ''}
              </strong>
            </p>
          )}
        </div>

        {/* Form */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <VendorPicker vendors={vendors} value={vendorId} onChange={handleVendorChange} onVendorCreated={onVendorCreated} />

          {selectedVendor && (
            <TechnicianPicker vendor={selectedVendor} value={technician?.id ?? null} onSelect={setTechnician} />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
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
        </div>

        {/* Ticket stub — assembles as the fields above are filled in */}
        <div style={{ margin: '0 20px 20px', borderTop: `1px dashed ${t.border}`, paddingTop: 14 }}>
          <p style={{ ...mono, fontSize: 10, color: t.textDim, letterSpacing: 0.8, margin: '0 0 8px' }}>
            DISPATCH TICKET
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={13} style={{ color: selectedVendor ? t.primary : t.textDim, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: selectedVendor ? t.text : t.textDim }}>
                {selectedVendor
                  ? (technician
                    ? `${technician.name} · ${selectedVendor.company_name}`
                    : `${selectedVendor.technician_name} (registered) · ${selectedVendor.company_name}`)
                  : 'No vendor selected yet'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarCheck size={13} style={{ color: date && time ? t.primary : t.textDim, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: date && time ? t.text : t.textDim }}>
                {date && time ? `${date} at ${time}` : 'No date/time set yet'}
              </span>
            </div>
          </div>
        </div>

        {error && <p style={{ color: t.danger, fontSize: 13, margin: '0 20px 12px' }}>{error}</p>}

        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={confirm}
            disabled={!vendorId || !date || !time || saving}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
              background: t.primary, color: t.textInverse, fontWeight: 700, fontSize: 14,
              cursor: 'pointer', opacity: (!vendorId || !date || !time || saving) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving ? 'Confirming…' : <><Check size={15} /> Confirm dispatch</>}
          </button>
        </div>
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
              <th style={{ padding: '12px 16px' }}>Technician</th>
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
                  {b.technician_name ? `${b.technician_name} (${b.vendor_company})` : '—'}
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
