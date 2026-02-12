import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// Comprehensive Modbus Configuration Interfaces
interface DevicePreset {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  device_type: string;
  description: string;
  version: string;
  is_active: boolean;
  default_baud_rate: number;
  default_parity: string;
  default_data_bits: number;
  default_stop_bits: number;
  default_timeout_ms: number;
  default_poll_interval_ms: number;
  register_count: number;
  registers: PresetRegister[];
}

interface PresetRegister {
  id: number;
  name: string;
  address: number;
  register_type: string;
  function_code: number;
  register_count: number;
  data_type: string;
  byte_order: string;
  word_order?: string;
  scale_factor: number;
  offset: number;
  unit: string;
  category: string;
  decimal_places: number;
  min_value?: number;
  max_value?: number;
  description: string;
  value_mapping: Record<string, string>;
  is_required: boolean;
  display_order: number;
}

interface GatewayConfig {
  id: number;
  config_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  config_schema_ver: number;
  
  // Communication Layer
  protocol_type: string;
  baud_rate: number;
  parity: string;
  data_bits: number;
  stop_bits: number;
  interface_type: string;
  
  // Timing Configuration
  global_response_timeout_ms: number;
  inter_frame_delay_ms: number;
  global_retry_count: number;
  global_retry_delay_ms: number;
  global_poll_interval_ms: number;
  
  // Related data
  slaves: SlaveDevice[];
  slave_count: number;
  total_registers: number;
}

interface SlaveDevice {
  id: number;
  slave_id: number;
  device_name: string;
  device_type: string;
  enabled: boolean;
  polling_interval_ms: number;
  response_timeout_ms: number;
  retry_count: number;
  retry_delay_ms: number;
  priority: string;
  description: string;
  preset?: number;
  preset_name?: string;
  registers: RegisterMapping[];
  register_count: number;
}

interface RegisterMapping {
  id: number;
  name: string;
  address: number;
  register_type: string;
  function_code: number;
  register_count: number;
  enabled: boolean;
  
  // Data Interpretation
  data_type: string;
  byte_order: string;
  word_order?: string;
  bit_position?: number;
  
  // Value Transformation
  scale_factor: number;
  offset: number;
  formula?: string;
  decimal_places: number;
  
  // Metadata & Validation
  unit: string;
  category: string;
  min_value?: number;
  max_value?: number;
  dead_band?: number;
  access_mode: string;
  
  // Alarm Configuration
  high_alarm_threshold?: number;
  low_alarm_threshold?: number;
  
  // Additional
  value_mapping: Record<string, string>;
  string_length?: number;
  is_signed: boolean;
  description: string;
  preset_register?: number;
  preset_register_name?: string;
}

