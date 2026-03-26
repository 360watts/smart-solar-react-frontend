import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { Plus, Pencil, Trash2, X, Zap, Battery, Sun, ChevronDown, Server } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from './EmptyState';
import PageHeader from './PageHeader';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Site {
  id: number;
  site_id: string;
  display_name: string;
  gateway_device?: {
    is_online?: boolean;
    last_seen_at?: string | null;
    connectivity_type?: string;
    signal_strength_dbm?: number | null;
    device_temp_c?: number | null;
    memory_status?: { free_heap?: number } | null;
    heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical' } | null;
  } | null;
}

interface Inverter {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_kva: string;
  max_input_voltage_v: string | null; mppt_voltage_min_v: string | null; mppt_voltage_max_v: string | null;
  operating_voltage_min_v: string | null; operating_voltage_max_v: string | null; max_input_current_a: string | null;
  anti_islanding: boolean; teda_scheme: string;
  installed_at: string | null; warranty_expires_at: string | null; is_active: boolean; notes: string;
}

interface Battery {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_kwh: string;
  nominal_capacity_ah: string | null; nominal_energy_kwh: string | null; nominal_voltage_v: string | null;
  max_charge_current_a: string | null; max_charge_current_peak_a: string | null;
  operating_voltage_min_v: string | null; operating_voltage_max_v: string | null;
  charge_temp_min_c: string | null; charge_temp_max_c: string | null;
  discharge_temp_min_c: string | null; discharge_temp_max_c: string | null;
  installed_at: string | null; warranty_expires_at: string | null; is_active: boolean; notes: string;
}

interface SolarPanel {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_wp: string;
  technology: string; installed_at: string | null; warranty_expires_at: string | null;
  is_active: boolean; notes: string;
}

// ── Blank form factories ───────────────────────────────────────────────────────

const blankInverter = (): Omit<Inverter, 'id' | 'site'> => ({
  make: '', model_name: '', serial_number: '', capacity_kva: '',
  max_input_voltage_v: '', mppt_voltage_min_v: '', mppt_voltage_max_v: '',
  operating_voltage_min_v: '', operating_voltage_max_v: '', max_input_current_a: '',
  anti_islanding: true, teda_scheme: '',
  installed_at: '', warranty_expires_at: '', is_active: true, notes: '',
});

const blankBattery = (): Omit<Battery, 'id' | 'site'> => ({
  make: '', model_name: '', serial_number: '', capacity_kwh: '',
  nominal_capacity_ah: '', nominal_energy_kwh: '', nominal_voltage_v: '',
  max_charge_current_a: '', max_charge_current_peak_a: '',
  operating_voltage_min_v: '', operating_voltage_max_v: '',
  charge_temp_min_c: '', charge_temp_max_c: '',
  discharge_temp_min_c: '', discharge_temp_max_c: '',
  installed_at: '', warranty_expires_at: '', is_active: true, notes: '',
});

const blankPanel = (): Omit<SolarPanel, 'id' | 'site'> => ({
  make: '', model_name: '', serial_number: '', capacity_wp: '',
  technology: '', installed_at: '', warranty_expires_at: '', is_active: true, notes: '',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert empty strings to null only for non-text fields.
 * Keep optional text fields as "" because backend CharField(blank=True) rejects null.
 */
const TEXT_FIELDS_ALLOW_EMPTY = new Set([
  'make',
  'model_name',
  'serial_number',
  'teda_scheme',
  'technology',
  'notes',
]);

const cleanNulls = (obj: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v !== '') return [k, v];
      return [k, TEXT_FIELDS_ALLOW_EMPTY.has(k) ? '' : null];
    }),
  );

interface SiteEquipmentBundle {
  inverters: Inverter[];
  batteries: Battery[];
  panels: SolarPanel[];
}

const sumActivePanelWp = (panels: SolarPanel[]) =>
  panels.filter(p => p.is_active).reduce((s, p) => s + toPanelWp(p.capacity_wp), 0);

const isBlank = (v: unknown) => String(v ?? '').trim() === '';

const parsePositiveNumber = (v: string | null | undefined): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalizeKey = (v: string | null | undefined): string => String(v ?? '').trim().toLowerCase();

const toPanelWp = (raw: string | null | undefined): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Backward compatibility: old rows may store kWp-style values in capacity_wp.
  return n <= 20 ? n * 1000 : n;
};

const validateInverterForm = (form: Omit<Inverter, 'id' | 'site'>): string | null => {
  if (isBlank(form.make)) return 'Make is required.';
  if (isBlank(form.serial_number)) return 'Serial Number is required.';

  const capacity = parsePositiveNumber(form.capacity_kva);
  if (capacity == null) return 'Capacity (kVA) must be a number greater than 0.';

  const mpptMin = parsePositiveNumber(form.mppt_voltage_min_v);
  const mpptMax = parsePositiveNumber(form.mppt_voltage_max_v);
  if (mpptMin != null && mpptMax != null && mpptMin > mpptMax) {
    return 'MPPT Min (V) must be less than or equal to MPPT Max (V).';
  }

  const opMin = parsePositiveNumber(form.operating_voltage_min_v);
  const opMax = parsePositiveNumber(form.operating_voltage_max_v);
  if (opMin != null && opMax != null && opMin > opMax) {
    return 'Operating Min (V) must be less than or equal to Operating Max (V).';
  }

  if (form.installed_at && form.warranty_expires_at && form.warranty_expires_at < form.installed_at) {
    return 'Warranty expiry date cannot be earlier than installed date.';
  }

  return null;
};

const hasDuplicateMakeSerial = <T extends { id: number; make: string; serial_number: string }>(
  items: T[],
  make: string,
  serialNumber: string,
  currentId?: number,
): boolean => {
  const mk = normalizeKey(make);
  const sn = normalizeKey(serialNumber);
  return items.some((item) => {
    if (currentId != null && item.id === currentId) return false;
    return normalizeKey(item.make) === mk && normalizeKey(item.serial_number) === sn;
  });
};

// ── Shared sub-components ──────────────────────────────────────────────────────

const inputStyle = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 10px', borderRadius: 7, width: '100%', boxSizing: 'border-box',
  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d1d5db',
  background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827',
  fontSize: '0.875rem',
});

const labelStyle = (isDark: boolean): React.CSSProperties => ({
  fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151',
  display: 'block', marginBottom: 4,
});

const FormField: React.FC<{
  label: string; value: string | boolean; onChange: (v: any) => void;
  type?: string; isDark: boolean; required?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, type = 'text', isDark, required, placeholder }) => {
  if (type === 'checkbox') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={value as boolean} onChange={e => onChange(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
        <span style={labelStyle(isDark)}>{label}</span>
      </div>
    );
  }
  return (
    <div>
      <label style={labelStyle(isDark)}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      <input type={type} value={value as string} onChange={e => onChange(e.target.value)}
        style={inputStyle(isDark)} required={required} placeholder={placeholder} />
    </div>
  );
};

const SectionHeader: React.FC<{
  icon: React.ReactNode; title: string; count: number; onAdd: () => void; isDark: boolean;
}> = ({ icon, title, count, onAdd, isDark }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px',
    borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: '#22c55e' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: isDark ? '#f9fafb' : '#111827' }}>
        {title}
      </h3>
      <span style={{
        background: isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7',
        color: '#16a34a', borderRadius: 12, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 600,
      }}>{count}</span>
    </div>
    <button onClick={onAdd} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
      <Plus size={14} /> Add
    </button>
  </div>
);

const DeleteConfirmModal: React.FC<{
  open: boolean; label: string; onConfirm: () => void; onCancel: () => void; isDark: boolean;
}> = ({ open, label, onConfirm, onCancel, isDark }) => {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 12, padding: 28, width: 380, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 10px', color: isDark ? '#f9fafb' : '#111827' }}>Delete {label}?</h3>
        <p style={{ margin: '0 0 22px', color: isDark ? '#9ca3af' : '#6b7280', fontSize: '0.9rem' }}>
          This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }}>Delete</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Inverter section ───────────────────────────────────────────────────────────

