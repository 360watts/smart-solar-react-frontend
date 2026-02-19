import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface GatewayConfig {
  configId: string;
  updatedAt: string;
  configSchemaVer: number;
  uartConfig: {
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: number;
  };
  slaves: SlaveDevice[];
}

interface SlaveDevice {
  id: number;
  slaveId: number;
  deviceName: string;
  pollingIntervalMs: number;
  timeoutMs: number;
  priority?: number;
  enabled: boolean;
  configId?: number | null;
  configName?: string;
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

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [globalMode, setGlobalMode] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | ''>('');
  const [slaveForm, setSlaveForm] = useState({
    slave_id: '',
    device_name: '',
    polling_interval_ms: 5000,
    timeout_ms: 1000,
    priority: 1,
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
    enabled: true
  });

  const mapSlave = (slave: any): SlaveDevice => ({
    id: slave.id,
    slaveId: slave.slave_id,
    deviceName: slave.device_name,
    pollingIntervalMs: slave.polling_interval_ms,
    timeoutMs: slave.timeout_ms,
    priority: slave.priority,
    enabled: slave.enabled,
    configId: slave.config_id ?? null,
    configName: slave.config_name ?? 'global',
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

  useEffect(() => {
    const loadAllSlaves = async () => {
      try {
        // Default to listing all slaves across presets
        const slavesResult = await apiService.getGlobalSlaves();
        setSlaves(slavesResult.map(mapSlave));
        setConfig(null);
        setGlobalMode(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    loadAllSlaves();
  }, []);

  

  const handleCreateSlave = () => {
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      priority: 1,
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
      priority: slave.priority || 1,
      enabled: slave.enabled,
      registers: [...slave.registers]
    });
    setEditingSlave(slave);
  };

  const handleSaveSlave = async () => {
    // Treat missing preset selection as global: allow creating slaves without any config
    const isGlobal = globalMode || !config || (!editingSlave && !selectedPresetId);

    // In global mode, allow creating a slave without attaching to a preset (global slave)

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
        const updatedSlave = isGlobal
          ? await apiService.updateGlobalSlave(editingSlave.id, slaveData)
          : await apiService.updateSlave(config!.configId, editingSlave.slaveId, slaveData);
        const mappedSlave = mapSlave(updatedSlave);
        setSlaves(slaves.map(s => s.id === editingSlave.id ? mappedSlave : s));
        setEditingSlave(null);
      } else {
        const newSlave = isGlobal
          ? await apiService.createGlobalSlave(selectedPresetId ? { ...slaveData, config_id: selectedPresetId } : slaveData)
          : await apiService.createSlave(config!.configId, slaveData);
        const mappedSlave = mapSlave(newSlave);
        setSlaves([...slaves, mappedSlave]);
      }

      setCreatingSlave(false);
      setSelectedPresetId('');
      setSlaveForm({
        slave_id: '',
        device_name: '',
        polling_interval_ms: 5000,
        timeout_ms: 1000,
        priority: 1,
        enabled: true,
        registers: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save slave');
    }
  };

  const handleDeleteSlave = async (slave: SlaveDevice) => {
    const isGlobal = globalMode || !config;

    if (window.confirm(`Are you sure you want to delete slave ${slave.deviceName}?`)) {
      try {
        if (isGlobal) {
          await apiService.deleteGlobalSlave(slave.id);
        } else {
          await apiService.deleteSlave(config.configId, slave.slaveId);
        }
        setSlaves(slaves.filter(s => s.id !== slave.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete slave');
      }
    }
  };

  const handleCancel = () => {
    setCreatingSlave(false);
    setEditingSlave(null);
    setSelectedPresetId('');
    setSlaveForm({
      slave_id: '',
      device_name: '',
      polling_interval_ms: 5000,
      timeout_ms: 1000,
      priority: 1,
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

      {/* Show global error banner only when modal is not open */}
      {!creatingSlave && !editingSlave && error && (
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

      <div className="card">
        <div className="card-header">
          <h2>All Slave Devices ({slaves.length})</h2>
          <button onClick={handleCreateSlave} className="btn">Configure New Slave</button>
        </div>

        {slaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <p>No slave devices configured yet.</p>
            <p>Click "Configure New Slave" to add your first slave device.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Slave ID</th>
                <th style={{ textAlign: 'center' }}>Device Name</th>
                <th style={{ textAlign: 'center' }}>Config</th>
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
                  <td style={{ textAlign: 'center' }}>{slave.deviceName}</td>
                  <td style={{ textAlign: 'center' }}>{(slave as any).configName || 'global'}</td>
                  <td style={{ textAlign: 'center' }}>{slave.pollingIntervalMs}ms</td>
                  <td style={{ textAlign: 'center' }}>{slave.timeoutMs}ms</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={slave.enabled ? 'status-online' : 'status-offline'}>
                      {slave.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{slave.registers.length}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => handleEditSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '0 6px', color: '#6366f1' }} title="Edit">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', margin: '0 6px' }} title="Delete">
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

      {/* Slave Configuration Modal */}
      {(creatingSlave || editingSlave) && (
        <div className="modal">
          <div className="modal-content large-modal slave-config-modal">
            <h3>{editingSlave ? `Edit Slave: ${editingSlave.deviceName}` : 'Configure New Slave'}</h3>
            
            <div className="modal-body">
              {/* Show errors inside modal when configuring/creating a slave */}
              {error && (
                <div className="error" style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', color: '#721c24' }}>
                  <strong>Error:</strong> {error}
                  <button
                    onClick={() => setError(null)}
                    style={{ float: 'right', background: 'none', border: 'none', color: '#721c24', cursor: 'pointer', fontSize: '14px' }}
                    title="Close error"
                  >
                    ×
                  </button>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSlave(); }}>
                
                {/* Config selector removed: creating a new slave no longer requires selecting a preset */}

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
                  <div className="form-grid form-grid-4">
                    <div className="form-group">
                      <label>Polling Interval (ms)</label>
                      <input
                        type="number"
                        value={slaveForm.polling_interval_ms}
                        onChange={(e) => setSlaveForm({...slaveForm, polling_interval_ms: parseInt(e.target.value)})}
                        min="100"
                        placeholder="10000"
                      />
                      <small className="form-hint">How often to poll this device</small>
                    </div>
                    <div className="form-group">
                      <label>Response Timeout (ms)</label>
                      <input
                        type="number"
                        value={slaveForm.timeout_ms}
                        onChange={(e) => setSlaveForm({...slaveForm, timeout_ms: parseInt(e.target.value)})}
                        min="100"
                        placeholder="1000"
                      />
                      <small className="form-hint">Max wait for response</small>
                    </div>
                    <div className="form-group">
                      <label>Priority</label>
                      <input
                        type="number"
                        value={slaveForm.priority || 1}
                        onChange={(e) => setSlaveForm({...slaveForm, priority: parseInt(e.target.value)})}
                        min="1"
                        max="10"
                        placeholder="1"
                      />
                      <small className="form-hint">1=Highest, 10=Lowest</small>
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
                      {/* Row 1: Basic Info */}
                      <div className="form-group">
                        <label>Label *</label>
                        <input
                          type="text"
                          placeholder="e.g., Battery_Voltage"
                          value={registerForm.label}
                          onChange={(e) => setRegisterForm({...registerForm, label: e.target.value})}
                          required
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
                          required
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
                          <option value={0}>Big Endian (ABCD)</option>
                          <option value={1}>Little Endian (DCBA)</option>
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
                          value={registerForm.high_alarm_threshold || ''}
                          onChange={(e) => setRegisterForm({...registerForm, high_alarm_threshold: parseFloat(e.target.value) || null})}
                          step="0.01"
                        />
                      </div>
                      <div className="form-group">
                        <label>Low Alarm</label>
                        <input
                          type="number"
                          placeholder="Optional"
                          value={registerForm.low_alarm_threshold || ''}
                          onChange={(e) => setRegisterForm({...registerForm, low_alarm_threshold: parseFloat(e.target.value) || null})}
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
                    
                    {/* Description Field - Full Width */}
                    <div className="form-group" style={{marginTop: '10px'}}>
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="e.g., 0=Off, 1=On, 2=Standby"
                        value={registerForm.description || ''}
                        onChange={(e) => setRegisterForm({...registerForm, description: e.target.value})}
                        style={{width: '100%'}}
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
    5: 'UINT64',
    6: 'INT64',
    7: 'FLOAT64',
    8: 'BOOL',
    9: 'STRING'
  };
  return types[dataType as keyof typeof types] || `Unknown (${dataType})`;
};

export default Configuration;