const Configuration: React.FC = () => {
  // State management
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [presets, setPresets] = useState<DevicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('communication');
  
  // Form states
  const [editingConfig, setEditingConfig] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [editingRegister, setEditingRegister] = useState<RegisterMapping | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset | null>(null);
  
  // Communication Layer Form
  const [commForm, setCommForm] = useState({
    protocol_type: 'RTU',
    baud_rate: 9600,
    parity: 'N',
    data_bits: 8,
    stop_bits: 1,
    interface_type: 'RS485',
    global_response_timeout_ms: 1000,
    inter_frame_delay_ms: 50,
    global_retry_count: 3,
    global_retry_delay_ms: 100,
    global_poll_interval_ms: 5000
  });
  
  // Slave Device Form
  const [slaveForm, setSlaveForm] = useState({
    slave_id: 1,
    device_name: '',
    device_type: '',
    enabled: true,
    polling_interval_ms: 5000,
    response_timeout_ms: 1000,
    retry_count: 3,
    retry_delay_ms: 100,
    priority: 'NORMAL',
    description: '',
    preset: null as number | null
  });
  
  // Register Mapping Form
  const [registerForm, setRegisterForm] = useState({
    name: '',
    address: 0,
    register_type: 'HOLDING',
    function_code: 3,
    register_count: 1,
    enabled: true,
    data_type: 'UINT16',
    byte_order: 'BE',
    word_order: 'BE',
    bit_position: null as number | null,
    scale_factor: 1.0,
    offset: 0.0,
    formula: '',
    decimal_places: 2,
    unit: '',
    category: '',
    min_value: null as number | null,
    max_value: null as number | null,
    dead_band: null as number | null,
    access_mode: 'R',
    high_alarm_threshold: null as number | null,
    low_alarm_threshold: null as number | null,
    value_mapping: {},
    string_length: null as number | null,
    is_signed: true,
    description: ''
  });

  // Data fetching functions
  const fetchConfiguration = useCallback(async () => {
    try {
      const data = await apiService.get('/modbus/configurations/summary/');
      if (data.configurations && data.configurations.length > 0) {
        // Get the first configuration for now, extend for multiple configs later
        const configData = await apiService.get(`/modbus/configurations/${data.configurations[0].config_id}/`);
        setConfig(configData);
        setCommForm({
          protocol_type: configData.protocol_type,
          baud_rate: configData.baud_rate,
          parity: configData.parity,
          data_bits: configData.data_bits,
          stop_bits: configData.stop_bits,
          interface_type: configData.interface_type,
          global_response_timeout_ms: configData.global_response_timeout_ms,
          inter_frame_delay_ms: configData.inter_frame_delay_ms,
          global_retry_count: configData.global_retry_count,
          global_retry_delay_ms: configData.global_retry_delay_ms,
          global_poll_interval_ms: configData.global_poll_interval_ms
        });
      }
    } catch (err) {
      console.error('Failed to fetch configuration:', err);
      setError('Failed to load configuration');
    }
  }, []);
  
  const fetchPresets = useCallback(async () => {
    try {
      const data = await apiService.get('/modbus/presets/');
      setPresets(data.results || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  }, []);
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConfiguration(), fetchPresets()]);
      setLoading(false);
    };
    loadData();
  }, [fetchConfiguration, fetchPresets]);
  
  // Form handlers
  const handleSaveCommunication = async () => {
    if (!config) return;
    
    try {
      const updatedConfig = await apiService.put(`/modbus/configurations/${config.config_id}/`, commForm);
      setConfig(updatedConfig);
      setEditingConfig(false);
    } catch (err) {
      console.error('Failed to save communication settings:', err);
      setError('Failed to save communication settings');
    }
  };
  
  const handleCreateSlave = async () => {
    if (!config) return;
    
    try {
      const newSlave = await apiService.post(`/modbus/configurations/${config.config_id}/slaves/create/`, slaveForm);
      const updatedConfig = await apiService.get(`/modbus/configurations/${config.config_id}/`);
      setConfig(updatedConfig);
      setSlaveForm({
        slave_id: 1,
        device_name: '',
        device_type: '',
        enabled: true,
        polling_interval_ms: 5000,
        response_timeout_ms: 1000,
        retry_count: 3,
        retry_delay_ms: 100,
        priority: 'NORMAL',
        description: '',
        preset: null
      });
    } catch (err) {
      console.error('Failed to create slave:', err);
      setError('Failed to create slave device');
    }
  };
  
  const handleApplyPreset = async (slaveId: number, presetId: number) => {
    if (!config) return;
    
    try {
      await apiService.post(`/modbus/configurations/${config.config_id}/slaves/${slaveId}/apply-preset/`, {
        preset_id: presetId,
        overwrite: true
      });
      const updatedConfig = await apiService.get(`/modbus/configurations/${config.config_id}/`);
      setConfig(updatedConfig);
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setError('Failed to apply preset');
    }
  };
  
  const handleCreateRegister = async (slaveId: number) => {
    if (!config) return;
    
    try {
      await apiService.post(`/modbus/configurations/${config.config_id}/slaves/${slaveId}/registers/create/`, registerForm);
      const updatedConfig = await apiService.get(`/modbus/configurations/${config.config_id}/`);
      setConfig(updatedConfig);
      setEditingRegister(null);
    } catch (err) {
      console.error('Failed to create register:', err);
      setError('Failed to create register mapping');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-red-500 text-center">
            <h2 className="text-xl font-semibold mb-4">Error</h2>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
      }
      setLoading(false);
    } catch (err) {
      // If no configuration exists, set config to null
      if (err instanceof Error && err.message.includes('No configuration available')) {
        setConfig(null);
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      setLoading(false);
    }
  }, [fetchSlaves]);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

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
    if (!config) return;

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
        await apiService.updateSlave(config.configId, editingSlave.slaveId, slaveData);
        setEditingSlave(null);
      } else {
        await apiService.createSlave(config.configId, slaveData);
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
      
      // Refetch to get updated slave list
      await fetchSlaves(config.configId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save slave');
    }
  };

  const handleDeleteSlave = async (slave: SlaveDevice) => {
    if (!config) return;

    if (window.confirm(`Are you sure you want to delete slave ${slave.deviceName}?`)) {
      try {
        await apiService.deleteSlave(config.configId, slave.slaveId);
        // Refetch slaves to update the list
        await fetchSlaves(config.configId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete slave');
      }
    }
  };

  const handleCancel = () => {
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
    return <div className="loading">Loading configuration...</div>;
  }

  return (
    <div>
      <h1>Slave Configuration</h1>

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

      {!config ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h3>No Configuration Available</h3>
            <p>Create a preset in the Device Presets section first, then configure slaves here.</p>
          </div>
        </div>
      ) : (
        <div className="card">
        <div className="card-header">
          <h2>Slave Devices ({slaves.length})</h2>
          <button onClick={handleCreateSlave} className="btn">Configure New Slave</button>
        </div>

        {slaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <p>No slave devices configured yet.</p>
            <p>Click "Create New Slave" to add your first slave device.</p>
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
      )}

      {/* Slave Configuration Modal */}
      {(creatingSlave || editingSlave) && (
        <div className="modal">
          <div className="modal-content large-modal slave-config-modal">
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

                  {/* Add Register Sub-form */}
                  <div className="form-subsection">
                    <h5 className="form-subsection-title">Add New Register</h5>
                    <div className="form-grid form-grid-auto">
                      <div className="form-group">
                        <label>Label</label>
                        <input
                          type="text"
                          placeholder="e.g., voltage"
                          value={registerForm.label}
                          onChange={(e) => setRegisterForm({...registerForm, label: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={registerForm.address}
                          onChange={(e) => setRegisterForm({...registerForm, address: parseInt(e.target.value)})}
                          min="0"
                        />
                      </div>
                      <div className="form-group">
                        <label>Data Type</label>
                        <select
                          value={registerForm.data_type}
                          onChange={(e) => setRegisterForm({...registerForm, data_type: parseInt(e.target.value)})}
                        >
                          <option value={0}>UINT16</option>
                          <option value={1}>INT16</option>
                          <option value={2}>UINT32</option>
                          <option value={3}>INT32</option>
                          <option value={4}>FLOAT32</option>
                          <option value={5}>FLOAT64</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Scale</label>
                        <input
                          type="number"
                          placeholder="1.0"
                          value={registerForm.scale_factor}
                          onChange={(e) => setRegisterForm({...registerForm, scale_factor: parseFloat(e.target.value)})}
                          step="0.01"
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
                      <div className="form-group checkbox-group">
                        <label>Active</label>
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
                            <th>Data Type</th>
                            <th>Scale</th>
                            <th>Offset</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slaveForm.registers.map((reg, index) => (
                            <tr key={index}>
                              <td>{reg.label}</td>
                              <td>{reg.address}</td>
                              <td>{getDataTypeName(reg.dataType)}</td>
                              <td>{reg.scaleFactor}</td>
                              <td>{reg.offset}</td>
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
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getDataTypeName = (dataType: number): string => {
  const types = {
    0: 'UINT16',
    1: 'INT16',
    2: 'UINT32',
    3: 'INT32',
    4: 'FLOAT32',
    5: 'FLOAT64'
  };
  return types[dataType as keyof typeof types] || `Unknown (${dataType})`;
};

export default Configuration;
