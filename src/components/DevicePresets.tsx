import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

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
  const [registerForm, setRegisterForm] = useState({
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
  });

  useEffect(() => {
    fetchPresets();
  }, []);

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
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchPresets(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

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
    setRegisterForm({
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
      high_alarm_threshold: null,
      low_alarm_threshold: null,
      description: '',
      enabled: true,
    });
  }, [creatingPreset]);

  const fetchPresets = async (search?: string) => {
    try {
      const data = await apiService.getPresets();
      // Filter presets based on search term
      let filteredData = data;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = data.filter((preset: Preset) =>
          preset.name.toLowerCase().includes(searchLower) ||
          preset.config_id.toLowerCase().includes(searchLower) ||
          preset.description.toLowerCase().includes(searchLower)
        );
      }
      setPresets(data);
      setFilteredPresets(filteredData);
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
      await fetchPresets(searchTerm);
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
      await fetchPresets(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preset');
    }
  };

  const handleDelete = async (preset: any) => {
    if (window.confirm(`Are you sure you want to delete preset ${preset.name}?`)) {
      try {
        await apiService.deletePreset(preset.id);
        const updatedPresets = presets.filter(p => p.id !== preset.id);
        setPresets(updatedPresets);
        // Also update filtered presets to remove the deleted preset immediately
        const searchLower = searchTerm.toLowerCase();
        const updatedFiltered = updatedPresets.filter((preset: Preset) =>
          preset.name.toLowerCase().includes(searchLower) ||
          preset.config_id.toLowerCase().includes(searchLower) ||
          preset.description.toLowerCase().includes(searchLower)
        );
        setFilteredPresets(updatedFiltered);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete preset');
      }
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

  const getDataTypeName = (dataType: number): string => {
    const types: Record<number, string> = {
      0: 'UINT16', 1: 'INT16', 2: 'UINT32', 3: 'INT32',
      4: 'FLOAT32', 5: 'UINT64', 6: 'INT64', 7: 'FLOAT64',
      8: 'BOOL', 9: 'STRING',
    };
    return types[dataType] ?? `Unknown (${dataType})`;
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
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      enabled: true,
      registers: []
    });
  };

  const handleCreateSlave = () => {
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      enabled: true,
      registers: []
    });
    // Ensure we are not editing an existing slave when opening the create modal
    setEditingSlave(null);
    setCreatingSlave(true);
  };

  const handleEditSlave = (slave: SlaveDevice) => {
    setSlaveForm({
      slave_id: slave.slaveId.toString(),
      device_name: slave.deviceName,
      polling_interval_ms: slave.pollingIntervalMs,
      timeout_ms: slave.timeoutMs,
      enabled: slave.enabled,
      registers: [...slave.registers]
    });
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

  const handleSaveSlave = async () => {
    if (!configuringSlaves) return;

    // Validate slave ID uniqueness for new slaves
    if (!editingSlave) {
      const slaveId = parseInt(slaveForm.slave_id);
      const existingSlave = slaves.find(s => s.slaveId === slaveId);
      if (existingSlave) {
        setError(`Slave ID ${slaveId} already exists for this configuration. Please choose a different ID.`);
        return;
      }
    }

    try {
      const slaveData = {
        slave_id: parseInt(slaveForm.slave_id),
        device_name: slaveForm.device_name,
        polling_interval_ms: slaveForm.polling_interval_ms,
        timeout_ms: slaveForm.timeout_ms,
        enabled: slaveForm.enabled,
        registers: slaveForm.registers
      };

      if (editingSlave) {
        const updatedSlave = await apiService.updateSlave(configuringSlaves.config_id, editingSlave.slaveId, slaveData);
        // Map response to match interface
        const mappedSlave = {
          id: updatedSlave.id,
          slaveId: updatedSlave.slave_id,
          deviceName: updatedSlave.device_name,
          pollingIntervalMs: updatedSlave.polling_interval_ms,
          timeoutMs: updatedSlave.timeout_ms,
          enabled: updatedSlave.enabled,
          registers: updatedSlave.registers.map((reg: any) => ({
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
        };
        const updatedSlaves = slaves.map(s => s.slaveId === editingSlave.slaveId ? mappedSlave : s);
        setSlaves(updatedSlaves);
        // Update preset count
        updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
        setEditingSlave(null);
      } else {
        const newSlave = await apiService.createSlave(configuringSlaves.config_id, slaveData);
        // Map response to match interface
        const mappedSlave = {
          id: newSlave.id,
          slaveId: newSlave.slave_id,
          deviceName: newSlave.device_name,
          pollingIntervalMs: newSlave.polling_interval_ms,
          timeoutMs: newSlave.timeout_ms,
          enabled: newSlave.enabled,
          registers: newSlave.registers.map((reg: any) => ({
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
        };
        const updatedSlaves = [...slaves, mappedSlave];
        setSlaves(updatedSlaves);
        // Update preset count
        updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
        setCreatingSlave(false);
      }

      setSlaveForm({
        slave_id: '',
        device_name: '',
        polling_interval_ms: 5000,
        timeout_ms: 1000,
        enabled: true,
        registers: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save slave');
    }
  };

  const handleDeleteSlave = async (slave: SlaveDevice) => {
    if (!configuringSlaves) return;

    if (window.confirm(`Are you sure you want to delete slave ${slave.deviceName}?`)) {
      try {
        await apiService.deleteSlave(configuringSlaves.config_id, slave.slaveId);
        const updatedSlaves = slaves.filter(s => s.id !== slave.id);
        setSlaves(updatedSlaves);
        // Update preset count
        updatePresetSlaveCount(configuringSlaves.config_id, updatedSlaves.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete slave');
      }
    }
  };

  const addRegister = () => {
    const newRegister: RegisterMapping = {
      id: Date.now(),
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
    };

    setSlaveForm({ ...slaveForm, registers: [...slaveForm.registers, newRegister] });

    setRegisterForm({
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
      high_alarm_threshold: null,
      low_alarm_threshold: null,
      description: '',
      enabled: true,
    });
  };

  const removeRegister = (index: number) => {
    setSlaveForm({
      ...slaveForm,
      registers: slaveForm.registers.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return <div className="loading">Loading presets...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h1>Device Presets</h1>

      <div className="card">
        <div className="card-header">
          <h2>Presets ({filteredPresets.length})</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search presets..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingPreset(true)} className="btn">
              Create New Preset
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Name</th>
              <th style={{ textAlign: 'center' }}>Config ID</th>
              <th style={{ textAlign: 'center' }}>Description</th>
              <th style={{ textAlign: 'center' }}>Slaves</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPresets.map((preset) => (
              <tr key={preset.id}>
                <td style={{ textAlign: 'center' }}>{preset.name}</td>
                <td style={{ textAlign: 'center' }}>{preset.config_id}</td>
                <td style={{ textAlign: 'center' }}>{preset.description}</td>
                <td style={{ textAlign: 'center' }}>{preset.slaves_count || 0}</td>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => handleViewDetails(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', margin: '0 6px' }} title="View Details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                  <button onClick={() => handleConfigureSlaves(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', margin: '0 6px' }} title="Configure Slaves">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="21" y1="3" x2="3" y2="21"></line>
                    </svg>
                  </button>
                  <button onClick={() => handleEdit(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', margin: '0 6px' }} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', margin: '0 6px' }} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editingPreset || creatingPreset) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingPreset ? `Edit Preset: ${editingPreset.name}` : 'Create New Preset'}</h3>
            <div className="modal-body">
              <form onSubmit={(e) => { e.preventDefault(); editingPreset ? handleSave() : handleCreate(); }}>
                
                {/* Section 1: Preset Information */}
                <div className="form-section">
                  <h4 className="form-section-title">Preset Details</h4>
                  <div className="form-grid form-grid-2">
                    {editingPreset && (
                      <div className="form-group">
                        <label>Config ID</label>
                        <input
                          type="text"
                          value={editForm.config_id}
                          onChange={(e) => setEditForm({...editForm, config_id: e.target.value})}
                          required
                          autoComplete="off"
                          readOnly
                          className="form-control-readonly"
                        />
                      </div>
                    )}
                    <div className="form-group" style={editingPreset ? {} : { gridColumn: '1 / -1' }}>
                      <label>Preset Name</label>
                      <input
                        type="text"
                        value={editingPreset ? editForm.name : createForm.name}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, name: e.target.value}) : setCreateForm({...createForm, name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="e.g., Standard Gateway Config"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Description</label>
                      <textarea
                        value={editingPreset ? editForm.description : createForm.description}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, description: e.target.value}) : setCreateForm({...createForm, description: e.target.value})}
                        autoComplete="off"
                        placeholder="Describe the purpose of this preset..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: UART Configuration */}
                <div className="form-section compact-inputs">
                  <h4 className="form-section-title">UART Configuration</h4>
                  <div className="form-grid form-grid-4">
                    <div className="form-group">
                      <label>Baud Rate</label>
                      <select
                        value={editingPreset ? editForm.baud_rate : createForm.baud_rate}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, baud_rate: parseInt(e.target.value)}) : setCreateForm({...createForm, baud_rate: parseInt(e.target.value)})}
                      >
                        <option value={9600}>9600</option>
                        <option value={19200}>19200</option>
                        <option value={38400}>38400</option>
                        <option value={57600}>57600</option>
                        <option value={115200}>115200</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Data Bits</label>
                      <select
                        value={editingPreset ? editForm.data_bits : createForm.data_bits}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, data_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, data_bits: parseInt(e.target.value)})}
                      >
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Stop Bits</label>
                      <select
                        value={editingPreset ? editForm.stop_bits : createForm.stop_bits}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, stop_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, stop_bits: parseInt(e.target.value)})}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Parity</label>
                      <select
                        value={editingPreset ? editForm.parity : createForm.parity}
                        onChange={(e) => editingPreset ? setEditForm({...editForm, parity: parseInt(e.target.value)}) : setCreateForm({...createForm, parity: parseInt(e.target.value)})}
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
                  <div className="form-section">
                    <h4 className="form-section-title">Initial Slave Setup</h4>
                    <p className="form-section-desc">Optionally configure a slave device for this preset immediately.</p>
                    
                    <div className="slave-options-container">
                      <div className="slave-option-card">
                        <div className="slave-option-header">
                          <label className="radio-card-label">
                            <input
                              type="radio"
                              name="slaveMode"
                              checked={createPresetSlaveMode === 'create'}
                              onChange={() => setCreatePresetSlaveMode('create')}
                            />
                            <span>Create New Slave</span>
                          </label>
                        </div>
                        <div className={`slave-option-content ${createPresetSlaveMode === 'create' ? 'active' : ''}`}>
                          <p className="text-sm text-muted">Define a new slave device configuration from scratch.</p>
                          {createPresetSlaveMode === 'create' && (
                             <div className="nested-form">
                                <div className="form-grid form-grid-2">
                                  <div className="form-group">
                                    <label>Slave ID</label>
                                    <input
                                      type="number"
                                      value={slaveForm.slave_id}
                                      onChange={(e) => setSlaveForm({ ...slaveForm, slave_id: e.target.value })}
                                      required
                                      placeholder="1-247"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Device Name</label>
                                    <input
                                      type="text"
                                      value={slaveForm.device_name}
                                      onChange={(e) => setSlaveForm({ ...slaveForm, device_name: e.target.value })}
                                      required
                                      placeholder="Device Name"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Polling (ms)</label>
                                    <input
                                      type="number"
                                      value={slaveForm.polling_interval_ms}
                                      onChange={(e) => setSlaveForm({ ...slaveForm, polling_interval_ms: parseInt(e.target.value) })}
                                      placeholder="5000"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Timeout (ms)</label>
                                    <input
                                      type="number"
                                      value={slaveForm.timeout_ms}
                                      onChange={(e) => setSlaveForm({ ...slaveForm, timeout_ms: parseInt(e.target.value) })}
                                      placeholder="1000"
                                    />
                                  </div>
                                </div>
                             </div>
                          )}
                        </div>
                      </div>

                      <div className="slave-option-card">
                        <div className="slave-option-header">
                          <label className="radio-card-label">
                            <input
                              type="radio"
                              name="slaveMode"
                              checked={createPresetSlaveMode === 'select'}
                              onChange={() => setCreatePresetSlaveMode('select')}
                            />
                            <span>Link Existing Slave</span>
                          </label>
                        </div>
                        <div className={`slave-option-content ${createPresetSlaveMode === 'select' ? 'active' : ''}`}>
                           <p className="text-sm text-muted">Select an existing slave configuration to reuse.</p>
                           {createPresetSlaveMode === 'select' && (
                              <div style={{ marginTop: '10px' }}>
                                {globalSlavesLoading ? (
                                  <p className="text-sm text-muted">Loading slaves...</p>
                                ) : globalSlaves.length === 0 ? (
                                  <p className="text-sm text-muted">No existing slaves found.</p>
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
                                        style={{ width: '100%', marginBottom: '8px', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.6)', color: '#f8fafc', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                      />
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '4px', padding: '8px' }}>
                                        {filtered.length === 0 ? (
                                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85em' }}>No slaves match your search.</p>
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
                                            <span><strong>{slave.deviceName}</strong> <span style={{ color: '#94a3b8', fontSize: '0.85em' }}>(Slave ID: {slave.slaveId})</span></span>
                                          </label>
                                        ))}
                                      </div>
                                      <small className="form-hint" style={{ marginTop: '4px', display: 'block' }}>
                                        {filtered.length} of {globalSlaves.length} shown
                                        {selectedGlobalSlaveIds.length > 0 && (
                                          <span className="form-hint-accent"> · {selectedGlobalSlaveIds.length} selected</span>
                                        )}
                                      </small>
                                    </>
                                  );
                                })()}
                              </div>
                           )}
                        </div>
                      </div>

                      <div className="slave-option-card">
                        <div className="slave-option-header">
                          <label className="radio-card-label">
                            <input
                              type="radio"
                              name="slaveMode"
                              checked={createPresetSlaveMode === 'none'}
                              onChange={() => setCreatePresetSlaveMode('none')}
                            />
                            <span>Skip for Now</span>
                          </label>
                        </div>
                        <div className="slave-option-content">
                          <p className="text-sm text-muted">Create preset without any initial slave configuration.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Existing Slaves for this Preset (when editing) */}
                {editingPreset && (
                  <div className="form-section">
                    <h4 className="form-section-title">Preset Slave Devices</h4>
                    <div className="card">
                      <div className="card-header">
                        <h5>Slaves ({slaves.length})</h5>
                        <button type="button" onClick={() => handleConfigureSlaves(editingPreset)} className="btn btn-sm">Configure Slaves</button>
                      </div>
                      {slaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>
                          <p>No slave devices for this preset.</p>
                        </div>
                      ) : (
                        <table className="table">
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
                            {slaves.map(s => (
                              <tr key={s.id}>
                                <td style={{ textAlign: 'center' }}>{s.slaveId}</td>
                                <td>{s.deviceName}</td>
                                <td style={{ textAlign: 'center' }}>{s.pollingIntervalMs}ms</td>
                                <td style={{ textAlign: 'center' }}>{s.timeoutMs}ms</td>
                                <td style={{ textAlign: 'center' }}>{s.registers.length}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

              </form>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn" onClick={(e) => { e.preventDefault(); editingPreset ? handleSave() : handleCreate(); }}>{editingPreset ? 'Save' : 'Create'}</button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedPreset && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <h3 style={{ marginBottom: 12 }}>Gateway Configuration: {selectedPreset.name}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16, paddingLeft: 20 }}>
              <div>
                <h4 style={{ marginBottom: 8 }}>General Settings</h4>
                <div style={{ paddingLeft: 0 }}>
                  <p style={{ margin: '6px 0', wordBreak: 'break-word' }}><strong>Config ID:</strong> {selectedPreset.gateway_configuration.general_settings.config_id}</p>
                  <p style={{ margin: '6px 0' }}><strong>Schema Version:</strong> {selectedPreset.gateway_configuration.general_settings.schema_version}</p>
                  <p style={{ margin: '6px 0' }}><strong>Last Updated:</strong> {selectedPreset.gateway_configuration.general_settings.last_updated}</p>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 8 }}>UART Configuration</h4>
                <div style={{ paddingLeft: 0 }}>
                  <p style={{ margin: '6px 0' }}><strong>Baud Rate:</strong> {selectedPreset.gateway_configuration.uart_configuration.baud_rate}</p>
                  <p style={{ margin: '6px 0' }}><strong>Data Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.data_bits}</p>
                  <p style={{ margin: '6px 0' }}><strong>Stop Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.stop_bits}</p>
                  <p style={{ margin: '6px 0' }}><strong>Parity:</strong> {selectedPreset.gateway_configuration.uart_configuration.parity}</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px', paddingLeft: 20 }}>
              <p style={{ margin: '6px 0', wordBreak: 'break-word' }}><strong>Description:</strong> {selectedPreset.description || <em>No description</em>}</p>
              <p style={{ margin: '6px 0' }}><strong>Slave Devices:</strong> {selectedPreset.slaves_count}</p>
            </div>
            <div className="form-actions">
              <button onClick={handleCloseDetails} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {configuringSlaves && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>Configure Slaves: {configuringSlaves.name}</h3>

            {error && (
              <div className="error" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', color: '#721c24' }}>
                <strong>Error:</strong> {error}
                <button
                  onClick={() => setError(null)}
                  style={{ float: 'right', background: 'none', border: 'none', color: '#721c24', cursor: 'pointer', fontSize: '16px' }}
                  title="Close error"
                >
                  ×
                </button>
              </div>
            )}

            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h4>Slave Devices ({slaves.length})</h4>
                <button onClick={handleCreateSlave} className="btn">Add Slave</button>
              </div>

              {slaves.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                  <p>No slave devices configured yet.</p>
                  <p>Click "Add Slave" to configure your first slave device.</p>
                </div>
              ) : (
                <table className="table">
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
                    {slaves.map((slave) => (
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
                        <td style={{ textAlign: 'center' }}>{slave.registers.length}</td>
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
                          <button onClick={() => handleEditSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', marginRight: '10px' }} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3,6 5,6 21,6"></polyline>
                              <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="form-actions">
              <button onClick={handleCancelSlaveConfig} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Slave Configuration Modal */}
      {(creatingSlave || editingSlave) && configuringSlaves && (
        <div className="modal">
          <div className="modal-content large-modal">
            <h3>{editingSlave ? `Edit Slave: ${editingSlave.deviceName}` : 'Configure New Slave'}</h3>
            
            <div className="modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSlave(); }}>
                
                {/* Section 1: Basic Information */}
                <div className="form-section">
                  <h4 className="form-section-title">Basic Information</h4>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label>Slave ID</label>
                      <input
                        type="number"
                        value={slaveForm.slave_id}
                        onChange={(e) => setSlaveForm({...slaveForm, slave_id: e.target.value})}
                        required
                        min="1"
                        max="247"
                        placeholder="1-247"
                      />
                      <small className="form-hint">
                        Unique identifier (1-247)
                        {slaves.length > 0 && (
                          <span className="form-hint-accent">
                            Existing: {slaves.map(s => s.slaveId).join(', ')}
                          </span>
                        )}
                      </small>
                    </div>
                    <div className="form-group">
                      <label>Device Name</label>
                      <input
                        type="text"
                        value={slaveForm.device_name}
                        onChange={(e) => setSlaveForm({...slaveForm, device_name: e.target.value})}
                        required
                        placeholder="e.g., Solar Inverter"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Communication Settings */}
                <div className="form-section">
                  <h4 className="form-section-title">Communication Settings</h4>
                  <div className="form-grid form-grid-3">
                    <div className="form-group">
                      <label>Polling Interval (ms)</label>
                      <input
                        type="number"
                        value={slaveForm.polling_interval_ms}
                        onChange={(e) => setSlaveForm({...slaveForm, polling_interval_ms: parseInt(e.target.value)})}
                        min="100"
                        placeholder="5000"
                      />
                      <small className="form-hint">How often to poll</small>
                    </div>
                    <div className="form-group">
                      <label>Timeout (ms)</label>
                      <input
                        type="number"
                        value={slaveForm.timeout_ms}
                        onChange={(e) => setSlaveForm({...slaveForm, timeout_ms: parseInt(e.target.value)})}
                        min="100"
                        placeholder="1000"
                      />
                      <small className="form-hint">Response timeout</small>
                    </div>
                    <div className="form-group checkbox-group">
                      <label>Status</label>
                      <label className="checkbox-label checkbox-vertical">
                        <input
                          type="checkbox"
                          checked={slaveForm.enabled}
                          onChange={(e) => setSlaveForm({...slaveForm, enabled: e.target.checked})}
                        />
                        <span className={slaveForm.enabled ? 'status-text-enabled' : 'status-text-disabled'}>
                          {slaveForm.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 3: Register Mappings */}
                <div className="form-section">
                  <h4 className="form-section-title">Register Mappings</h4>
                  <p className="form-section-desc">Configure the Modbus registers to read from this slave device.</p>

                  <div className="form-subsection">
                    <h5 className="form-subsection-title">Add New Register</h5>
                    <div className="form-grid form-grid-auto">
                      {/* Row 1: Basic Info */}
                      <div className="form-group">
                        <label>Label *</label>
                        <input
                          type="text"
                          placeholder="e.g., Battery_Voltage"
                          value={registerForm.label}
                          onChange={(e) => setRegisterForm({...registerForm, label: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Address *</label>
                        <input
                          type="number"
                          placeholder="40001"
                          value={registerForm.address}
                          onChange={(e) => setRegisterForm({...registerForm, address: parseInt(e.target.value)})}
                          min="1"
                        />
                      </div>
                      <div className="form-group">
                        <label>Num Registers</label>
                        <input
                          type="number"
                          placeholder="1"
                          value={registerForm.num_registers || 1}
                          onChange={(e) => setRegisterForm({...registerForm, num_registers: parseInt(e.target.value)})}
                          min="1"
                          max="125"
                        />
                        <small className="form-hint">Count (1-125)</small>
                      </div>
                      <div className="form-group">
                        <label>Function Code *</label>
                        <select
                          value={registerForm.function_code || 3}
                          onChange={(e) => setRegisterForm({...registerForm, function_code: parseInt(e.target.value)})}
                        >
                          <option value={0x01}>0x01 - Read Coils</option>
                          <option value={0x02}>0x02 - Read Discrete Inputs</option>
                          <option value={0x03}>0x03 - Read Holding Registers</option>
                          <option value={0x04}>0x04 - Read Input Registers</option>
                          <option value={0x05}>0x05 - Write Single Coil</option>
                          <option value={0x06}>0x06 - Write Single Register</option>
                          <option value={0x0F}>0x0F - Write Multiple Coils</option>
                          <option value={0x10}>0x10 - Write Multiple Registers</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Register Type</label>
                        <select
                          value={registerForm.register_type || 3}
                          onChange={(e) => setRegisterForm({...registerForm, register_type: parseInt(e.target.value)})}
                        >
                          <option value={0}>Coil (0x - R/W Discrete)</option>
                          <option value={1}>Discrete Input (1x - RO Discrete)</option>
                          <option value={2}>Input Register (3x - RO Analog)</option>
                          <option value={3}>Holding Register (4x - R/W Analog)</option>
                        </select>
                      </div>

                      {/* Row 2: Data Type & Format */}
                      <div className="form-group">
                        <label>Data Type *</label>
                        <select
                          value={registerForm.data_type}
                          onChange={(e) => setRegisterForm({...registerForm, data_type: parseInt(e.target.value)})}
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
                      <div className="form-group">
                        <label>Byte Order</label>
                        <select
                          value={registerForm.byte_order || 0}
                          onChange={(e) => setRegisterForm({...registerForm, byte_order: parseInt(e.target.value)})}
                        >
                          <option value={0}>Big Endian (AB)</option>
                          <option value={1}>Little Endian (BA)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Word Order</label>
                        <select
                          value={registerForm.word_order || 0}
                          onChange={(e) => setRegisterForm({...registerForm, word_order: parseInt(e.target.value)})}
                        >
                          <option value={0}>Big Endian (AB CD)</option>
                          <option value={1}>Little Endian (CD AB)</option>
                          <option value={2}>Mid-Big Endian (BA DC)</option>
                          <option value={3}>Mid-Little Endian (DC BA)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Decimal Places</label>
                        <input
                          type="number"
                          placeholder="2"
                          value={registerForm.decimal_places || 2}
                          onChange={(e) => setRegisterForm({...registerForm, decimal_places: parseInt(e.target.value)})}
                          min="0"
                          max="6"
                        />
                      </div>
                      <div className="form-group">
                        <label>Access Mode</label>
                        <select
                          value={registerForm.access_mode || 0}
                          onChange={(e) => setRegisterForm({...registerForm, access_mode: parseInt(e.target.value)})}
                        >
                          <option value={0}>Read Only</option>
                          <option value={1}>Read/Write</option>
                          <option value={2}>Write Only</option>
                        </select>
                      </div>

                      {/* Row 3: Scaling & Units */}
                      <div className="form-group">
                        <label>Scale Factor</label>
                        <input
                          type="number"
                          placeholder="1.0"
                          value={registerForm.scale_factor}
                          onChange={(e) => setRegisterForm({...registerForm, scale_factor: parseFloat(e.target.value)})}
                          step="0.001"
                        />
                      </div>
                      <div className="form-group">
                        <label>Offset</label>
                        <input
                          type="number"
                          placeholder="0.0"
                          value={registerForm.offset}
                          onChange={(e) => setRegisterForm({...registerForm, offset: parseFloat(e.target.value)})}
                          step="0.01"
                        />
                      </div>
                      <div className="form-group">
                        <label>Unit</label>
                        <input
                          type="text"
                          placeholder="V, A, W, °C, etc."
                          value={registerForm.unit || ''}
                          onChange={(e) => setRegisterForm({...registerForm, unit: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <select
                          value={registerForm.category || 'Electrical'}
                          onChange={(e) => setRegisterForm({...registerForm, category: e.target.value})}
                        >
                          <option value="Electrical">Electrical</option>
                          <option value="Temperature">Temperature</option>
                          <option value="Status">Status</option>
                          <option value="Control">Control</option>
                          <option value="Energy">Energy</option>
                          <option value="Power">Power</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Row 4: Alarms & Status */}
                      <div className="form-group">
                        <label>High Alarm</label>
                        <input
                          type="number"
                          placeholder="Optional"
                          value={registerForm.high_alarm_threshold ?? ''}
                          onChange={(e) => setRegisterForm({...registerForm, high_alarm_threshold: e.target.value ? parseFloat(e.target.value) : null})}
                          step="0.01"
                        />
                      </div>
                      <div className="form-group">
                        <label>Low Alarm</label>
                        <input
                          type="number"
                          placeholder="Optional"
                          value={registerForm.low_alarm_threshold ?? ''}
                          onChange={(e) => setRegisterForm({...registerForm, low_alarm_threshold: e.target.value ? parseFloat(e.target.value) : null})}
                          step="0.01"
                        />
                      </div>
                      <div className="form-group checkbox-group">
                        <label>Enabled</label>
                        <label className="checkbox-label checkbox-vertical">
                          <input
                            type="checkbox"
                            checked={registerForm.enabled}
                            onChange={(e) => setRegisterForm({...registerForm, enabled: e.target.checked})}
                          />
                          <span>{registerForm.enabled ? 'Yes' : 'No'}</span>
                        </label>
                      </div>
                      <div className="form-group form-group-btn">
                        <button type="button" onClick={addRegister} className="btn btn-sm">
                          Add Register
                        </button>
                      </div>
                    </div>

                    {/* Description - full width */}
                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="e.g., 0=Off, 1=On, 2=Standby"
                        value={registerForm.description || ''}
                        onChange={(e) => setRegisterForm({...registerForm, description: e.target.value})}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Registers Table */}
                  {slaveForm.registers.length > 0 ? (
                    <div className="registers-table-wrapper">
                      <h5 className="form-subsection-title">Configured Registers ({slaveForm.registers.length})</h5>
                      <table className="table registers-table">
                        <thead>
                          <tr>
                            <th>Label</th>
                            <th>Address</th>
                            <th>Function</th>
                            <th>Data Type</th>
                            <th>Unit</th>
                            <th>Scale</th>
                            <th>Offset</th>
                            <th>Category</th>
                            <th>Alarms</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slaveForm.registers.map((reg, index) => (
                            <tr key={index}>
                              <td>{reg.label}</td>
                              <td>{reg.address}</td>
                              <td>{reg.functionCode || 3}</td>
                              <td>{getDataTypeName(reg.dataType)}</td>
                              <td>{reg.unit || '-'}</td>
                              <td>{reg.scaleFactor}</td>
                              <td>{reg.offset}</td>
                              <td>{reg.category || '-'}</td>
                              <td>
                                {reg.highAlarmThreshold || reg.lowAlarmThreshold ? (
                                  <small>
                                    {reg.highAlarmThreshold && `H:${reg.highAlarmThreshold}`}
                                    {reg.highAlarmThreshold && reg.lowAlarmThreshold && ' / '}
                                    {reg.lowAlarmThreshold && `L:${reg.lowAlarmThreshold}`}
                                  </small>
                                ) : '-'}
                              </td>
                              <td>
                                <span className={`status-badge ${reg.enabled ? 'status-badge-success' : 'status-badge-danger'}`}>
                                  {reg.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => removeRegister(index)}
                                  className="btn-icon btn-icon-danger"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      No registers configured yet. Add registers above to define what data to read from this slave device.
                    </div>
                  )}
                </div>

              </form>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={(e) => { e.preventDefault(); handleSaveSlave(); }}>
                {editingSlave ? 'Save Changes' : 'Create Slave'}
              </button>
              <button type="button" onClick={() => { setCreatingSlave(false); setEditingSlave(null); }} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicePresets;