const InverterSection: React.FC<{
  siteId: string;
  isDark: boolean;
  items: Inverter[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}> = ({ siteId, isDark, items, loading, onRefresh }) => {
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; item: Inverter | null }>({ open: false, item: null });
  const [form, setForm] = useState(blankInverter());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Inverter | null>(null);

  const openCreate = () => { setForm(blankInverter()); setModal({ open: true, item: null }); };
  const openEdit = (item: Inverter) => {
    setForm({ ...item }); setModal({ open: true, item });
  };

  const handleSave = async () => {
    setError(null);
    const validationError = validateInverterForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (hasDuplicateMakeSerial(items, form.make, form.serial_number, modal.item?.id)) {
      setError('Serial Number must be unique for the same make.');
      return;
    }

    setSaving(true);
    try {
      const payload = cleanNulls(form as any);
      if (modal.item) await apiService.updateInverter(siteId, modal.item.id, payload);
      else await apiService.createInverter(siteId, payload);
      setModal({ open: false, item: null });
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiService.deleteInverter(siteId, deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ background: isDark ? '#141414' : '#ffffff', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb', marginBottom: 20, overflow: 'hidden' }}>
      <SectionHeader icon={<Zap size={17} />} title="Inverters" count={items.length} onAdd={openCreate} isDark={isDark} />

      {error && <div style={{ padding: '10px 20px', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24 }}><EmptyState title="No inverters" description="Add the inverter from the contract." /></div>
      ) : (
        <div className="table-responsive">
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Make / Model</th><th>Serial</th><th>Capacity</th>
                <th>MPPT Range</th><th>Installed</th><th>Warranty</th><th>Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.make}</div>
                    {inv.model_name && <div style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{inv.model_name}</div>}
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{inv.serial_number}</code></td>
                  <td>{inv.capacity_kva} kVA</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {inv.mppt_voltage_min_v && inv.mppt_voltage_max_v
                      ? `${inv.mppt_voltage_min_v}–${inv.mppt_voltage_max_v} V` : '—'}
                  </td>
                  <td>{inv.installed_at || '—'}</td>
                  <td>{inv.warranty_expires_at || '—'}</td>
                  <td>
                    <span style={{ color: inv.is_active ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                      {inv.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(inv)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(inv)} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal open={!!deleteTarget} label={deleteTarget?.serial_number ?? 'inverter'} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDark={isDark} />

      {modal.open && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>{modal.item ? 'Edit Inverter' : 'Add Inverter'}</h3>
              <button onClick={() => setModal({ open: false, item: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#9ca3af' : '#6b7280' }}><X size={20} /></button>
            </div>
            {/* Body */}
            <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Make" value={form.make} onChange={v => f('make', v)} isDark={isDark} required placeholder="e.g., Sungrow" />
                <FormField label="Model Name" value={form.model_name} onChange={v => f('model_name', v)} isDark={isDark} placeholder="e.g., SG33CX" />
                <FormField label="Serial Number" value={form.serial_number} onChange={v => f('serial_number', v)} isDark={isDark} required placeholder="e.g., INV-2026-0001" />
                <FormField label="Capacity (kVA)" value={form.capacity_kva} onChange={v => f('capacity_kva', v)} type="number" isDark={isDark} required placeholder="e.g., 10" />
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1', marginTop: 4 }}>DC Input Specs</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Max Input Voltage (V)" value={form.max_input_voltage_v ?? ''} onChange={v => f('max_input_voltage_v', v)} type="number" isDark={isDark} placeholder="e.g., 1100" />
                <FormField label="Max Input Current (A)" value={form.max_input_current_a ?? ''} onChange={v => f('max_input_current_a', v)} type="number" isDark={isDark} placeholder="e.g., 26" />
                <FormField label="MPPT Min (V)" value={form.mppt_voltage_min_v ?? ''} onChange={v => f('mppt_voltage_min_v', v)} type="number" isDark={isDark} placeholder="e.g., 200" />
                <FormField label="MPPT Max (V)" value={form.mppt_voltage_max_v ?? ''} onChange={v => f('mppt_voltage_max_v', v)} type="number" isDark={isDark} placeholder="e.g., 950" />
                <FormField label="Operating Min (V)" value={form.operating_voltage_min_v ?? ''} onChange={v => f('operating_voltage_min_v', v)} type="number" isDark={isDark} placeholder="e.g., 180" />
                <FormField label="Operating Max (V)" value={form.operating_voltage_max_v ?? ''} onChange={v => f('operating_voltage_max_v', v)} type="number" isDark={isDark} placeholder="e.g., 1000" />
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1', marginTop: 4 }}>Installation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="TEDA Scheme" value={form.teda_scheme} onChange={v => f('teda_scheme', v)} isDark={isDark} placeholder="e.g., TEDA-2026-A" />
                <FormField label="Installed Date" value={form.installed_at ?? ''} onChange={v => f('installed_at', v)} type="date" isDark={isDark} />
                <FormField label="Warranty Expires" value={form.warranty_expires_at ?? ''} onChange={v => f('warranty_expires_at', v)} type="date" isDark={isDark} />
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <FormField label="Anti-Islanding" value={form.anti_islanding} onChange={v => f('anti_islanding', v)} type="checkbox" isDark={isDark} />
                <FormField label="Active" value={form.is_active} onChange={v => f('is_active', v)} type="checkbox" isDark={isDark} />
              </div>
              <div>
                <label style={labelStyle(isDark)}>Notes</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                  rows={2} style={{ ...inputStyle(isDark), resize: 'vertical' }} placeholder="Optional notes (installation, service, remarks)" />
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal({ open: false, item: null })} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ── Battery section ────────────────────────────────────────────────────────────

const BatterySection: React.FC<{
  siteId: string;
  isDark: boolean;
  items: Battery[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}> = ({ siteId, isDark, items, loading, onRefresh }) => {
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; item: Battery | null }>({ open: false, item: null });
  const [form, setForm] = useState(blankBattery());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Battery | null>(null);

  const openCreate = () => { setForm(blankBattery()); setModal({ open: true, item: null }); };
  const openEdit = (item: Battery) => { setForm({ ...item }); setModal({ open: true, item }); };

  const handleSave = async () => {
    setError(null);
    if (isBlank(form.make)) {
      setError('Make is required.');
      return;
    }
    if (isBlank(form.serial_number)) {
      setError('Serial Number is required.');
      return;
    }
    if (parsePositiveNumber(form.capacity_kwh) == null) {
      setError('Capacity (kWh) must be a number greater than 0.');
      return;
    }
    if (hasDuplicateMakeSerial(items, form.make, form.serial_number, modal.item?.id)) {
      setError('Serial Number must be unique for the same make.');
      return;
    }

    setSaving(true);
    try {
      const payload = cleanNulls(form as any);
      if (modal.item) await apiService.updateBattery(siteId, modal.item.id, payload);
      else await apiService.createBattery(siteId, payload);
      setModal({ open: false, item: null });
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiService.deleteBattery(siteId, deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ background: isDark ? '#141414' : '#ffffff', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb', marginBottom: 20, overflow: 'hidden' }}>
      <SectionHeader icon={<Battery size={17} />} title="Batteries" count={items.length} onAdd={openCreate} isDark={isDark} />

      {error && <div style={{ padding: '10px 20px', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24 }}><EmptyState title="No batteries" description="Add the battery from the contract." /></div>
      ) : (
        <div className="table-responsive">
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Make / Model</th><th>Serial</th><th>Capacity</th>
                <th>Nominal Voltage</th><th>Operating V Range</th><th>Installed</th><th>Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(bat => (
                <tr key={bat.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{bat.make}</div>
                    {bat.model_name && <div style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{bat.model_name}</div>}
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{bat.serial_number}</code></td>
                  <td>{bat.capacity_kwh} kWh</td>
                  <td>{bat.nominal_voltage_v ? `${bat.nominal_voltage_v} V` : '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {bat.operating_voltage_min_v && bat.operating_voltage_max_v
                      ? `${bat.operating_voltage_min_v}–${bat.operating_voltage_max_v} V` : '—'}
                  </td>
                  <td>{bat.installed_at || '—'}</td>
                  <td>
                    <span style={{ color: bat.is_active ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                      {bat.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(bat)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(bat)} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal open={!!deleteTarget} label={deleteTarget?.serial_number ?? 'battery'} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDark={isDark} />

      {modal.open && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>{modal.item ? 'Edit Battery' : 'Add Battery'}</h3>
              <button onClick={() => setModal({ open: false, item: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#9ca3af' : '#6b7280' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Make" value={form.make} onChange={v => f('make', v)} isDark={isDark} required placeholder="e.g., BYD" />
                <FormField label="Model Name" value={form.model_name} onChange={v => f('model_name', v)} isDark={isDark} placeholder="e.g., LVL 15.4" />
                <FormField label="Serial Number" value={form.serial_number} onChange={v => f('serial_number', v)} isDark={isDark} required placeholder="e.g., BAT-2026-0001" />
                <FormField label="Capacity (kWh)" value={form.capacity_kwh} onChange={v => f('capacity_kwh', v)} type="number" isDark={isDark} required placeholder="e.g., 10" />
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1', marginTop: 4 }}>Electrical Specs</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Nominal Capacity (Ah)" value={form.nominal_capacity_ah ?? ''} onChange={v => f('nominal_capacity_ah', v)} type="number" isDark={isDark} placeholder="e.g., 200" />
                <FormField label="Nominal Energy (kWh)" value={form.nominal_energy_kwh ?? ''} onChange={v => f('nominal_energy_kwh', v)} type="number" isDark={isDark} placeholder="e.g., 10" />
                <FormField label="Nominal Voltage (V)" value={form.nominal_voltage_v ?? ''} onChange={v => f('nominal_voltage_v', v)} type="number" isDark={isDark} placeholder="e.g., 51.2" />
                <FormField label="Max Charge (A)" value={form.max_charge_current_a ?? ''} onChange={v => f('max_charge_current_a', v)} type="number" isDark={isDark} placeholder="e.g., 100" />
                <FormField label="Max Charge Peak (A)" value={form.max_charge_current_peak_a ?? ''} onChange={v => f('max_charge_current_peak_a', v)} type="number" isDark={isDark} placeholder="e.g., 120" />
                <FormField label="Op. Voltage Min (V)" value={form.operating_voltage_min_v ?? ''} onChange={v => f('operating_voltage_min_v', v)} type="number" isDark={isDark} placeholder="e.g., 44" />
                <FormField label="Op. Voltage Max (V)" value={form.operating_voltage_max_v ?? ''} onChange={v => f('operating_voltage_max_v', v)} type="number" isDark={isDark} placeholder="e.g., 58" />
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1', marginTop: 4 }}>Temperature Limits</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Charge Min (°C)" value={form.charge_temp_min_c ?? ''} onChange={v => f('charge_temp_min_c', v)} type="number" isDark={isDark} placeholder="e.g., 0" />
                <FormField label="Charge Max (°C)" value={form.charge_temp_max_c ?? ''} onChange={v => f('charge_temp_max_c', v)} type="number" isDark={isDark} placeholder="e.g., 45" />
                <FormField label="Discharge Min (°C)" value={form.discharge_temp_min_c ?? ''} onChange={v => f('discharge_temp_min_c', v)} type="number" isDark={isDark} placeholder="e.g., -10" />
                <FormField label="Discharge Max (°C)" value={form.discharge_temp_max_c ?? ''} onChange={v => f('discharge_temp_max_c', v)} type="number" isDark={isDark} placeholder="e.g., 50" />
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1', marginTop: 4 }}>Installation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Installed Date" value={form.installed_at ?? ''} onChange={v => f('installed_at', v)} type="date" isDark={isDark} />
                <FormField label="Warranty Expires" value={form.warranty_expires_at ?? ''} onChange={v => f('warranty_expires_at', v)} type="date" isDark={isDark} />
              </div>
              <FormField label="Active" value={form.is_active} onChange={v => f('is_active', v)} type="checkbox" isDark={isDark} />
              <div>
                <label style={labelStyle(isDark)}>Notes</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} style={{ ...inputStyle(isDark), resize: 'vertical' }} placeholder="Optional notes (installation, service, remarks)" />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal({ open: false, item: null })} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ── Solar Panel section ────────────────────────────────────────────────────────

const PanelSection: React.FC<{
  siteId: string;
  isDark: boolean;
  items: SolarPanel[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}> = ({ siteId, isDark, items, loading, onRefresh }) => {
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; item: SolarPanel | null }>({ open: false, item: null });
  const [form, setForm] = useState(blankPanel());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SolarPanel | null>(null);

  const openCreate = () => { setForm(blankPanel()); setModal({ open: true, item: null }); };
  const openEdit = (item: SolarPanel) => { setForm({ ...item }); setModal({ open: true, item }); };

  const handleSave = async () => {
    setError(null);
    if (isBlank(form.make)) {
      setError('Make is required.');
      return;
    }
    if (isBlank(form.serial_number)) {
      setError('Serial Number is required.');
      return;
    }
    if (parsePositiveNumber(form.capacity_wp) == null) {
      setError('Capacity (Wp) must be a number greater than 0.');
      return;
    }
    if (hasDuplicateMakeSerial(items, form.make, form.serial_number, modal.item?.id)) {
      setError('Serial Number must be unique for the same make.');
      return;
    }

    setSaving(true);
    try {
      const payload = cleanNulls(form as any);
      if (modal.item) await apiService.updatePanel(siteId, modal.item.id, payload);
      else await apiService.createPanel(siteId, payload);
      setModal({ open: false, item: null });
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiService.deletePanel(siteId, deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ background: isDark ? '#141414' : '#ffffff', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb', marginBottom: 20, overflow: 'hidden' }}>
      <SectionHeader icon={<Sun size={17} />} title="Solar panels" count={items.length} onAdd={openCreate} isDark={isDark} />

      {error && <div style={{ padding: '10px 20px', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24 }}><EmptyState title="No panels" description="Add panels from the contract. One row per physical panel." /></div>
      ) : (
        <div className="table-responsive">
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Make / Model</th><th>Serial</th><th>Capacity (Wp)</th>
                <th>Technology</th><th>Installed</th><th>Warranty</th><th>Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.make}</div>
                    {p.model_name && <div style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{p.model_name}</div>}
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{p.serial_number}</code></td>
                  <td>{toPanelWp(p.capacity_wp).toFixed(0)}</td>
                  <td>{p.technology || '—'}</td>
                  <td>{p.installed_at || '—'}</td>
                  <td>{p.warranty_expires_at || '—'}</td>
                  <td>
                    <span style={{ color: p.is_active ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                      {p.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(p)} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal open={!!deleteTarget} label={deleteTarget?.serial_number ?? 'panel'} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDark={isDark} />

      {modal.open && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>{modal.item ? 'Edit Panel' : 'Add Panel'}</h3>
              <button onClick={() => setModal({ open: false, item: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#9ca3af' : '#6b7280' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Make" value={form.make} onChange={v => f('make', v)} isDark={isDark} required placeholder="e.g., Waaree" />
                <FormField label="Model Name" value={form.model_name} onChange={v => f('model_name', v)} isDark={isDark} placeholder="e.g., TOPCon 560" />
                <FormField label="Serial Number" value={form.serial_number} onChange={v => f('serial_number', v)} isDark={isDark} required placeholder="e.g., PAN-2026-0001" />
                <FormField label="Capacity (Wp)" value={form.capacity_wp} onChange={v => f('capacity_wp', v)} type="number" isDark={isDark} required placeholder="e.g., 560" />
                <FormField label="Technology" value={form.technology} onChange={v => f('technology', v)} isDark={isDark} placeholder="e.g., TOPCon" />
              </div>
              <div style={{ marginTop: -4, fontSize: '0.78rem', color: isDark ? '#9ca3af' : '#64748b' }}>
                Enter <strong>per-panel</strong> capacity in Wp (not total array capacity).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Installed Date" value={form.installed_at ?? ''} onChange={v => f('installed_at', v)} type="date" isDark={isDark} />
                <FormField label="Warranty Expires" value={form.warranty_expires_at ?? ''} onChange={v => f('warranty_expires_at', v)} type="date" isDark={isDark} />
              </div>
              <FormField label="Active" value={form.is_active} onChange={v => f('is_active', v)} type="checkbox" isDark={isDark} />
              <div>
                <label style={labelStyle(isDark)}>Notes</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} style={{ ...inputStyle(isDark), resize: 'vertical' }} placeholder="Optional notes (installation, service, remarks)" />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal({ open: false, item: null })} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const Equipment: React.FC = () => {
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [loadingSites, setLoadingSites] = useState(true);
  const [bundle, setBundle] = useState<SiteEquipmentBundle | null>(null);
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipError, setEquipError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = (searchParams.get('site') || searchParams.get('site_id') || '').trim();
    apiService.getAllSites().then(data => {
      setSites(data);
      if (fromQuery && data.some((s: Site) => s.site_id === fromQuery)) {
        setSelectedSiteId(fromQuery);
      } else if (data.length > 0) {
        setSelectedSiteId(data[0].site_id);
      }
    }).finally(() => setLoadingSites(false));
  }, [searchParams]);

  const refreshEquipment = useCallback(async () => {
    if (!selectedSiteId) return;
    setEquipLoading(true);
    setEquipError(null);
    try {
      const data = await apiService.getSiteEquipment(selectedSiteId);
      setBundle({
        inverters: Array.isArray(data.inverters) ? data.inverters : [],
        batteries: Array.isArray(data.batteries) ? data.batteries : [],
        panels: Array.isArray(data.panels) ? data.panels : [],
      });
    } catch (e) {
      setBundle(null);
      setEquipError(e instanceof Error ? e.message : 'Failed to load equipment');
    } finally {
      setEquipLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    refreshEquipment();
  }, [refreshEquipment]);

  const panels = bundle?.panels ?? [];
  const panelTotal = panels.length;
  const panelActive = panels.filter(p => p.is_active).length;
  const panelInactive = panelTotal - panelActive;
  const activeWp = sumActivePanelWp(panels);
  const activeKwp = activeWp / 1000;

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<Server size={20} color="white" />}
        title="Equipment"
        subtitle="Manage hardware inventory per site"
        rightSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Site:</label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              disabled={loadingSites}
              style={{
                ...inputStyle(isDark),
                width: 'auto', minWidth: 200, paddingRight: 32, appearance: 'none',
                cursor: 'pointer',
              }}
            >
              {loadingSites && <option>Loading…</option>}
              {sites.map(s => (
                <option key={s.site_id} value={s.site_id}>
                  {s.display_name || s.site_id}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: isDark ? '#9ca3af' : '#6b7280' }} />
          </div>
          </div>
        }
      />

      {!selectedSiteId ? (
        <EmptyState title="No sites found" description="Create a site before adding equipment." />
      ) : (
        <>
          {equipError && (
            <div style={{
              marginBottom: 16, padding: '12px 16px', borderRadius: 8,
              background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
              border: isDark ? '1px solid rgba(239,68,68,0.35)' : '1px solid #fecaca',
              color: '#ef4444', fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
            }}>
              <span>{equipError}</span>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => refreshEquipment()} disabled={equipLoading}>
                {equipLoading ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}
          {!equipError && bundle && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 20px',
              marginBottom: 20, padding: '14px 18px', borderRadius: 10,
              background: isDark ? '#141414' : '#f8fafc',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              fontSize: '0.875rem', color: isDark ? '#e5e7eb' : '#334155',
            }}>
              <span><strong>{bundle.inverters.length}</strong> inverter{bundle.inverters.length === 1 ? '' : 's'}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span><strong>{bundle.batteries.length}</strong> batter{bundle.batteries.length === 1 ? 'y' : 'ies'}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>
                <strong>{panelTotal}</strong> panel{panelTotal === 1 ? '' : 's'} total
                {panelTotal > 0 && (
                  <span style={{ color: isDark ? '#9ca3af' : '#64748b', fontWeight: 500 }}>
                    {' '}({panelActive} active{panelInactive > 0 ? `, ${panelInactive} inactive` : ''})
                  </span>
                )}
              </span>
              {panelActive > 0 && (
                <>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span title="Sum of Wp for panels marked active — contract DC array size">
                    <strong>{activeKwp.toFixed(2)}</strong> kWp DC <span style={{ color: isDark ? '#9ca3af' : '#64748b', fontWeight: 500 }}>(active panels)</span>
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => refreshEquipment()}
                disabled={equipLoading}
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '6px 12px' }}
              >
                {equipLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          )}
          {!equipError && (
            <>
              <InverterSection
                key={`inv-${selectedSiteId}`}
                siteId={selectedSiteId}
                isDark={isDark}
                items={bundle?.inverters ?? []}
                loading={equipLoading}
                onRefresh={refreshEquipment}
              />
              <BatterySection
                key={`bat-${selectedSiteId}`}
                siteId={selectedSiteId}
                isDark={isDark}
                items={bundle?.batteries ?? []}
                loading={equipLoading}
                onRefresh={refreshEquipment}
              />
              <PanelSection
                key={`pan-${selectedSiteId}`}
                siteId={selectedSiteId}
                isDark={isDark}
                items={bundle?.panels ?? []}
                loading={equipLoading}
                onRefresh={refreshEquipment}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Equipment;
