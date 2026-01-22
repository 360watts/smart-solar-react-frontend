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
  registers: RegisterMapping[];
}

interface RegisterMapping {
  id: number;
  label: string;
  address: number;
  numRegisters: number;
  functionCode: number;
  dataType: number;
  scaleFactor: number;
  offset: number;
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
    data_type: 0,
    scale_factor: 1.0,
    offset: 0.0,
    enabled: true
  });

  useEffect(() => {
    fetchPresets();
  }, []);

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
  };

  const handleSave = async () => {
    if (!editingPreset) return;

    try {
      const updatedPreset = await apiService.updatePreset(editingPreset.id, editForm);
      const updatedPresets = presets.map(p => p.id === editingPreset.id ? updatedPreset : p);
      setPresets(updatedPresets);
      // Also update filtered presets to reflect the changes immediately
      const searchLower = searchTerm.toLowerCase();
      const updatedFiltered = updatedPresets.filter((preset: Preset) =>
        preset.name.toLowerCase().includes(searchLower) ||
        preset.config_id.toLowerCase().includes(searchLower) ||
        preset.description.toLowerCase().includes(searchLower)
      );
      setFilteredPresets(updatedFiltered);
      setEditingPreset(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preset');
    }
  };

  const handleCreate = async () => {
    try {
      const newPreset = await apiService.createPreset(createForm);
      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      // Also update filtered presets to show the new preset immediately
      const searchLower = searchTerm.toLowerCase();
      const updatedFiltered = updatedPresets.filter((preset: Preset) =>
        preset.name.toLowerCase().includes(searchLower) ||
        preset.config_id.toLowerCase().includes(searchLower) ||
        preset.description.toLowerCase().includes(searchLower)
      );
      setFilteredPresets(updatedFiltered);
      setCreatingPreset(false);
      setCreateForm({
        name: '',
        description: '',
        baud_rate: 9600,
        data_bits: 8,
        stop_bits: 1,
        parity: 0,
      });
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
  };

  const getDataTypeName = (dataType: number): string => {
    const types = ['UINT16', 'INT16', 'UINT32', 'INT32', 'FLOAT32', 'FLOAT64'];
    return types[dataType] || 'UNKNOWN';
  };

  const handleConfigureSlaves = async (preset: Preset) => {
    setConfiguringSlaves(preset);
    await fetchSlavesForPreset(preset.config_id);
  };

  const fetchSlavesForPreset = async (configId: string) => {
    try {
      const slavesData = await apiService.getSlaves(configId);
      // Map API response to match interface
      const mappedSlaves = slavesData.map((slave: any) => ({
        id: slave.id,
        slaveId: slave.slave_id,
        deviceName: slave.device_name,
        pollingIntervalMs: slave.polling_interval_ms,
        timeoutMs: slave.timeout_ms,
        enabled: slave.enabled,
        registers: slave.registers.map((reg: any) => ({
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
      }));
      setSlaves(mappedSlaves);
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
      id: Date.now(), // Temporary ID for form management
      label: registerForm.label,
      address: registerForm.address,
      numRegisters: registerForm.num_registers,
      functionCode: registerForm.function_code,
      dataType: registerForm.data_type,
      scaleFactor: registerForm.scale_factor,
      offset: registerForm.offset,
      enabled: registerForm.enabled
    };

    setSlaveForm({
      ...slaveForm,
      registers: [...slaveForm.registers, newRegister]
    });

    // Reset register form
    setRegisterForm({
      label: '',
      address: 0,
      num_registers: 1,
      function_code: 3,
      data_type: 0,
      scale_factor: 1.0,
      offset: 0.0,
      enabled: true
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
                <td>{preset.name}</td>
                <td>{preset.config_id}</td>
                <td>{preset.description}</td>
                <td>{preset.slaves_count || 0}</td>
                <td>
                  <button onClick={() => handleViewDetails(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="View Details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                  <button onClick={() => handleConfigureSlaves(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007bff' }} title="Configure Slaves">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="21" y1="3" x2="3" y2="21"></line>
                    </svg>
                  </button>
                  <button onClick={() => handleEdit(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(preset)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }} title="Delete">
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
            <form onSubmit={(e) => { e.preventDefault(); editingPreset ? handleSave() : handleCreate(); }}>
              {editingPreset && (
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Config ID:</label>
                  <input
                    type="text"
                    value={editForm.config_id}
                    onChange={(e) => setEditForm({...editForm, config_id: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Name:</label>
                <input
                  type="text"
                  value={editingPreset ? editForm.name : createForm.name}
                  onChange={(e) => editingPreset ? setEditForm({...editForm, name: e.target.value}) : setCreateForm({...createForm, name: e.target.value})}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Description:</label>
                <textarea
                  value={editingPreset ? editForm.description : createForm.description}
                  onChange={(e) => editingPreset ? setEditForm({...editForm, description: e.target.value}) : setCreateForm({...createForm, description: e.target.value})}
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Baud Rate:</label>
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
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Data Bits:</label>
                <select
                  value={editingPreset ? editForm.data_bits : createForm.data_bits}
                  onChange={(e) => editingPreset ? setEditForm({...editForm, data_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, data_bits: parseInt(e.target.value)})}
                >
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Stop Bits:</label>
                <select
                  value={editingPreset ? editForm.stop_bits : createForm.stop_bits}
                  onChange={(e) => editingPreset ? setEditForm({...editForm, stop_bits: parseInt(e.target.value)}) : setCreateForm({...createForm, stop_bits: parseInt(e.target.value)})}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Parity:</label>
                <select
                  value={editingPreset ? editForm.parity : createForm.parity}
                  onChange={(e) => editingPreset ? setEditForm({...editForm, parity: parseInt(e.target.value)}) : setCreateForm({...createForm, parity: parseInt(e.target.value)})}
                >
                  <option value={0}>None</option>
                  <option value={1}>Odd</option>
                  <option value={2}>Even</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">{editingPreset ? 'Save' : 'Create'}</button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPreset && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3>Gateway Configuration: {selectedPreset.name}</h3>
            <div style={{ marginBottom: '20px' }}>
              <h4>General Settings</h4>
              <div style={{ marginLeft: '20px' }}>
                <p><strong>Config ID:</strong> {selectedPreset.gateway_configuration.general_settings.config_id}</p>
                <p><strong>Schema Version:</strong> {selectedPreset.gateway_configuration.general_settings.schema_version}</p>
                <p><strong>Last Updated:</strong> {selectedPreset.gateway_configuration.general_settings.last_updated}</p>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4>UART Configuration</h4>
              <div style={{ marginLeft: '20px' }}>
                <p><strong>Baud Rate:</strong> {selectedPreset.gateway_configuration.uart_configuration.baud_rate}</p>
                <p><strong>Data Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.data_bits}</p>
                <p><strong>Stop Bits:</strong> {selectedPreset.gateway_configuration.uart_configuration.stop_bits}</p>
                <p><strong>Parity:</strong> {selectedPreset.gateway_configuration.uart_configuration.parity}</p>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Description:</strong> {selectedPreset.description}</p>
              <p><strong>Slave Devices:</strong> {selectedPreset.slaves_count}</p>
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
                          <button onClick={() => handleEditSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }} title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }} title="Delete">
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

      {(creatingSlave || editingSlave) && configuringSlaves && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>{editingSlave ? `Edit Slave: ${editingSlave.deviceName}` : 'Configure New Slave'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveSlave(); }}>
              {/* Basic Slave Information */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#555' }}>Basic Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Slave ID:</label>
                    <input
                      type="number"
                      value={slaveForm.slave_id}
                      onChange={(e) => setSlaveForm({...slaveForm, slave_id: e.target.value})}
                      required
                      min="1"
                      max="247"
                      autoComplete="off"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <small style={{ color: '#666', fontSize: '0.8em' }}>
                      Unique identifier (1-247)
                      {slaves.length > 0 && (
                        <span style={{ display: 'block', marginTop: '3px', color: '#007bff' }}>
                          Existing IDs: {slaves.map(s => s.slaveId).join(', ')}
                        </span>
                      )}
                    </small>
                  </div>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Device Name:</label>
                    <input
                      type="text"
                      value={slaveForm.device_name}
                      onChange={(e) => setSlaveForm({...slaveForm, device_name: e.target.value})}
                      required
                      autoComplete="off"
                      placeholder="e.g., Solar Inverter"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Communication Settings */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#555' }}>Communication Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Polling Interval (ms):</label>
                    <input
                      type="number"
                      value={slaveForm.polling_interval_ms}
                      onChange={(e) => setSlaveForm({...slaveForm, polling_interval_ms: parseInt(e.target.value)})}
                      min="100"
                      autoComplete="off"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <small style={{ color: '#666', fontSize: '0.8em' }}>How often to poll this device</small>
                  </div>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Timeout (ms):</label>
                    <input
                      type="number"
                      value={slaveForm.timeout_ms}
                      onChange={(e) => setSlaveForm({...slaveForm, timeout_ms: parseInt(e.target.value)})}
                      min="100"
                      autoComplete="off"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <small style={{ color: '#666', fontSize: '0.8em' }}>Response timeout</small>
                  </div>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Status:</label>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                      <input
                        type="checkbox"
                        checked={slaveForm.enabled}
                        onChange={(e) => setSlaveForm({...slaveForm, enabled: e.target.checked})}
                        style={{ marginRight: '8px', transform: 'scale(1.2)' }}
                      />
                      <span style={{ fontWeight: 'bold', color: slaveForm.enabled ? '#28a745' : '#dc3545' }}>
                        {slaveForm.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Register Mappings */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#555' }}>Register Mappings</h4>
                <p style={{ color: '#666', marginBottom: '15px', fontSize: '0.9em' }}>
                  Configure the Modbus registers to read from this slave device.
                </p>

                {/* Add Register Form */}
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h5 style={{ marginBottom: '10px', color: '#333' }}>Add New Register</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Label:</label>
                      <input
                        type="text"
                        placeholder="e.g., voltage"
                        value={registerForm.label}
                        onChange={(e) => setRegisterForm({...registerForm, label: e.target.value})}
                        autoComplete="off"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9em' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Address:</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm({...registerForm, address: parseInt(e.target.value)})}
                        min="0"
                        autoComplete="off"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9em' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Data Type:</label>
                      <select
                        value={registerForm.data_type}
                        onChange={(e) => setRegisterForm({...registerForm, data_type: parseInt(e.target.value)})}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9em' }}
                      >
                        <option value={0}>UINT16</option>
                        <option value={1}>INT16</option>
                        <option value={2}>UINT32</option>
                        <option value={3}>INT32</option>
                        <option value={4}>FLOAT32</option>
                        <option value={5}>FLOAT64</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Scale:</label>
                      <input
                        type="number"
                        placeholder="1.0"
                        value={registerForm.scale_factor}
                        onChange={(e) => setRegisterForm({...registerForm, scale_factor: parseFloat(e.target.value)})}
                        step="0.01"
                        autoComplete="off"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9em' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Offset:</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={registerForm.offset}
                        onChange={(e) => setRegisterForm({...registerForm, offset: parseFloat(e.target.value)})}
                        step="0.01"
                        autoComplete="off"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9em' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em', fontWeight: 'bold' }}>Enabled:</label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={registerForm.enabled}
                          onChange={(e) => setRegisterForm({...registerForm, enabled: e.target.checked})}
                          style={{ marginRight: '5px', transform: 'scale(1.1)' }}
                        />
                        <span style={{ fontSize: '0.9em' }}>Active</span>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <button
                        type="button"
                        onClick={addRegister}
                        className="btn"
                        style={{ padding: '8px 16px', fontSize: '0.9em' }}
                      >
                        Add Register
                      </button>
                    </div>
                  </div>
                </div>

                {/* Current Registers Table */}
                {slaveForm.registers.length > 0 && (
                  <div>
                    <h5 style={{ marginBottom: '10px', color: '#333' }}>Configured Registers ({slaveForm.registers.length})</h5>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.9em' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '8px' }}>Label</th>
                            <th style={{ padding: '8px' }}>Address</th>
                            <th style={{ padding: '8px' }}>Data Type</th>
                            <th style={{ padding: '8px' }}>Scale</th>
                            <th style={{ padding: '8px' }}>Offset</th>
                            <th style={{ padding: '8px' }}>Status</th>
                            <th style={{ padding: '8px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slaveForm.registers.map((reg, index) => (
                            <tr key={index}>
                              <td style={{ padding: '8px' }}>{reg.label}</td>
                              <td style={{ padding: '8px' }}>{reg.address}</td>
                              <td style={{ padding: '8px' }}>{getDataTypeName(reg.dataType)}</td>
                              <td style={{ padding: '8px' }}>{reg.scaleFactor}</td>
                              <td style={{ padding: '8px' }}>{reg.offset}</td>
                              <td style={{ padding: '8px' }}>
                                <span className={reg.enabled ? 'status-online' : 'status-offline'} style={{ fontSize: '0.8em', padding: '2px 6px', borderRadius: '3px' }}>
                                  {reg.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              </td>
                              <td style={{ padding: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => removeRegister(index)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red', fontSize: '0.8em' }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {slaveForm.registers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontStyle: 'italic' }}>
                    No registers configured yet. Add registers above to define what data to read from this slave device.
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '20px' }}>
                <button type="submit" className="btn" style={{ backgroundColor: '#007bff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1em' }}>
                  {editingSlave ? 'Save Changes' : 'Create Slave'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingSlave(false);
                    setEditingSlave(null);
                  }}
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#6c757d', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1em', marginLeft: '10px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicePresets;