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

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [slaveForm, setSlaveForm] = useState({
    slave_id: '',
    device_name: '',
    polling_interval_ms: 5000,
    timeout_ms: 1000,
    enabled: true,
    registers: [] as RegisterMapping[]
  });
  const [slaveIdError, setSlaveIdError] = useState<string>('');
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
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      const data = await apiService.getConfiguration();
      setConfig(data);
      // Fetch slaves for the current config
      if (data.configId) {
        await fetchSlaves(data.configId);
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
  };

  const fetchSlaves = async (configId: string) => {
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
    }
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
        const updatedSlave = await apiService.updateSlave(config.configId, editingSlave.slaveId, slaveData);
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
        setSlaves(slaves.map(s => s.slaveId === editingSlave.slaveId ? mappedSlave : s));
        setEditingSlave(null);
      } else {
        const newSlave = await apiService.createSlave(config.configId, slaveData);
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
        setSlaves([...slaves, mappedSlave]);
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
    if (!config) return;

    if (window.confirm(`Are you sure you want to delete slave ${slave.deviceName}?`)) {
      try {
        await apiService.deleteSlave(config.configId, slave.slaveId);
        setSlaves(slaves.filter(s => s.id !== slave.id));
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

      {(creatingSlave || editingSlave) && (
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
                  onClick={handleCancel}
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