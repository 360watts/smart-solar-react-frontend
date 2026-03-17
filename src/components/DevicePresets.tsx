import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Eye, Settings, Pencil, Trash2, X, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import SlaveConfigModal, { SlaveFormData } from './SlaveConfigModal';
import { DEFAULT_PAGE_SIZE } from '../constants';

interface Preset {
  id: number;
  config_id: string;
  name: string;
  description: string;
  gateway_configuration: {
    general_settings: {
      config_id: string;
      schema_version: number;
      last_updated: string;
    };
    uart_configuration: {
      baud_rate: number;
      data_bits: number;
      stop_bits: number;
      parity: string;
    };
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
  attached?: boolean;
  registers: RegisterMapping[];
}

interface RegisterMapping {
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

const DevicePresets: React.FC = () => {
  const { isDark } = useTheme();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [filteredPresets, setFilteredPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [configuringSlaves, setConfiguringSlaves] = useState<Preset | null>(null);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [createPresetSlaveMode, setCreatePresetSlaveMode] = useState<'none' | 'create' | 'select'>('none');
  const [globalSlaves, setGlobalSlaves] = useState<SlaveDevice[]>([]);
  const [globalSlavesLoading, setGlobalSlavesLoading] = useState(false);
  const [selectedGlobalSlaveIds, setSelectedGlobalSlaveIds] = useState<number[]>([]);
  const [slaveSearch, setSlaveSearch] = useState('');
  const [editForm, setEditForm] = useState({
    config_id: '',
    name: '',
    description: '',
    baud_rate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: 0,
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    baud_rate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: 0,
  });
  const [slaveForm, setSlaveForm] = useState({
    slave_id: '',
    device_name: '',
    polling_interval_ms: 5000,
    timeout_ms: 1000,
    enabled: true,
    registers: [] as RegisterMapping[]
  });

  const [modalError, setModalError] = useState<string | null>(null);
  const [slaveListSearch, setSlaveListSearch] = useState('');
  const [editPresetSlaveSearch, setEditPresetSlaveSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modern modal states
  const [deletePresetModal, setDeletePresetModal] = useState<{ show: boolean; preset: Preset | null }>({ show: false, preset: null });
  const [deleteSlaveModal, setDeleteSlaveModal] = useState<{ show: boolean; slave: SlaveDevice | null }>({ show: false, slave: null });
  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    if (!creatingPreset || createPresetSlaveMode !== 'select') return;

    const fetchGlobalSlaves = async () => {
      try {
        setGlobalSlavesLoading(true);
        const data = await apiService.getGlobalSlaves();
        const mapped = data.map((slave: any) => ({
          id: slave.id,
          slaveId: slave.slave_id,
          deviceName: slave.device_name,
          pollingIntervalMs: slave.polling_interval_ms,
          timeoutMs: slave.timeout_ms,
          enabled: slave.enabled,
          registers: slave.registers || [],
        }));
        setGlobalSlaves(mapped);
      } catch (err) {
        console.error('Failed to fetch global slaves:', err);
      } finally {
        setGlobalSlavesLoading(false);
      }
    };

    fetchGlobalSlaves();
  }, [creatingPreset, createPresetSlaveMode]);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchPresets(debouncedSearchTerm, currentPage, pageSize);
  }, [debouncedSearchTerm, currentPage, pageSize]);

