import React, { useState, useEffect, useCallback } from 'react';
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

  const fetchSlaves = useCallback(async (configId: string) => {
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
  }, []);

  const fetchConfiguration = useCallback(async () => {
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
