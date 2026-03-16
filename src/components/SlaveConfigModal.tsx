/**
 * SlaveConfigModal — shared slave create/edit modal used by
 * Configuration.tsx and DevicePresets.tsx.
 *
 * Owns all register-form state, bulk-upload logic, search, and inline
 * register editing. The parent only needs to handle the network call
 * (create vs update vs global vs preset) and pass the result back.
 */
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import { useTheme } from '../contexts/ThemeContext';
import { 
  X, 
  Edit2, 
  Trash2, 
  Plus, 
  Upload, 
  Download, 
  Search,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterMapping {
  id: number;
  label: string;
  address: number;
  numRegisters: number;
  functionCode: number;
  registerType?: number;
  dataType: number;
  byteOrder?: number;
  wordOrder?: number;
  accessMode?: number;
  scaleFactor: number;
  offset: number;
  unit?: string;
  decimalPlaces?: number;
  category?: string;
  highAlarmThreshold?: number | null;
  lowAlarmThreshold?: number | null;
  description?: string;
  enabled: boolean;
}

export interface SlaveFormData {
  slave_id: string;
  device_name: string;
  polling_interval_ms: number;
  timeout_ms: number;
  priority?: number;
  enabled: boolean;
  registers: RegisterMapping[];
}

interface SlaveConfigModalProps {
  open: boolean;
  /** null = create mode, set = edit mode */
  editingSlave: { id: number; slaveId: number; deviceName: string } | null;
  /** existing slave IDs for uniqueness validation (create mode only) */
  existingSlaveIds: number[];
  /** initial form values when opening in edit mode */
  initialForm?: SlaveFormData;
  /** called with the built SlaveFormData payload; parent does the API call */
  onSave: (data: SlaveFormData) => void;
  onCancel: () => void;
  /** optional error from parent's API call */
  error?: string | null;
  onClearError?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_TYPE_NAMES: Record<number, string> = {
  0: 'UINT16', 1: 'INT16', 2: 'UINT32', 3: 'INT32',
  4: 'FLOAT32', 5: 'UINT64', 6: 'INT64', 7: 'FLOAT64',
  8: 'BOOL', 9: 'STRING',
};
const getDataTypeName = (dt: number) =>
  DATA_TYPE_NAMES[dt] ?? `Unknown (${dt})`;

const TEMPLATE_HEADERS =
  'label,address,num_registers,function_code,register_type,data_type,byte_order,word_order,access_mode,scale_factor,offset,unit,decimal_places,category,high_alarm_threshold,low_alarm_threshold,description,enabled';

const BLANK_SLAVE_FORM: SlaveFormData = {
  slave_id: '',
  device_name: '',
  polling_interval_ms: 5000,
  timeout_ms: 1000,
  priority: 1,
  enabled: true,
  registers: [],
};

const BLANK_REG_FORM = {
  label: '',
  address: 0,
  num_registers: 1,
  function_code: 3,
  register_type: 3,
  data_type: 0,
  byte_order: 0,
  word_order: 0,
  access_mode: 0,
  scale_factor: 1.0,
  offset: 0.0,
  unit: '',
  decimal_places: 2,
  category: 'Electrical',
  high_alarm_threshold: null as number | null,
  low_alarm_threshold: null as number | null,
  description: '',
  enabled: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

const SlaveConfigModal: React.FC<SlaveConfigModalProps> = ({
  open,
  editingSlave,
  existingSlaveIds,
  initialForm,
  onSave,
  onCancel,
  error,
  onClearError,
}) => {
  const { isDark } = useTheme();

  const [slaveForm, setSlaveForm] = useState<SlaveFormData>(
    initialForm ?? BLANK_SLAVE_FORM
  );
  const [registerForm, setRegisterForm] = useState({ ...BLANK_REG_FORM });
  const [registerSearch, setRegisterSearch] = useState('');
  const [editingRegisterIndex, setEditingRegisterIndex] = useState<number | null>(null);

  // Bulk upload
  interface BulkUploadRow { rowIndex: number; register: RegisterMapping; }
  interface BulkUploadError { rowIndex: number; message: string; }
  interface BulkUploadResult { valid: BulkUploadRow[]; errors: BulkUploadError[]; }
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Keep form in sync when parent opens modal with new initialForm
  React.useEffect(() => {
    if (open) {
      setSlaveForm(initialForm ?? BLANK_SLAVE_FORM);
      setRegisterForm({ ...BLANK_REG_FORM });
      setRegisterSearch('');
      setEditingRegisterIndex(null);
      setBulkResult(null);
    }
  }, [open, initialForm]);

  // ── Register helpers ────────────────────────────────────────────────────────

  const resetRegisterForm = () => {
    setRegisterForm({ ...BLANK_REG_FORM });
    setEditingRegisterIndex(null);
  };

  const buildRegister = (existingId?: number): RegisterMapping => ({
    id: existingId ?? Date.now(),
    label: registerForm.label,
    address: registerForm.address,
    numRegisters: registerForm.num_registers,
    functionCode: registerForm.function_code,
    registerType: registerForm.register_type,
    dataType: registerForm.data_type,
    byteOrder: registerForm.byte_order,
    wordOrder: registerForm.word_order,
    accessMode: registerForm.access_mode,
    scaleFactor: registerForm.scale_factor,
    offset: registerForm.offset,
    unit: registerForm.unit,
    decimalPlaces: registerForm.decimal_places,
    category: registerForm.category,
    highAlarmThreshold: registerForm.high_alarm_threshold,
    lowAlarmThreshold: registerForm.low_alarm_threshold,
    description: registerForm.description,
    enabled: registerForm.enabled,
  });

  const addOrUpdateRegister = () => {
    if (editingRegisterIndex !== null) {
      const updated = slaveForm.registers.map((r, i) =>
        i === editingRegisterIndex
          ? buildRegister(slaveForm.registers[editingRegisterIndex].id)
          : r
      );
      setSlaveForm({ ...slaveForm, registers: updated });
    } else {
      setSlaveForm({ ...slaveForm, registers: [...slaveForm.registers, buildRegister()] });
    }
    resetRegisterForm();
  };

  const startEditRegister = (index: number) => {
    const reg = slaveForm.registers[index];
    setRegisterForm({
      label: reg.label,
      address: reg.address,
      num_registers: reg.numRegisters,
      function_code: reg.functionCode,
      register_type: reg.registerType ?? 3,
      data_type: reg.dataType,
      byte_order: reg.byteOrder ?? 0,
      word_order: reg.wordOrder ?? 0,
      access_mode: reg.accessMode ?? 0,
      scale_factor: reg.scaleFactor,
      offset: reg.offset,
      unit: reg.unit ?? '',
      decimal_places: reg.decimalPlaces ?? 2,
      category: reg.category ?? 'Electrical',
      high_alarm_threshold: reg.highAlarmThreshold ?? null,
      low_alarm_threshold: reg.lowAlarmThreshold ?? null,
      description: reg.description ?? '',
      enabled: reg.enabled,
    });
    setEditingRegisterIndex(index);
    document
      .querySelector('.register-form-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const removeRegister = (index: number) => {
    if (editingRegisterIndex === index) resetRegisterForm();
    setSlaveForm({
      ...slaveForm,
      registers: slaveForm.registers.filter((_, i) => i !== index),
    });
  };

  const toggleRegisterEnabled = (index: number) => {
    setSlaveForm({
      ...slaveForm,
      registers: slaveForm.registers.map((r, i) =>
        i === index ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  // ── Bulk upload ─────────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    let csv = TEMPLATE_HEADERS + '\n';
    if (slaveForm.registers.length > 0) {
      csv += slaveForm.registers
        .map((r) =>
          [
            r.label, r.address, r.numRegisters, r.functionCode,
            r.registerType ?? 3, r.dataType, r.byteOrder ?? 0,
            r.wordOrder ?? 0, r.accessMode ?? 0, r.scaleFactor,
            r.offset, r.unit ?? '', r.decimalPlaces ?? 2,
            r.category ?? '', r.highAlarmThreshold ?? '',
            r.lowAlarmThreshold ?? '', r.description ?? '', r.enabled,
          ].join(',')
        )
        .join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registers_${slaveForm.device_name || 'slave'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid: BulkUploadRow[] = [];
    const errors: BulkUploadError[] = [];

    const parseRows = (rows: string[][]): void => {
      rows.forEach((cols, rowIndex) => {
        const errs: string[] = [];
        const label = cols[0]?.trim();
        if (!label) errs.push('label is required');
        const address = Number(cols[1]);
        if (isNaN(address)) errs.push('address must be a number');
        const numRegisters = cols[2] !== '' ? Number(cols[2]) : 1;
        if (isNaN(numRegisters) || numRegisters < 1 || numRegisters > 125)
          errs.push('num_registers must be 1–125');
        const functionCode = cols[3] !== '' ? Number(cols[3]) : 3;
        if (isNaN(functionCode)) errs.push('function_code must be a number');
        const registerType = cols[4] !== '' ? Number(cols[4]) : 3;
        const dataType = cols[5] !== '' ? Number(cols[5]) : 0;
        if (isNaN(dataType)) errs.push('data_type must be a number');
        const scaleFactor = cols[9] !== '' ? Number(cols[9]) : 1;
        const offset = cols[10] !== '' ? Number(cols[10]) : 0;
        const enabled =
          cols[17] !== undefined
            ? cols[17].toString().toLowerCase() !== 'false' &&
              cols[17] !== '0'
            : true;
        if (errs.length) {
          errors.push({
            rowIndex: rowIndex + 2,
            message: `Row ${rowIndex + 2}: ${errs.join('; ')}`,
          });
        } else {
          valid.push({
            rowIndex: rowIndex + 2,
            register: {
              id: Date.now() + rowIndex,
              label,
              address,
              numRegisters,
              functionCode,
              registerType,
              dataType,
              byteOrder: Number(cols[6]) || 0,
              wordOrder: Number(cols[7]) || 0,
              accessMode: Number(cols[8]) || 0,
              scaleFactor,
              offset,
              unit: cols[11]?.trim() || '',
              decimalPlaces: cols[12] !== '' ? Number(cols[12]) : 2,
              category: cols[13]?.trim() || 'Electrical',
              highAlarmThreshold: cols[14] ? Number(cols[14]) : null,
              lowAlarmThreshold: cols[15] ? Number(cols[15]) : null,
              description: cols[16]?.trim() || '',
              enabled,
            },
          });
        }
      });
    };

    if (file.name.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      parseRows(data.slice(1));
    } else {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      parseRows(lines.slice(1).map((l) => l.split(',')));
    }
    setBulkResult({ valid, errors });
  };

  const addBulkRegisters = () => {
    if (!bulkResult || bulkResult.valid.length === 0) return;
    let toAdd = bulkResult.valid.map((r) => r.register);
    if (skipDuplicates) {
      const existing = new Set(
        slaveForm.registers.map((r) => `${r.address}:${r.functionCode}`)
      );
      toAdd = toAdd.filter(
        (r) => !existing.has(`${r.address}:${r.functionCode}`)
      );
    }
    setSlaveForm({ ...slaveForm, registers: [...slaveForm.registers, ...toAdd] });
    setBulkResult(null);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!editingSlave) {
      const slaveId = parseInt(slaveForm.slave_id);
      if (existingSlaveIds.includes(slaveId)) {
        // Surface via error prop — parent sets it
        onSave({ ...slaveForm, slave_id: slaveForm.slave_id }); // let parent validate
        return;
      }
    }
    onSave(slaveForm);
  };

  // ── Filtered registers ──────────────────────────────────────────────────────

  const q = registerSearch.toLowerCase();
  const visibleCount = q
    ? slaveForm.registers.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          String(r.address).includes(q)
      ).length
    : slaveForm.registers.length;

  if (!open) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  };

  const modalContainerStyle: React.CSSProperties = {
    background: isDark ? '#1a1a1a' : '#ffffff',
    borderRadius: 16,
    boxShadow: isDark 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    maxWidth: '1200px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const sectionCardStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: '20px',
    marginBottom: 16,
    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    transition: 'all 0.2s ease',
  };

  const sectionTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  };

  const accentBarStyle: React.CSSProperties = {
    width: 4,
    height: 20,
    borderRadius: 3,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    flexShrink: 0,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: isDark ? '#a5b4fc' : '#6366f1',
  };

  const rowSeparatorStyle: React.CSSProperties = {
    borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    margin: '16px 0',
  };

  const formGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.813rem',
    fontWeight: 600,
    color: isDark ? '#d1d5db' : '#374151',
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
    background: isDark ? '#2a2a2a' : '#ffffff',
    color: isDark ? '#f3f4f6' : '#111827',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease',
  };

  return ReactDOM.createPortal(
    <div style={backdropStyle} onClick={onCancel}>
      <div style={modalContainerStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── Modal Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              }}
            >
              {editingSlave ? (
                <Settings size={24} color="white" />
              ) : (
                <Plus size={24} color="white" />
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.2, color: isDark ? '#f9fafb' : '#111827' }}>
                {editingSlave
                  ? `Edit Slave: ${editingSlave.deviceName}`
                  : 'Configure New Slave'}
              </div>
              <div style={{ fontSize: '0.875rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 4 }}>
                {editingSlave ? 'Update slave device settings and registers' : 'Add a new Modbus slave device'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: 'none',
              background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#9ca3af' : '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* Error banner */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '14px 16px',
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                borderLeft: '4px solid #ef4444',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <AlertCircle size={20} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.875rem', color: isDark ? '#fca5a5' : '#991b1b' }}>
                <strong>Error:</strong> {error}
              </div>
              {onClearError && (
                <button
                  onClick={onClearError}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isDark ? '#fca5a5' : '#991b1b',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                  title="Dismiss"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

            {/* ── Section 1: Basic Info ── */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                <div style={accentBarStyle} />
                <span style={sectionLabelStyle}>Basic Information</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Slave ID</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={slaveForm.slave_id}
                    onChange={(e) =>
                      setSlaveForm({ ...slaveForm, slave_id: e.target.value })
                    }
                    required
                    min="1"
                    max="247"
                    placeholder="1-247"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <div style={{ marginTop: 4 }}>
                    <small style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Unique identifier (1–247)
                    </small>
                    {existingSlaveIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {existingSlaveIds.map((sid) => (
                          <span
                            key={sid}
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 12,
                              background: '#6366f1',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {sid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Device Name</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={slaveForm.device_name}
                    onChange={(e) =>
                      setSlaveForm({ ...slaveForm, device_name: e.target.value })
                    }
                    required
                    placeholder="e.g., Solar Inverter"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: Communication ── */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                <div style={accentBarStyle} />
                <span style={sectionLabelStyle}>Communication Settings</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'start' }}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Polling Interval (ms)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={slaveForm.polling_interval_ms}
                    onChange={(e) =>
                      setSlaveForm({
                        ...slaveForm,
                        polling_interval_ms: parseInt(e.target.value),
                      })
                    }
                    min="100"
                    placeholder="10000"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <small style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>How often to poll</small>
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Response Timeout (ms)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={slaveForm.timeout_ms}
                    onChange={(e) =>
                      setSlaveForm({
                        ...slaveForm,
                        timeout_ms: parseInt(e.target.value),
                      })
                    }
                    min="100"
                    placeholder="1000"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <small style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>Max wait for response</small>
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Priority</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={slaveForm.priority || 1}
                    onChange={(e) =>
                      setSlaveForm({
                        ...slaveForm,
                        priority: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="10"
                    placeholder="1"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <small style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>1=Highest, 10=Lowest</small>
                </div>
                <div style={{ ...formGroupStyle, alignItems: 'center', paddingTop: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>Status</label>
                  {/* Pill toggle */}
                  <div
                    onClick={() => setSlaveForm({ ...slaveForm, enabled: !slaveForm.enabled })}
                    style={{
                      width: 52,
                      height: 28,
                      borderRadius: 14,
                      background: slaveForm.enabled ? '#22c55e' : (isDark ? '#374151' : '#d1d5db'),
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                      flexShrink: 0,
                      boxShadow: slaveForm.enabled ? '0 0 0 3px rgba(34, 197, 94, 0.2)' : 'none',
                    }}
                    title={slaveForm.enabled ? 'Click to disable' : 'Click to enable'}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: slaveForm.enabled ? 26 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {slaveForm.enabled ? (
                        <CheckCircle2 size={14} color="#22c55e" />
                      ) : (
                        <XCircle size={14} color={isDark ? '#6b7280' : '#9ca3af'} />
                      )}
                    </div>
                  </div>
                  <small style={{ fontSize: '0.75rem', color: slaveForm.enabled ? '#22c55e' : (isDark ? '#9ca3af' : '#6b7280'), marginTop: 6, fontWeight: 600 }}>
                    {slaveForm.enabled ? 'Enabled' : 'Disabled'}
                  </small>
                </div>
              </div>
            </div>

            {/* ── Section 3: Register Mappings ── */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                <div style={accentBarStyle} />
                <span style={sectionLabelStyle}>Register Mappings</span>
              </div>

              {/* Add / Edit Register sub-form */}
              <div
                className="register-form-section"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 10,
                  padding: '18px 20px',
                  marginBottom: 16,
                  border: editingRegisterIndex !== null
                    ? '2px solid rgba(245, 158, 11, 0.6)'
                    : (isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'),
                  borderLeft: editingRegisterIndex !== null ? '4px solid #f59e0b' : undefined,
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 14, color: isDark ? '#f3f4f6' : '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRegisterIndex !== null ? (
                    <>
                      <Edit2 size={16} color="#f59e0b" />
                      Edit Register: {slaveForm.registers[editingRegisterIndex]?.label}
                    </>
                  ) : (
                    <>
                      <Plus size={16} color="#6366f1" />
                      Add New Register
                    </>
                  )}
                </div>

                {/* Row 1 — Identity */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Label *</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="e.g., Battery_Voltage"
                      value={registerForm.label}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, label: e.target.value })
                      }
                      required
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Address *</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="40001"
                      value={registerForm.address}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          address: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      required
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Count</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="1"
                      value={registerForm.num_registers || 1}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          num_registers: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      max="125"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Function Code *</label>
                    <select
                      style={inputStyle}
                      value={registerForm.function_code || 3}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          function_code: parseInt(e.target.value),
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value={0x01}>0x01 - Read Coils</option>
                      <option value={0x02}>0x02 - Read Discrete Inputs</option>
                      <option value={0x03}>0x03 - Read Holding Registers</option>
                      <option value={0x04}>0x04 - Read Input Registers</option>
                      <option value={0x05}>0x05 - Write Single Coil</option>
                      <option value={0x06}>0x06 - Write Single Register</option>
                      <option value={0x0f}>0x0F - Write Multiple Coils</option>
                      <option value={0x10}>0x10 - Write Multiple Registers</option>
                    </select>
                  </div>
                </div>

                <div style={rowSeparatorStyle} />

                {/* Row 2 — Data Format */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr 2fr', gap: 12 }}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Data Type *</label>
                    <select
                      style={inputStyle}
                      value={registerForm.data_type}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          data_type: parseInt(e.target.value),
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value={0}>UINT16 (16-bit Unsigned)</option>
                      <option value={1}>INT16 (16-bit Signed)</option>
                      <option value={2}>UINT32 (32-bit Unsigned)</option>
                      <option value={3}>INT32 (32-bit Signed)</option>
                      <option value={4}>FLOAT32 (32-bit Float)</option>
                      <option value={5}>UINT64 (64-bit Unsigned)</option>
                      <option value={6}>INT64 (64-bit Signed)</option>
                      <option value={7}>FLOAT64 (64-bit Float)</option>
                      <option value={8}>BOOL (Single Bit)</option>
                      <option value={9}>STRING (ASCII)</option>
                    </select>
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Byte Order</label>
                    <select
                      style={inputStyle}
                      value={registerForm.byte_order || 0}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          byte_order: parseInt(e.target.value),
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value={0}>Big Endian (ABCD)</option>
                      <option value={1}>Little Endian (DCBA)</option>
                    </select>
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Word Order</label>
                    <select
                      style={inputStyle}
                      value={registerForm.word_order || 0}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          word_order: parseInt(e.target.value),
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value={0}>Big Endian (AB CD)</option>
                      <option value={1}>Little Endian (CD AB)</option>
                      <option value={2}>Mid-Big Endian (BA DC)</option>
                      <option value={3}>Mid-Little Endian (DC BA)</option>
                    </select>
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Dec. Places</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="2"
                      value={registerForm.decimal_places || 2}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          decimal_places: parseInt(e.target.value),
                        })
                      }
                      min="0"
                      max="6"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Access Mode</label>
                    <select
                      style={inputStyle}
                      value={registerForm.access_mode || 0}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          access_mode: parseInt(e.target.value),
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value={0}>Read Only</option>
                      <option value={1}>Read/Write</option>
                      <option value={2}>Write Only</option>
                    </select>
                  </div>
                </div>

                <div style={rowSeparatorStyle} />

                {/* Row 3 — Scaling */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Scale Factor</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="1.0"
                      value={registerForm.scale_factor}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          scale_factor: parseFloat(e.target.value),
                        })
                      }
                      step="0.001"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Offset</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="0.0"
                      value={registerForm.offset}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          offset: parseFloat(e.target.value),
                        })
                      }
                      step="0.01"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Unit</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="V, A, W, °C…"
                      value={registerForm.unit || ''}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, unit: e.target.value })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Category</label>
                    <select
                      style={inputStyle}
                      value={registerForm.category || 'Grid'}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          category: e.target.value,
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value="Grid">Grid</option>
                      <option value="BMS">BMS</option>
                      <option value="Status">Status</option>
                      <option value="Energy">Energy</option>
                      <option value="Temperature">Temperature</option>
                      <option value="Battery">Battery</option>
                      <option value="Load">Load</option>
                      <option value="PV">PV</option>
                    </select>
                  </div>
                </div>

                <div style={rowSeparatorStyle} />

                {/* Row 4 — Alarms & Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 140px 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>High Alarm</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="Optional"
                      value={registerForm.high_alarm_threshold || ''}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          high_alarm_threshold: parseFloat(e.target.value) || null,
                        })
                      }
                      step="0.01"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Low Alarm</label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="Optional"
                      value={registerForm.low_alarm_threshold || ''}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          low_alarm_threshold: parseFloat(e.target.value) || null,
                        })
                      }
                      step="0.01"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Description</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="e.g., 0=Off, 1=On, 2=Standby"
                      value={registerForm.description || ''}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          description: e.target.value,
                        })
                      }
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  {/* Register enabled pill toggle */}
                  <div style={{ ...formGroupStyle, alignItems: 'center' }}>
                    <label style={{ ...labelStyle, marginBottom: 8 }}>Enabled</label>
                    <div
                      onClick={() =>
                        setRegisterForm({ ...registerForm, enabled: !registerForm.enabled })
                      }
                      style={{
                        width: 52,
                        height: 28,
                        borderRadius: 14,
                        background: registerForm.enabled ? '#22c55e' : (isDark ? '#374151' : '#d1d5db'),
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s ease',
                        boxShadow: registerForm.enabled ? '0 0 0 3px rgba(34, 197, 94, 0.2)' : 'none',
                      }}
                      title={registerForm.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: registerForm.enabled ? 26 : 2,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {registerForm.enabled ? (
                          <CheckCircle2 size={14} color="#22c55e" />
                        ) : (
                          <XCircle size={14} color={isDark ? '#6b7280' : '#9ca3af'} />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Add/Update + Cancel buttons */}
                  <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={addOrUpdateRegister}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.3)';
                      }}
                    >
                      {editingRegisterIndex !== null ? (
                        <>
                          <CheckCircle2 size={16} />
                          Update Register
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Add Register
                        </>
                      )}
                    </button>
                    {editingRegisterIndex !== null && (
                      <button
                        type="button"
                        onClick={resetRegisterForm}
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          color: isDark ? '#d1d5db' : '#374151',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 16px',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Upload */}
              <div
                style={{
                  background: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.05)',
                  borderRadius: 10,
                  padding: '16px 18px',
                  marginBottom: 16,
                  border: isDark ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(139, 92, 246, 0.15)',
                }}
              >
                <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>
                  <Upload size={18} color="#8b5cf6" />
                  <span style={{ ...sectionLabelStyle, color: '#8b5cf6' }}>Bulk Upload Registers</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)',
                      color: isDark ? '#e5e7eb' : '#374151',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Download size={16} />
                    {slaveForm.registers.length > 0
                      ? `Export ${slaveForm.registers.length} Registers`
                      : 'Download Template'}
                  </button>
                  <input
                    ref={bulkFileRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleBulkFileChange}
                    style={{
                      fontSize: '0.875rem',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb'}`,
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      color: isDark ? '#e5e7eb' : 'inherit',
                      cursor: 'pointer',
                    }}
                  />
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      color: isDark ? '#d1d5db' : '#374151',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    Skip duplicates
                  </label>
                </div>

                {bulkResult && (
                  <div style={{ marginTop: 12 }}>
                    {/* Status line */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: '0.875rem',
                        padding: '6px 14px',
                        borderRadius: 20,
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)',
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                        {bulkResult.valid.length + bulkResult.errors.length} rows parsed
                      </span>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>
                        {bulkResult.valid.length} valid
                      </span>
                      {bulkResult.errors.length > 0 && (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>
                          {bulkResult.errors.length} invalid
                        </span>
                      )}
                    </div>
                    {bulkResult.errors.length > 0 && (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: '10px 12px',
                          background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                          borderLeft: '3px solid #ef4444',
                          borderRadius: 8,
                          color: isDark ? '#fca5a5' : '#991b1b',
                          fontSize: '0.8rem',
                          maxHeight: 120,
                          overflowY: 'auto',
                        }}
                      >
                        {bulkResult.errors.slice(0, 10).map((err, i) => (
                          <div key={i} style={{ marginBottom: 3 }}>{err.message}</div>
                        ))}
                        {bulkResult.errors.length > 10 && (
                          <div>…and {bulkResult.errors.length - 10} more errors</div>
                        )}
                      </div>
                    )}
                    {bulkResult.valid.length > 0 && (
                      <button
                        type="button"
                        onClick={addBulkRegisters}
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.3)';
                        }}
                      >
                        <CheckCircle2 size={16} />
                        Add {bulkResult.valid.length} valid register{bulkResult.valid.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Registers Table */}
              {slaveForm.registers.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: isDark ? '#f3f4f6' : '#111827' }}>
                      Configured Registers ({slaveForm.registers.length}
                      {registerSearch ? ` · ${visibleCount} shown` : ''})
                    </span>
                    <div style={{ position: 'relative' }}>
                      <Search 
                        size={16} 
                        color={isDark ? '#9ca3af' : '#6b7280'}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                      />
                      <input
                        type="text"
                        placeholder="Search by label or address…"
                        value={registerSearch}
                        onChange={(e) => setRegisterSearch(e.target.value)}
                        style={{
                          padding: '8px 12px 8px 36px',
                          borderRadius: 8,
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb'}`,
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          color: isDark ? '#e5e7eb' : 'inherit',
                          fontSize: '0.875rem',
                          minWidth: 240,
                          transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#6366f1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div style={{
                    overflowX: 'auto',
                    overflowY: 'auto',
                    maxHeight: 320,
                    borderRadius: 10,
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                  }}>
                    <table style={{ 
                      width: '100%', 
                      fontSize: '0.875rem',
                      borderCollapse: 'collapse',
                    }}>
                      <thead>
                        <tr style={{
                          background: isDark ? '#242424' : '#f9fafb',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Label</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Address</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Function</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Data Type</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Unit</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Scale</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Offset</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Category</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Alarms</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slaveForm.registers.map((reg, index) => {
                          if (
                            q &&
                            !reg.label.toLowerCase().includes(q) &&
                            !String(reg.address).includes(q)
                          )
                            return null;
                          return (
                            <tr
                              key={index}
                              style={{
                                borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
                                background: editingRegisterIndex === index
                                  ? (isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)')
                                  : 'transparent',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (editingRegisterIndex !== index) {
                                  e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (editingRegisterIndex !== index) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <td style={{ padding: '12px 16px', color: isDark ? '#f3f4f6' : '#111827', fontWeight: 500 }}>{reg.label}</td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.address}</td>
                              <td style={{ padding: '12px 16px', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.functionCode || 3}</td>
                              <td style={{ padding: '12px 16px', color: isDark ? '#e5e7eb' : '#374151' }}>{getDataTypeName(reg.dataType)}</td>
                              <td style={{ padding: '12px 16px', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.unit || '-'}</td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.scaleFactor}</td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.offset}</td>
                              <td style={{ padding: '12px 16px', color: isDark ? '#e5e7eb' : '#374151' }}>{reg.category || '-'}</td>
                              <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                                {reg.highAlarmThreshold || reg.lowAlarmThreshold ? (
                                  <>
                                    {reg.highAlarmThreshold && `H:${reg.highAlarmThreshold}`}
                                    {reg.highAlarmThreshold && reg.lowAlarmThreshold && ' / '}
                                    {reg.lowAlarmThreshold && `L:${reg.lowAlarmThreshold}`}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  onClick={() => toggleRegisterEnabled(index)}
                                  title={reg.enabled ? 'Click to disable' : 'Click to enable'}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 10px',
                                    borderRadius: 12,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    background: reg.enabled 
                                      ? 'rgba(34, 197, 94, 0.15)' 
                                      : (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'),
                                    color: reg.enabled ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${reg.enabled ? '#22c55e' : '#ef4444'}`,
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {reg.enabled ? (
                                    <>
                                      <CheckCircle2 size={12} />
                                      Enabled
                                    </>
                                  ) : (
                                    <>
                                      <XCircle size={12} />
                                      Disabled
                                    </>
                                  )}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => startEditRegister(index)}
                                    title="Edit register"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      border: 'none',
                                      background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                      color: '#6366f1',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.2)';
                                      e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeRegister(index)}
                                    title="Remove"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      border: 'none',
                                      background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)';
                                      e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 10,
                  border: isDark ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px dashed rgba(0, 0, 0, 0.1)',
                }}>
                  <Settings size={32} color={isDark ? '#6b7280' : '#9ca3af'} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '0.875rem' }}>
                    No registers configured yet. Add registers above to define what data to read from this slave device.
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
            padding: '20px 28px',
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <button 
            type="button" 
            onClick={onCancel}
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#d1d5db' : '#374151',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.4)';
            }}
          >
            {editingSlave ? 'Save Changes' : 'Create Slave'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SlaveConfigModal;