  useEffect(() => {
    if (!creatingPreset) return;
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      enabled: true,
      registers: [] as RegisterMapping[]
    });
  }, [creatingPreset]);

  const fetchPresets = async (search?: string, page = 1, size = DEFAULT_PAGE_SIZE) => {
    setLoading(true);
    try {
      const response = await apiService.getPresets(search, page, size);
      const list: Preset[] = response.results ?? response;
      setPresets(list);
      setFilteredPresets(list);
      setTotalCount(response.count ?? list.length);
      setTotalPages(response.total_pages ?? 1);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEdit = (preset: Preset) => {
    setEditingPreset(preset);
    setEditForm({
      config_id: preset.gateway_configuration.general_settings.config_id,
      name: preset.name,
      description: preset.description,
      baud_rate: preset.gateway_configuration.uart_configuration.baud_rate,
      data_bits: preset.gateway_configuration.uart_configuration.data_bits,
      stop_bits: preset.gateway_configuration.uart_configuration.stop_bits,
      parity: preset.gateway_configuration.uart_configuration.parity === 'None' ? 0 : 
              preset.gateway_configuration.uart_configuration.parity === 'Odd' ? 1 : 2,
    });
    // Load slaves for this preset so they are visible in the edit modal
    fetchSlavesForPreset(preset.gateway_configuration.general_settings.config_id).catch((e) => {
      console.error('Failed to load slaves for preset edit:', e);
    });
  };

  const handleSave = async () => {
    if (!editingPreset) return;

    try {
      await apiService.updatePreset(editingPreset.id, editForm);
      setEditingPreset(null);
      // Refetch to get the updated preset with all fields
      await fetchPresets(searchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preset');
    }
  };

  const handleCreate = async () => {
    try {
      const result = await apiService.createPreset(createForm);
      const createdConfigId =
        result?.gateway_configuration?.general_settings?.config_id ||
        result?.config_id ||
        result?.configId ||
        '';

      if (!createdConfigId && createPresetSlaveMode !== 'none') {
        setError('Preset created but config id was not returned. Slave setup skipped.');
      }

      if (createdConfigId && createPresetSlaveMode === 'create') {
        if (!slaveForm.slave_id || !slaveForm.device_name) {
          setError('Slave ID and Device Name are required to create a slave.');
          return;
        }
        await apiService.createSlave(createdConfigId, {
          slave_id: parseInt(slaveForm.slave_id),
          device_name: slaveForm.device_name,
          polling_interval_ms: slaveForm.polling_interval_ms,
          timeout_ms: slaveForm.timeout_ms,
          enabled: slaveForm.enabled,
          registers: slaveForm.registers,
        });
      }

      if (createdConfigId && createPresetSlaveMode === 'select' && selectedGlobalSlaveIds.length > 0) {
        await apiService.addSlavesToPreset(createdConfigId, selectedGlobalSlaveIds);
      }

      setCreatingPreset(false);
      setCreatePresetSlaveMode('none');
      setSelectedGlobalSlaveIds([]);
      setCreateForm({
        name: '',
        description: '',
        baud_rate: 9600,
        data_bits: 8,
        stop_bits: 1,
        parity: 0,
      });
      // Refetch to get the new preset with all fields
      await fetchPresets(searchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preset');
    }
  };

  const handleDelete = (preset: any) => {
    setDeletePresetModal({ show: true, preset });
  };

  const confirmDeletePreset = async () => {
    if (!deletePresetModal.preset) return;
    const deletedName = deletePresetModal.preset.name;
    try {
      await apiService.deletePreset(deletePresetModal.preset.id);
      setDeletePresetModal({ show: false, preset: null });
      setSuccessModal({ show: true, message: `Preset "${deletedName}" has been deleted successfully.` });
      await fetchPresets(searchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
      setDeletePresetModal({ show: false, preset: null });
    }
  };

  const handleViewDetails = (preset: Preset) => {
    setSelectedPreset(preset);
  };

  const handleCloseDetails = () => {
    setSelectedPreset(null);
  };

  const handleCancel = () => {
    setEditingPreset(null);
    setCreatingPreset(false);
    setCreatePresetSlaveMode('none');
    setSelectedGlobalSlaveIds([]);
    setSlaveSearch('');
  };

  const handleConfigureSlaves = async (preset: Preset) => {
    setConfiguringSlaves(preset);
    await fetchSlavesForPreset(preset.config_id);
  };

  const fetchSlavesForPreset = async (configId: string) => {
    try {
      // Fetch both preset-attached slaves and global (unattached) slaves
      const [attachedData, globalData] = await Promise.all([
        apiService.getSlaves(configId),
        apiService.getGlobalSlaves(),
      ]);

      const attachedIds = new Set(attachedData.map((s: any) => s.id));

      const mapSlave = (slave: any, attached: boolean) => ({
        id: slave.id,
        slaveId: slave.slave_id,
        deviceName: slave.device_name,
        pollingIntervalMs: slave.polling_interval_ms,
        timeoutMs: slave.timeout_ms,
        enabled: slave.enabled,
        attached,
        registers: (slave.registers || []).map((reg: any) => ({
          id: reg.id,
          label: reg.label,
          address: reg.address,
          numRegisters: reg.num_registers,
          functionCode: reg.function_code,
          dataType: reg.data_type,
          scaleFactor: reg.scale_factor,
          offset: reg.offset,
          enabled: reg.enabled,
        }))
      });

      const mappedAttached = attachedData.map((s: any) => mapSlave(s, true));
      const mappedGlobals = (globalData || [])
        .filter((s: any) => !attachedIds.has(s.id))
        .map((s: any) => mapSlave(s, false));

      // Show attached slaves first, then available global slaves
      setSlaves([...mappedAttached, ...mappedGlobals]);
    } catch (err) {
      console.error('Failed to fetch slaves:', err);
      setError('Failed to load slaves for this preset');
    }
  };

  const updatePresetSlaveCount = (configId: string, count: number) => {
    // Update presets state
    const updatedPresets = presets.map(p => 
      p.config_id === configId ? { ...p, slaves_count: count } : p
    );
    setPresets(updatedPresets);
    
    // Update filtered presets
    const searchLower = searchTerm.toLowerCase();
    const updatedFiltered = updatedPresets.filter((preset: Preset) =>
      preset.name.toLowerCase().includes(searchLower) ||
      preset.config_id.toLowerCase().includes(searchLower) ||
      preset.description.toLowerCase().includes(searchLower)
    );
    setFilteredPresets(updatedFiltered);
    
    // Update configuringSlaves if it's the same preset
    if (configuringSlaves && configuringSlaves.config_id === configId) {
      setConfiguringSlaves({ ...configuringSlaves, slaves_count: count });
    }
  };

  const handleCancelSlaveConfig = () => {
    setConfiguringSlaves(null);
    setSlaves([]);
    setCreatingSlave(false);
    setEditingSlave(null);
    setSlaveListSearch('');
    setModalError(null);
  };

  const handleCreateSlave = () => {
    setEditingSlave(null);
    setModalError(null);
    setCreatingSlave(true);
  };

  const handleEditSlave = (slave: SlaveDevice) => {
    setModalError(null);
    setEditingSlave(slave);
  };

  const handleAttachSlaveToPreset = async (slave: SlaveDevice) => {
    if (!configuringSlaves) return;
    try {
      await apiService.addSlavesToPreset(configuringSlaves.config_id, [slave.id]);
      // refresh list for this preset
      await fetchSlavesForPreset(configuringSlaves.config_id);
      updatePresetSlaveCount(configuringSlaves.config_id, slaves.filter(s => s.attached).length + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach slave to preset');
    }
  };

  const handleDetachSlaveFromPreset = async (slave: SlaveDevice) => {
    if (!configuringSlaves) return;
    try {
      await apiService.detachSlaveFromPreset(configuringSlaves.config_id, slave.slaveId);
      // refresh list for this preset
      await fetchSlavesForPreset(configuringSlaves.config_id);
      updatePresetSlaveCount(configuringSlaves.config_id, slaves.filter(s => s.attached).length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detach slave from preset');
    }
  };

  const handleSaveSlave = async (formData: SlaveFormData) => {
    if (!configuringSlaves) return;

    const mapSlaveResponse = (s: any) => ({
      id: s.id,
      slaveId: s.slave_id,
      deviceName: s.device_name,
      pollingIntervalMs: s.polling_interval_ms,
      timeoutMs: s.timeout_ms,
      enabled: s.enabled,
      registers: (s.registers || []).map((reg: any) => ({
        id: reg.id,
        label: reg.label,
        address: reg.address,
        numRegisters: reg.num_registers,
        functionCode: reg.function_code,
        dataType: reg.data_type,
        scaleFactor: reg.scale_factor,
        offset: reg.offset,
        enabled: reg.enabled,
      }))
    });

    try {
      const slaveData = {
        slave_id: parseInt(formData.slave_id),
        device_name: formData.device_name,
        polling_interval_ms: formData.polling_interval_ms,
        timeout_ms: formData.timeout_ms,
        enabled: formData.enabled,
        registers: formData.registers,
      };

      if (editingSlave) {
        const updated = await apiService.updateSlave(configuringSlaves.config_id, editingSlave.slaveId, slaveData);
        const updatedSlaves = slaves.map(s => s.slaveId === editingSlave.slaveId ? mapSlaveResponse(updated) : s);
        setSlaves(updatedSlaves);
        updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
        setEditingSlave(null);
      } else {
        const created = await apiService.createSlave(configuringSlaves.config_id, slaveData);
        const updatedSlaves = [...slaves, mapSlaveResponse(created)];
        setSlaves(updatedSlaves);
        updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
        setCreatingSlave(false);
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save slave');
    }
  };

  const handleDeleteSlave = (slave: SlaveDevice) => {
    if (!configuringSlaves) return;
    setDeleteSlaveModal({ show: true, slave });
  };

  const confirmDeleteSlave = async () => {
    if (!deleteSlaveModal.slave || !configuringSlaves) return;
    
    try {
      await apiService.deleteSlave(configuringSlaves.config_id, deleteSlaveModal.slave.slaveId);
      const updatedSlaves = slaves.filter(s => s.id !== deleteSlaveModal.slave!.id);
      setSlaves(updatedSlaves);
      // Update preset count
      updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
      setDeleteSlaveModal({ show: false, slave: null });
      setSuccessModal({ 
        show: true, 
        message: `Slave device "${deleteSlaveModal.slave.deviceName}" has been removed.` 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slave');
      setDeleteSlaveModal({ show: false, slave: null });
    }
  };

  if (loading) {
    return <div className="loading">Loading presets...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const editSlaveInitialForm: SlaveFormData | undefined = editingSlave ? {
    slave_id: editingSlave.slaveId.toString(),
    device_name: editingSlave.deviceName,
    polling_interval_ms: editingSlave.pollingIntervalMs,
    timeout_ms: editingSlave.timeoutMs,
    enabled: editingSlave.enabled,
    registers: editingSlave.registers,
  } : undefined;

  return (
    <div className="admin-container responsive-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 'var(--space-5)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16,185,129,0.35)', flexShrink: 0 }}>
          <Layers size={20} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0 }}>Device Presets</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Reusable gateway configuration templates for your devices</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Presets{filteredPresets.length !== presets.length ? ` · ${filteredPresets.length} of ${presets.length}` : ` (${presets.length})`}</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search presets..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingPreset(true)} className="btn">
              <Layers size={15} style={{ marginRight: 6 }} />
              Create New Preset
            </button>
          </div>
        </div>

        {filteredPresets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Layers size={40} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>No presets found</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              {searchTerm ? 'Try a different search term.' : 'Create a preset to get started.'}
            </p>
          </div>
        ) : (
          <div className="preset-grid">
            {filteredPresets.map((preset) => {
              const baudRate = preset.gateway_configuration?.uart_configuration?.baud_rate;
              return (
                <div key={preset.id} className="preset-card">
                  <div className="preset-card-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="preset-card-title">{preset.name}</div>
                      {preset.description && (
                        <div className="preset-card-desc">{preset.description}</div>
                      )}
                    </div>
                  </div>

                  <div className="preset-card-chips">
                    <span className="preset-chip">
                      <Settings size={11} />
                      {preset.config_id}
                    </span>
                    {baudRate && (
                      <span className="preset-chip">
                        {baudRate} baud
                      </span>
                    )}
                    <span className="preset-chip">
                      <Layers size={11} />
                      {preset.slaves_count || 0} slave{preset.slaves_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="preset-card-actions">
                    <button onClick={() => handleViewDetails(preset)} className="preset-card-btn preset-card-btn-view" title="View Details">
                      <Eye size={13} /> View
                    </button>
                    <button onClick={() => handleConfigureSlaves(preset)} className="preset-card-btn preset-card-btn-configure" title="Configure Slaves">
                      <Settings size={13} /> Slaves
                    </button>
                    <button onClick={() => handleEdit(preset)} className="preset-card-btn preset-card-btn-edit" title="Edit">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(preset)} className="preset-card-btn preset-card-btn-delete" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="pagination-bar" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', gap: '16px' }}>
            <div className="pagination-info" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} presets
            </div>
            <div className="pagination-controls">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: currentPage === 1 ? 'rgba(148,163,184,0.1)' : 'transparent', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? '0.5' : '1' }}
              >← Previous</button>
              <div className="pagination-pages">
                {(() => {
                  const pages: React.ReactNode[] = [];
                  let lastWasEllipsis = false;
                  for (let i = 1; i <= totalPages; i++) {
                    const show = i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1;
                    if (show) {
                      lastWasEllipsis = false;
                      pages.push(<button key={i} onClick={() => setCurrentPage(i)} style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '4px', background: i === currentPage ? 'rgba(99,102,241,0.2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: i === currentPage ? 'bold' : 'normal', minWidth: '32px' }}>{i}</button>);
                    } else if (!lastWasEllipsis) {
                      lastWasEllipsis = true;
                      pages.push(<span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>);
                    }
                  }
                  return pages;
                })()}
              </div>
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: currentPage === totalPages ? 'rgba(148,163,184,0.1)' : 'transparent', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? '0.5' : '1' }}
              >Next →</button>
            </div>
            <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
        )}
      </div>

      {(editingPreset || creatingPreset) && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={() => { setEditingPreset(null); setCreatingPreset(false); }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '700px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                  <Settings size={22} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>{editingPreset ? `Edit Preset: ${editingPreset.name}` : 'Create New Preset'}</div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>{editingPreset ? 'Update gateway configuration preset' : 'Configure a new gateway preset'}</div>
                </div>
              </div>
              <button type="button" onClick={() => { setEditingPreset(null); setCreatingPreset(false); }} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <form onSubmit={(e) => { e.preventDefault(); editingPreset ? handleSave() : handleCreate(); }}>

                {/* Section 1: Preset Information */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Preset Details</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {editingPreset && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Config ID</label>
                        <input
                          type="text"
                          value={editForm.config_id}
                          onChange={(e) => setEditForm({...editForm, config_id: e.target.value})}
                          required
                          autoComplete="off"
                          readOnly
                          style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(editingPreset ? {} : { gridColumn: '1 / -1' }) }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Preset Name</label>
                      <input
                        type="text"
                        value={editingPreset ? editForm.name : createForm.name}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, name: e.target.value}) : setCreateForm({...createForm, name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="e.g., Standard Gateway Config"
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Description</label>
                      <textarea
                        value={editingPreset ? editForm.description : createForm.description}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, description: e.target.value}) : setCreateForm({...createForm, description: e.target.value})}
                        autoComplete="off"
                        placeholder="Describe the purpose of this preset..."
                        rows={2}
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: UART Configuration */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>UART Configuration</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Baud Rate</label>
                      <select
                        value={editingPreset ? editForm.baud_rate : createForm.baud_rate}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, baud_rate: parseInt(e.target.value)}) : setCreateForm({...createForm, baud_rate: parseInt(e.target.value)})}
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      >
                        <option value={9600}>9600</option>
                        <option value={19200}>19200</option>
                        <option value={38400}>38400</option>
                        <option value={57600}>57600</option>
                        <option value={115200}>115200</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Data Bits</label>
                      <select
                        value={editingPreset ? editForm.data_bits : createForm.data_bits}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, data_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, data_bits: parseInt(e.target.value)})}
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      >
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Stop Bits</label>
                      <select
                        value={editingPreset ? editForm.stop_bits : createForm.stop_bits}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, stop_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, stop_bits: parseInt(e.target.value)})}
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Parity</label>
                      <select
                        value={editingPreset ? editForm.parity : createForm.parity}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, parity: parseInt(e.target.value)}) : setCreateForm({...createForm, parity: parseInt(e.target.value)})}
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      >
                        <option value={0}>None</option>
                        <option value={1}>Odd</option>
                        <option value={2}>Even</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Initial Slave Setup (Create Mode Only) */}
                {creatingPreset && (
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Initial Slave Setup</span>
                    </div>
                    <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 16, marginTop: -8 }}>Optionally configure a slave device for this preset immediately.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 10, padding: '14px 16px',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                      }}>
                        <div style={{ marginBottom: createPresetSlaveMode === 'create' ? 12 : 0 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                            <input
                              type="radio"
                              name="slaveMode"
                              checked={createPresetSlaveMode === 'create'}
                              onChange={() => setCreatePresetSlaveMode('create')}
                            />
                            <span>Create New Slave</span>
                          </label>
                        </div>
                        <div style={{ display: createPresetSlaveMode === 'create' ? 'block' : 'none' }}>
                          <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', margin: '0 0 12px 0' }}>Define a new slave device configuration from scratch.</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Slave ID</label>
                              <input
                                type="number"
                                value={slaveForm.slave_id}
                                onChange={(e) => setSlaveForm({ ...slaveForm, slave_id: e.target.value })}
                                required
                                placeholder="1-247"
                                style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Device Name</label>
                              <input
                                type="text"
                                value={slaveForm.device_name}
                                onChange={(e) => setSlaveForm({ ...slaveForm, device_name: e.target.value })}
                                required
                                placeholder="Device Name"
                                style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Polling (ms)</label>
                              <input
                                type="number"
                                value={slaveForm.polling_interval_ms}
                                onChange={(e) => setSlaveForm({ ...slaveForm, polling_interval_ms: parseInt(e.target.value) })}
                                placeholder="5000"
                                style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Timeout (ms)</label>
                              <input
                                type="number"
                                value={slaveForm.timeout_ms}
                                onChange={(e) => setSlaveForm({ ...slaveForm, timeout_ms: parseInt(e.target.value) })}
                                placeholder="1000"
                                style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 10, padding: '14px 16px',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                      }}>
                        <div style={{ marginBottom: createPresetSlaveMode === 'select' ? 12 : 0 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                            <input
                              type="radio"
                              name="slaveMode"
                              checked={createPresetSlaveMode === 'select'}
                              onChange={() => setCreatePresetSlaveMode('select')}
                            />
                            <span>Link Existing Slave</span>
                          </label>
                        </div>
                        <div style={{ display: createPresetSlaveMode === 'select' ? 'block' : 'none' }}>
                          <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', margin: '0 0 12px 0' }}>Select an existing slave configuration to reuse.</p>
                          {globalSlavesLoading ? (
                            <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Loading slaves...</p>
                          ) : globalSlaves.length === 0 ? (
                            <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>No existing slaves found.</p>
                          ) : (() => {
                            const filtered = globalSlaves.filter(s =>
                              s.deviceName.toLowerCase().includes(slaveSearch.toLowerCase()) ||
                              String(s.slaveId).includes(slaveSearch)
                            );
                            return (
                              <>
                                <input
                                  type="text"
                                  placeholder="Search by name or slave ID…"
                                  value={slaveSearch}
                                  onChange={(e) => setSlaveSearch(e.target.value)}
                                  style={{ width: '100%', marginBottom: '8px', padding: '10px 12px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '8px' }}>
                                  {filtered.length === 0 ? (
                                    <p style={{ margin: 0, color: isDark ? '#9ca3af' : '#6b7280', fontSize: '0.85em' }}>No slaves match your search.</p>
                                  ) : filtered.map((slave) => (
                                    <label key={slave.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '4px 6px', borderRadius: '3px', background: selectedGlobalSlaveIds.includes(slave.id) ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedGlobalSlaveIds.includes(slave.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedGlobalSlaveIds([...selectedGlobalSlaveIds, slave.id]);
                                          } else {
                                            setSelectedGlobalSlaveIds(selectedGlobalSlaveIds.filter(id => id !== slave.id));
                                          }
                                        }}
                                      />
                                      <span style={{ fontSize: '0.875rem', color: isDark ? '#f3f4f6' : '#111827' }}><strong>{slave.deviceName}</strong> <span style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '0.85em' }}>(Slave ID: {slave.slaveId})</span></span>
                                    </label>
                                  ))}
                                </div>
                                <small style={{ marginTop: '4px', display: 'block', fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                                  {filtered.length} of {globalSlaves.length} shown
                                  {selectedGlobalSlaveIds.length > 0 && (
                                    <span style={{ color: '#6366f1' }}> · {selectedGlobalSlaveIds.length} selected</span>
                                  )}
                                </small>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 10, padding: '14px 16px',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                          <input
                            type="radio"
                            name="slaveMode"
                            checked={createPresetSlaveMode === 'none'}
                            onChange={() => setCreatePresetSlaveMode('none')}
                          />
                          <span>Skip for Now</span>
                        </label>
                        <p style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', margin: '8px 0 0 0' }}>Create preset without any initial slave configuration.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Existing Slaves for this Preset (when editing) */}
                {editingPreset && (
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Preset Slave Devices</span>
                    </div>
                    <div className="card">
                      <div className="card-header">
                        <h5>Slaves ({slaves.length}{editPresetSlaveSearch ? ` · ${slaves.filter(s => s.deviceName.toLowerCase().includes(editPresetSlaveSearch.toLowerCase()) || String(s.slaveId).includes(editPresetSlaveSearch)).length} shown` : ''})</h5>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Search…"
                            value={editPresetSlaveSearch}
                            onChange={(e) => setEditPresetSlaveSearch(e.target.value)}
                            style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.78rem', minWidth: 130 }}
                          />
                          <button type="button" onClick={() => handleConfigureSlaves(editingPreset)} className="btn btn-sm">Configure Slaves</button>
                        </div>
                      </div>
                      {slaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>
                          <p>No slave devices for this preset.</p>
                        </div>
                      ) : (
                        <div
                          className="table-responsive"
                          style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'auto' }}
                        >
                          <table className="table" style={{ minWidth: 600 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center' }}>Slave ID</th>
                                <th style={{ textAlign: 'center' }}>Device Name</th>
                                <th style={{ textAlign: 'center' }}>Polling</th>
                                <th style={{ textAlign: 'center' }}>Timeout</th>
                                <th style={{ textAlign: 'center' }}>Registers</th>
                              </tr>
                            </thead>
                            <tbody>
                              {slaves.filter(s => !editPresetSlaveSearch || s.deviceName.toLowerCase().includes(editPresetSlaveSearch.toLowerCase()) || String(s.slaveId).includes(editPresetSlaveSearch)).map(s => (
                                <tr key={s.id}>
                                  <td style={{ textAlign: 'center' }}>{s.slaveId}</td>
                                  <td>{s.deviceName}</td>
                                  <td style={{ textAlign: 'center' }}>{s.pollingIntervalMs}ms</td>
                                  <td style={{ textAlign: 'center' }}>{s.timeoutMs}ms</td>
                                  <td style={{ textAlign: 'center' }}>{s.registers.filter(r => r.enabled).length} / {s.registers.length}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 28px',
              borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" onClick={(e) => { e.preventDefault(); editingPreset ? handleSave() : handleCreate(); }} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>{editingPreset ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedPreset && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={() => setSelectedPreset(null)}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '700px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(14,165,233,0.4)' }}>
                  <Eye size={22} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>{selectedPreset.name}</div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Configuration details</div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPreset(null)} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>General Settings</span>
                  </div>
                  <p style={{ margin: '6px 0', wordBreak: 'break-word', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Config ID:</strong> {selectedPreset.gateway_configuration.general_settings.config_id}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Schema Version:</strong> {selectedPreset.gateway_configuration.general_settings.schema_version}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Last Updated:</strong> {selectedPreset.gateway_configuration.general_settings.last_updated}</p>
                </div>

                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>UART Configuration</span>
                  </div>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Baud Rate:</strong> {selectedPreset.gateway_configuration.uart_configuration.baud_rate}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Data Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.data_bits}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Stop Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.stop_bits}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Parity:</strong> {selectedPreset.gateway_configuration.uart_configuration.parity}</p>
                </div>
              </div>

              <div style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderRadius: 12, padding: '20px',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Preset Info</span>
                </div>
                <p style={{ margin: '6px 0', wordBreak: 'break-word', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Description:</strong> {selectedPreset.description || <em>No description</em>}</p>
                <p style={{ margin: '6px 0', fontSize: '0.875rem', color: isDark ? '#d1d5db' : '#374151' }}><strong>Slave Devices:</strong> {selectedPreset.slaves_count}</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 28px',
              borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <button type="button" onClick={handleCloseDetails} style={{ padding: '10px 20px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {configuringSlaves && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={() => setConfiguringSlaves(null)}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '1100px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                  <Settings size={22} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Manage Slave Devices</div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>{configuringSlaves.name}</div>
                </div>
              </div>
              <button type="button" onClick={() => setConfiguringSlaves(null)} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {error && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: isDark ? 'rgba(220,53,69,0.15)' : '#f8d7da', border: isDark ? '1px solid rgba(220,53,69,0.3)' : '1px solid #f5c6cb', borderRadius: 8, color: isDark ? '#fca5a5' : '#721c24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span><strong>Error:</strong> {error}</span>
                  <button
                    onClick={() => setError(null)}
                    style={{ background: 'none', border: 'none', color: isDark ? '#fca5a5' : '#721c24', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                    title="Close error"
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderRadius: 12, padding: '20px',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Slave Devices ({slaves.length}{slaveListSearch ? ` · ${slaves.filter(s => s.deviceName.toLowerCase().includes(slaveListSearch.toLowerCase()) || String(s.slaveId).includes(slaveListSearch)).length} shown` : ''})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Search by name or ID…"
                      value={slaveListSearch}
                      onChange={(e) => setSlaveListSearch(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.8rem', minWidth: 180, boxSizing: 'border-box' }}
                    />
                    <button onClick={handleCreateSlave} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', whiteSpace: 'nowrap' }}>Add Slave</button>
                  </div>
                </div>

                {slaves.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem' }}>No slave devices configured yet.</p>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Click "Add Slave" to configure your first slave device.</p>
                  </div>
                ) : (
                  <div className="table-responsive"><table className="table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center' }}>Slave ID</th>
                        <th style={{ textAlign: 'center' }}>Device Name</th>
                        <th style={{ textAlign: 'center' }}>Polling Interval</th>
                        <th style={{ textAlign: 'center' }}>Timeout</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Registers</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaves.filter(s => !slaveListSearch || s.deviceName.toLowerCase().includes(slaveListSearch.toLowerCase()) || String(s.slaveId).includes(slaveListSearch)).map((slave) => (
                        <tr key={slave.id}>
                          <td style={{ textAlign: 'center' }}>{slave.slaveId}</td>
                          <td>{slave.deviceName}</td>
                          <td style={{ textAlign: 'center' }}>{slave.pollingIntervalMs}ms</td>
                          <td style={{ textAlign: 'center' }}>{slave.timeoutMs}ms</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={slave.enabled ? 'status-online' : 'status-offline'}>
                              {slave.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{slave.registers.filter(r => r.enabled).length} / {slave.registers.length}</td>
                          <td style={{ textAlign: 'center' }}>
                            {slave.attached ? (
                              <button onClick={() => handleDetachSlaveFromPreset(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginRight: '8px' }} title="Remove from preset">
                                Remove
                              </button>
                            ) : (
                              <button onClick={() => handleAttachSlaveToPreset(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', marginRight: '8px' }} title="Add to preset">
                                Add
                              </button>
                            )}
                            <button onClick={() => handleEditSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', marginRight: '10px' }} title="Edit">
                              <Pencil size={16} strokeWidth={2} />
                            </button>
                            <button onClick={() => handleDeleteSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 28px',
              borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <button type="button" onClick={handleCancelSlaveConfig} style={{ padding: '10px 20px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <SlaveConfigModal
        open={creatingSlave || !!editingSlave}
        editingSlave={editingSlave ? { id: editingSlave.id, deviceName: editingSlave.deviceName, slaveId: editingSlave.slaveId } : null}
        existingSlaveIds={slaves.map(s => s.slaveId)}
        initialForm={editSlaveInitialForm}
        onSave={handleSaveSlave}
        onCancel={() => { setCreatingSlave(false); setEditingSlave(null); setModalError(null); }}
        error={modalError}
        onClearError={() => setModalError(null)}
      />

      {/* Modern Delete Preset Confirmation Modal */}
      {deletePresetModal.show && deletePresetModal.preset && ReactDOM.createPortal(
        <div style={{
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
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Trash2 size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Delete Preset
                </span>
              </div>
              <button
                onClick={() => setDeletePresetModal({ show: false, preset: null })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 14 }}>
                Are you sure you want to delete preset <strong>{deletePresetModal.preset.name}</strong>?
              </p>
              <div style={{
                background: isDark ? 'rgba(220,53,69,0.12)' : '#fef2f2',
                border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #fecaca',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: '0.875rem',
                color: isDark ? '#fca5a5' : '#991b1b',
              }}>
                <strong>Warning:</strong> This will permanently delete the preset configuration. Devices using this preset will need to be reconfigured.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletePresetModal({ show: false, preset: null })}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePreset}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Delete Slave Confirmation Modal */}
      {deleteSlaveModal.show && deleteSlaveModal.slave && ReactDOM.createPortal(
        <div style={{
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
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <AlertTriangle size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Remove Slave Device
                </span>
              </div>
              <button
                onClick={() => setDeleteSlaveModal({ show: false, slave: null })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 14 }}>
                Are you sure you want to remove slave device <strong>{deleteSlaveModal.slave.deviceName}</strong> (ID: {deleteSlaveModal.slave.slaveId})?
              </p>
              <div style={{
                background: isDark ? 'rgba(220,53,69,0.12)' : '#fef2f2',
                border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #fecaca',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: '0.875rem',
                color: isDark ? '#fca5a5' : '#991b1b',
              }}>
                <strong>Warning:</strong> This will remove the slave device configuration and all its register mappings.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteSlaveModal({ show: false, slave: null })}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSlave}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                }}
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Success Notification Modal */}
      {successModal.show && ReactDOM.createPortal(
        <div style={{
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
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <CheckCircle2 size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Success
                </span>
              </div>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 14 }}>
                {successModal.message}
              </p>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DevicePresets;
