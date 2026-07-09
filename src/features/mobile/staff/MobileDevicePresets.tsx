import { useEffect, useState } from 'react';
import { Layers, Menu, Plus, Search, Settings, Eye, Pencil, Trash2, X, PlugZap, RefreshCw } from 'lucide-react';
import finalLogo from '../../../assets/finalLogo.png';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';

interface Preset {
  id: number;
  config_id: string;
  name: string;
  description: string;
  gateway_configuration: {
    general_settings: { config_id: string; last_updated: string };
    uart_configuration: { baud_rate: number; data_bits: number; stop_bits: number; parity: string };
  };
  slaves_count: number;
}

interface SlaveDevice {
  id: number;
  slaveId: number;
  deviceName: string;
  pollingIntervalMs: number;
  timeoutMs: number;
  enabled: boolean;
}

interface SlaveFormState {
  slave_id: string;
  device_name: string;
  polling_interval_ms: number;
  timeout_ms: number;
  enabled: boolean;
  registers: any[];
}

export default function MobileDevicePresets() {
  const { isDark } = useTheme();
  const bg = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const muted = 'var(--muted-foreground)';
  const accent = '#2FBF71';

  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Preset | null>(null);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [form, setForm] = useState({ name: '', description: '', baud_rate: 9600, data_bits: 8, stop_bits: 1, parity: 0 });
  const [presetSlaves, setPresetSlaves] = useState<Record<string, SlaveDevice[]>>({});
  const [slavesLoading, setSlavesLoading] = useState<string | null>(null);
  const [createPresetSlaveMode, setCreatePresetSlaveMode] = useState<'none' | 'create' | 'select'>('none');
  const [globalSlaves, setGlobalSlaves] = useState<SlaveDevice[]>([]);
  const [globalSlavesLoading, setGlobalSlavesLoading] = useState(false);
  const [selectedGlobalSlaveIds, setSelectedGlobalSlaveIds] = useState<number[]>([]);
  const [slaveSearch, setSlaveSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [slaveForm, setSlaveForm] = useState<SlaveFormState>({
    slave_id: '',
    device_name: '',
    polling_interval_ms: 5000,
    timeout_ms: 1000,
    enabled: true,
    registers: [],
  });

  async function fetchPresets(q = search) {
    setLoading(true);
    try {
      const response = await apiService.getPresets(q, 1, 100);
      setPresets(response.results ?? response ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPresets(); }, []);
  useEffect(() => {
    const id = setTimeout(() => fetchPresets(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  function openCreate() {
    setForm({ name: '', description: '', baud_rate: 9600, data_bits: 8, stop_bits: 1, parity: 0 });
    setFormError('');
    setCreatePresetSlaveMode('none');
    setSelectedGlobalSlaveIds([]);
    setSlaveSearch('');
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      enabled: true,
      registers: [],
    });
    setCreating(true);
  }

  function openEdit(preset: Preset) {
    setFormError('');
    setEditing(preset);
    setForm({
      name: preset.name,
      description: preset.description,
      baud_rate: preset.gateway_configuration?.uart_configuration?.baud_rate ?? 9600,
      data_bits: preset.gateway_configuration?.uart_configuration?.data_bits ?? 8,
      stop_bits: preset.gateway_configuration?.uart_configuration?.stop_bits ?? 1,
      parity: preset.gateway_configuration?.uart_configuration?.parity === 'Odd' ? 1 : preset.gateway_configuration?.uart_configuration?.parity === 'Even' ? 2 : 0,
    });
  }

  async function savePreset() {
    setFormError('');
    setSaving(true);
    try {
      if (creating) {
        const result = await apiService.createPreset(form);
        const createdConfigId =
          result?.gateway_configuration?.general_settings?.config_id ||
          result?.config_id ||
          result?.configId ||
          '';

        if (!createdConfigId && createPresetSlaveMode !== 'none') {
          throw new Error('Preset created, but no config ID was returned for slave setup.');
        }

        if (createPresetSlaveMode === 'create') {
          if (!slaveForm.slave_id || !slaveForm.device_name.trim()) {
            throw new Error('Slave ID and device name are required.');
          }
          await apiService.createSlave(createdConfigId, {
            slave_id: parseInt(slaveForm.slave_id, 10),
            device_name: slaveForm.device_name.trim(),
            polling_interval_ms: slaveForm.polling_interval_ms,
            timeout_ms: slaveForm.timeout_ms,
            enabled: slaveForm.enabled,
            registers: slaveForm.registers,
          });
        }

        if (createPresetSlaveMode === 'select' && selectedGlobalSlaveIds.length > 0) {
          await apiService.addSlavesToPreset(createdConfigId, selectedGlobalSlaveIds);
        }
      }

      if (editing) {
        await apiService.updatePreset(editing.id, { ...form, config_id: editing.gateway_configuration.general_settings.config_id });
      }

      setCreating(false);
      setEditing(null);
      fetchPresets();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  }

  async function deletePreset() {
    if (!deleteTarget) return;
    await apiService.deletePreset(deleteTarget.id);
    setDeleteTarget(null);
    fetchPresets();
  }

  async function loadSlaves(preset: Preset, force = false) {
    const configId = preset.gateway_configuration?.general_settings?.config_id || preset.config_id;
    if (!force && presetSlaves[configId] && slavesLoading !== configId) {
      setSelected(preset);
      return;
    }
    setSlavesLoading(configId);
    try {
      const response = await apiService.getSlaves(configId);
      setPresetSlaves(prev => ({ ...prev, [configId]: Array.isArray(response) ? response : [] }));
      setSelected(preset);
    } finally {
      setSlavesLoading(null);
    }
  }

  useEffect(() => {
    if (!creating || createPresetSlaveMode !== 'select') return;
    let cancelled = false;
    setGlobalSlavesLoading(true);
    apiService.getGlobalSlaves()
      .then((data) => {
        if (cancelled) return;
        setGlobalSlaves(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setGlobalSlaves([]);
      })
      .finally(() => {
        if (!cancelled) setGlobalSlavesLoading(false);
      });
    return () => { cancelled = true; };
  }, [creating, createPresetSlaveMode]);

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
            <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Device Presets</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: text, marginTop: 2 }}>{presets.length} templates</div>
          </div>
          <button onClick={openCreate} style={{ background: accent, border: 'none', borderRadius: 10, color: '#fff', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 700 }}>
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search presets..." style={{ width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 36px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text, fontSize: '0.82rem' }} />
        </div>
        {loading ? <div style={{ color: muted, fontSize: '0.8rem', padding: '20px 4px' }}>Loading presets...</div> : presets.map(preset => (
          <div key={preset.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(47,191,113,0.12)', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: text }}>{preset.name}</div>
                {preset.description && <div style={{ fontSize: '0.72rem', color: muted, marginTop: 3, lineHeight: 1.45 }}>{preset.description}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', fontSize: '0.68rem', color: text }}>{preset.config_id}</span>
              <span style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', fontSize: '0.68rem', color: text }}>{preset.gateway_configuration?.uart_configuration?.baud_rate} baud</span>
              <span style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', fontSize: '0.68rem', color: text }}>{preset.slaves_count || 0} slaves</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 12 }}>
              <button onClick={() => loadSlaves(preset)} style={{ padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={14} /></button>
              <button onClick={() => openEdit(preset)} style={{ padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={14} /></button>
              <button onClick={() => loadSlaves(preset)} style={{ padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Settings size={14} /></button>
              <button onClick={() => setDeleteTarget(preset)} style={{ padding: '10px 0', borderRadius: 10, border: `1px solid rgba(239,68,68,0.18)`, background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={() => { setCreating(false); setEditing(null); }}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', borderRadius: '20px 20px 0 0', padding: '18px 16px 28px', width: '100%', border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: text }}>{creating ? 'New preset' : 'Edit preset'}</div>
              <button onClick={() => { setCreating(false); setEditing(null); }} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Preset name" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
              <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description" rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text, resize: 'vertical' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="number" value={form.baud_rate} onChange={e => setForm(prev => ({ ...prev, baud_rate: Number(e.target.value) }))} placeholder="Baud rate" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                <select value={form.parity} onChange={e => setForm(prev => ({ ...prev, parity: Number(e.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }}>
                  <option value={0}>None</option>
                  <option value={1}>Odd</option>
                  <option value={2}>Even</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="number" value={form.data_bits} onChange={e => setForm(prev => ({ ...prev, data_bits: Number(e.target.value) }))} placeholder="Data bits" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                <input type="number" value={form.stop_bits} onChange={e => setForm(prev => ({ ...prev, stop_bits: Number(e.target.value) }))} placeholder="Stop bits" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
              </div>
              {creating && (
                <div style={{ display: 'grid', gap: 10, padding: '2px 0 4px' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Initial Slave Setup</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[
                      {
                        key: 'none' as const,
                        title: 'Skip for now',
                        body: 'Create the preset first and attach slaves later.',
                      },
                      {
                        key: 'create' as const,
                        title: 'Create new slave',
                        body: 'Define the first slave during preset creation.',
                      },
                      {
                        key: 'select' as const,
                        title: 'Link existing slave',
                        body: 'Reuse a saved slave configuration.',
                      },
                    ].map(option => (
                      <label key={option.key} style={{
                        display: 'block',
                        borderRadius: 12,
                        border: `1px solid ${createPresetSlaveMode === option.key ? 'rgba(47,191,113,0.32)' : border}`,
                        background: createPresetSlaveMode === option.key ? (isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.05)') : surface,
                        padding: '11px 12px',
                        cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <input
                            type="radio"
                            name="create-preset-slave-mode"
                            checked={createPresetSlaveMode === option.key}
                            onChange={() => setCreatePresetSlaveMode(option.key)}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: text }}>{option.title}</div>
                            <div style={{ fontSize: '0.69rem', color: muted, lineHeight: 1.4, marginTop: 2 }}>{option.body}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {createPresetSlaveMode === 'create' && (
                    <div style={{ display: 'grid', gap: 10, padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <input type="number" value={slaveForm.slave_id} onChange={e => setSlaveForm(prev => ({ ...prev, slave_id: e.target.value }))} placeholder="Slave ID" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                        <input value={slaveForm.device_name} onChange={e => setSlaveForm(prev => ({ ...prev, device_name: e.target.value }))} placeholder="Device name" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <input type="number" value={slaveForm.polling_interval_ms} onChange={e => setSlaveForm(prev => ({ ...prev, polling_interval_ms: Number(e.target.value) || 0 }))} placeholder="Polling ms" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                        <input type="number" value={slaveForm.timeout_ms} onChange={e => setSlaveForm(prev => ({ ...prev, timeout_ms: Number(e.target.value) || 0 }))} placeholder="Timeout ms" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: text }}>
                        <input type="checkbox" checked={slaveForm.enabled} onChange={e => setSlaveForm(prev => ({ ...prev, enabled: e.target.checked }))} />
                        Enabled
                      </label>
                    </div>
                  )}

                  {createPresetSlaveMode === 'select' && (
                    <div style={{ display: 'grid', gap: 8, padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }}>
                      <input value={slaveSearch} onChange={e => setSlaveSearch(e.target.value)} placeholder="Search slave name or ID" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text }} />
                      {globalSlavesLoading ? (
                        <div style={{ fontSize: '0.75rem', color: muted }}>Loading slave library...</div>
                      ) : globalSlaves.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: muted }}>No existing slaves found.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                          {globalSlaves
                            .filter(slave => slave.deviceName.toLowerCase().includes(slaveSearch.toLowerCase()) || String(slave.slaveId).includes(slaveSearch))
                            .map(slave => {
                              const checked = selectedGlobalSlaveIds.includes(slave.id);
                              return (
                                <label key={slave.id} style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '10px 11px',
                                  borderRadius: 10,
                                  border: `1px solid ${checked ? 'rgba(47,191,113,0.28)' : border}`,
                                  background: checked ? (isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.05)') : surface,
                                  cursor: 'pointer',
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedGlobalSlaveIds(prev => e.target.checked ? [...prev, slave.id] : prev.filter(id => id !== slave.id));
                                    }}
                                    style={{ marginTop: 2 }}
                                  />
                                  <div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: text }}>{slave.deviceName}</div>
                                    <div style={{ fontSize: '0.66rem', color: muted }}>Slave ID {slave.slaveId} · Poll {slave.pollingIntervalMs} ms</div>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formError && <div style={{ fontSize: '0.72rem', color: '#ef4444', lineHeight: 1.4 }}>{formError}</div>}
              <button disabled={saving} onClick={savePreset} style={{ padding: 12, borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save preset'}</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 45, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', borderRadius: '20px 20px 0 0', padding: '18px 16px 28px', width: '100%', border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: text }}>{selected.name}</div>
              <button onClick={() => loadSlaves(selected, true)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={14} style={{ animation: slavesLoading === (selected.gateway_configuration?.general_settings?.config_id || selected.config_id) ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: '0.78rem', color: muted }}>Config ID: <span style={{ color: text }}>{selected.config_id}</span></div>
              <div style={{ fontSize: '0.78rem', color: muted }}>UART: <span style={{ color: text }}>{selected.gateway_configuration?.uart_configuration?.baud_rate} baud, {selected.gateway_configuration?.uart_configuration?.data_bits} data bits, {selected.gateway_configuration?.uart_configuration?.stop_bits} stop bit</span></div>
              <div style={{ fontSize: '0.78rem', color: muted }}>Parity: <span style={{ color: text }}>{selected.gateway_configuration?.uart_configuration?.parity}</span></div>
              <div style={{ fontSize: '0.78rem', color: muted }}>Slaves: <span style={{ color: text }}>{selected.slaves_count || 0}</span></div>
              {selected.gateway_configuration?.general_settings?.last_updated && <div style={{ fontSize: '0.78rem', color: muted }}>Updated: <span style={{ color: text }}>{new Date(selected.gateway_configuration.general_settings.last_updated).toLocaleDateString('en-IN')}</span></div>}
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, marginBottom: 8 }}>Slave devices</div>
                {slavesLoading === (selected.gateway_configuration?.general_settings?.config_id || selected.config_id) ? (
                  <div style={{ fontSize: '0.78rem', color: muted }}>Loading slaves...</div>
                ) : (presetSlaves[selected.gateway_configuration?.general_settings?.config_id || selected.config_id] ?? []).length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: muted }}>No slave devices attached.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(presetSlaves[selected.gateway_configuration?.general_settings?.config_id || selected.config_id] ?? []).map((slave) => (
                      <div key={slave.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', borderRadius: 10, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(47,191,113,0.12)', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PlugZap size={14} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: text }}>{slave.deviceName}</div>
                          <div style={{ fontSize: '0.68rem', color: muted }}>ID {slave.slaveId} · Poll {slave.pollingIntervalMs} ms · Timeout {slave.timeoutMs} ms</div>
                        </div>
                        <span style={{ padding: '3px 7px', borderRadius: 999, fontSize: '0.58rem', fontWeight: 700, color: slave.enabled ? accent : 'var(--muted-foreground)', background: slave.enabled ? 'rgba(47,191,113,0.12)' : 'rgba(100,116,139,0.12)' }}>
                          {slave.enabled ? 'On' : 'Off'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', border: `1px solid ${border}`, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text, marginBottom: 8 }}>Delete preset?</div>
            <div style={{ fontSize: '0.82rem', color: muted, lineHeight: 1.5, marginBottom: 16 }}>{deleteTarget.name} will be permanently removed.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: text }}>Cancel</button>
              <button onClick={deletePreset} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
