import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, Trash2, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import SlaveConfigModal, { SlaveFormData } from './SlaveConfigModal';

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
  registers: any[];
}

const Configuration: React.FC = () => {
  const { isDark } = useTheme();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [globalMode] = useState(true);
  const [slaveSearch, setSlaveSearch] = useState('');

  // Delete / success modals
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; slave: SlaveDevice | null }>({ show: false, slave: null });
  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

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
      registerType: reg.register_type,
      byteOrder: reg.byte_order,
      wordOrder: reg.word_order,
      accessMode: reg.access_mode,
      unit: reg.unit,
      decimalPlaces: reg.decimal_places,
      category: reg.category,
      highAlarmThreshold: reg.high_alarm_threshold,
      lowAlarmThreshold: reg.low_alarm_threshold,
      description: reg.description,
    })),
  });

  useEffect(() => {
    (async () => {
      try {
        const slavesResult = await apiService.getGlobalSlaves();
        setSlaves(slavesResult.map(mapSlave));
        setConfig(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Modal initialForm (for edit mode) ──────────────────────────────────────

  const editInitialForm: SlaveFormData | undefined = editingSlave
    ? {
        slave_id: editingSlave.slaveId.toString(),
        device_name: editingSlave.deviceName,
        polling_interval_ms: editingSlave.pollingIntervalMs,
        timeout_ms: editingSlave.timeoutMs,
        priority: editingSlave.priority || 1,
        enabled: editingSlave.enabled,
        registers: [...editingSlave.registers],
      }
    : undefined;

  // ── Save handler (called by SlaveConfigModal) ───────────────────────────────

  const handleSaveSlave = async (formData: SlaveFormData) => {
    const slaveId = parseInt(formData.slave_id);

    if (!editingSlave) {
      const existingSlave = slaves.find((s) => s.slaveId === slaveId);
      if (existingSlave) {
        setModalError(`Slave ID ${slaveId} already exists. Please choose a different ID.`);
        return;
      }
    }

    try {
      const slaveData = {
        slave_id: slaveId,
        device_name: formData.device_name,
        polling_interval_ms: formData.polling_interval_ms,
        timeout_ms: formData.timeout_ms,
        enabled: formData.enabled,
        registers: formData.registers.map((r) => ({
          label: r.label,
          address: r.address,
          num_registers: r.numRegisters,
          function_code: r.functionCode,
          register_type: r.registerType,
          data_type: r.dataType,
          byte_order: r.byteOrder,
          word_order: r.wordOrder,
          access_mode: r.accessMode,
          scale_factor: r.scaleFactor,
          offset: r.offset,
          unit: r.unit,
          decimal_places: r.decimalPlaces,
          category: r.category,
          high_alarm_threshold: r.highAlarmThreshold,
          low_alarm_threshold: r.lowAlarmThreshold,
          description: r.description,
          enabled: r.enabled,
        })),
      };

      if (editingSlave) {
        const updated = globalMode
          ? await apiService.updateGlobalSlave(editingSlave.id, slaveData)
          : await apiService.updateSlave(config!.configId, editingSlave.slaveId, slaveData);
        setSlaves(slaves.map((s) => (s.id === editingSlave.id ? mapSlave(updated) : s)));
      } else {
        const created = await apiService.createGlobalSlave(slaveData);
        setSlaves([...slaves, mapSlave(created)]);
      }

      setCreatingSlave(false);
      setEditingSlave(null);
      setModalError(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save slave');
    }
  };

  const handleCancel = () => {
    setCreatingSlave(false);
    setEditingSlave(null);
    setModalError(null);
  };

  const handleDeleteSlave = (slave: SlaveDevice) => setDeleteModal({ show: true, slave });

  const confirmDeleteSlave = async () => {
    if (!deleteModal.slave) return;
    try {
      await apiService.deleteGlobalSlave(deleteModal.slave.id);
      setSlaves(slaves.filter((s) => s.id !== deleteModal.slave!.id));
      setDeleteModal({ show: false, slave: null });
      setSuccessModal({ show: true, message: `Slave device "${deleteModal.slave.deviceName}" deleted successfully.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slave');
      setDeleteModal({ show: false, slave: null });
    }
  };

  // ── Filtered slave list ────────────────────────────────────────────────────

  const sq = slaveSearch.toLowerCase();
  const filteredSlaves = sq
    ? slaves.filter(
        (s) =>
          s.deviceName.toLowerCase().includes(sq) ||
          String(s.slaveId).includes(sq) ||
          (s.configName || '').toLowerCase().includes(sq)
      )
    : slaves;

  if (loading) return <div className="loading">Loading configuration...</div>;

  return (
    <div className="admin-container responsive-page">
      <h1>Slave Configuration</h1>

      {!creatingSlave && !editingSlave && error && (
        <div className="error" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', color: '#721c24' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#721c24', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>
              All Slave Devices ({slaves.length}{sq ? ` · ${filteredSlaves.length} shown` : ''})
            </h2>
            <input
              type="text"
              placeholder="Search by name, ID or config…"
              value={slaveSearch}
              onChange={(e) => setSlaveSearch(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', minWidth: 220 }}
            />
          </div>
          <button onClick={() => setCreatingSlave(true)} className="btn">Configure New Slave</button>
        </div>

        {filteredSlaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            {slaves.length === 0
              ? <><p>No slave devices configured yet.</p><p>Click "Configure New Slave" to add your first slave device.</p></>
              : <p>No slaves match your search.</p>}
          </div>
        ) : (
          <div className="table-responsive">
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
                {filteredSlaves.map((slave) => (
                  <tr key={slave.id}>
                    <td style={{ textAlign: 'center' }}>{slave.slaveId}</td>
                    <td style={{ textAlign: 'center' }}>{slave.deviceName}</td>
                    <td style={{ textAlign: 'center' }}>{slave.configName || 'global'}</td>
                    <td style={{ textAlign: 'center' }}>{slave.pollingIntervalMs}ms</td>
                    <td style={{ textAlign: 'center' }}>{slave.timeoutMs}ms</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={slave.enabled ? 'status-online' : 'status-offline'}>
                        {slave.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {slave.registers.filter((r: any) => r.enabled).length} / {slave.registers.length}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => setEditingSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '0 6px', color: '#6366f1' }} title="Edit">
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                      <button onClick={() => handleDeleteSlave(slave)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', margin: '0 6px' }} title="Delete">
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shared SlaveConfigModal */}
      <SlaveConfigModal
        open={creatingSlave || !!editingSlave}
        editingSlave={editingSlave}
        existingSlaveIds={slaves.map((s) => s.slaveId)}
        initialForm={editInitialForm}
        onSave={handleSaveSlave}
        onCancel={handleCancel}
        error={modalError}
        onClearError={() => setModalError(null)}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.show && deleteModal.slave && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 16, boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxWidth: '480px', width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #dc3545, #c82333)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(220,53,69,0.4)' }}>
                  <AlertTriangle size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Delete Slave Device</span>
              </div>
              <button onClick={() => setDeleteModal({ show: false, slave: null })} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
                Are you sure you want to delete slave device <strong>{deleteModal.slave.deviceName}</strong> (ID: {deleteModal.slave.slaveId})?
              </p>
              <div style={{ background: isDark ? 'rgba(220,53,69,0.12)' : '#f8d7da', border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #f5c6cb', borderRadius: 8, padding: '12px 14px', fontSize: '0.875rem', color: isDark ? '#ff9999' : '#721c24' }}>
                <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Warning:</strong> This will permanently delete the slave device and all its register mappings.
              </div>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModal({ show: false, slave: null })} style={{ padding: '10px 18px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDeleteSlave} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #dc3545, #c82333)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,53,69,0.4)' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal */}
      {successModal.show && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: isDark ? '#1a1a1a' : '#ffffff', borderRadius: 16, boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxWidth: '480px', width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
                  <CheckCircle2 size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Success</span>
              </div>
              <button onClick={() => setSuccessModal({ show: false, message: '' })} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>{successModal.message}</p>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSuccessModal({ show: false, message: '' })} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
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

export default Configuration;
