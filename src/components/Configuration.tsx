import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, Trash2, AlertTriangle, X, CheckCircle2, Cpu } from 'lucide-react';
import { apiService } from '../services/api';
import SlaveConfigModal, { SlaveFormData } from './SlaveConfigModal';
import PageHeader from './PageHeader';
import { DEFAULT_PAGE_SIZE } from '../constants';

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
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [globalMode] = useState(true);
  const [slaveSearch, setSlaveSearch] = useState('');
  const [debouncedSlaveSearch, setDebouncedSlaveSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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
    const timer = setTimeout(() => {
      setDebouncedSlaveSearch(slaveSearch);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [slaveSearch]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await apiService.getGlobalSlaves(debouncedSlaveSearch || undefined, currentPage, pageSize);
        const list = result.results ?? result;
        setSlaves((Array.isArray(list) ? list : []).map(mapSlave));
        setTotalCount(result.count ?? (Array.isArray(list) ? list.length : 0));
        setTotalPages(result.total_pages ?? 1);
        setConfig(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedSlaveSearch, currentPage, pageSize]);

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

  if (loading) return <div className="loading">Loading configuration...</div>;

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<Cpu size={20} color="white" />}
        title="Slave Configuration"
        subtitle="Configure Modbus slave devices and their register mappings"
      />

      {!creatingSlave && !editingSlave && error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>
              Slave Devices {totalCount > 0 ? `(${totalCount})` : ''}
            </h2>
            <input
              type="text"
              placeholder="Search by name, ID…"
              value={slaveSearch}
              onChange={(e) => setSlaveSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => setCreatingSlave(true)} className="btn">Configure New Slave</button>
        </div>

        {slaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Cpu size={40} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            {totalCount === 0 && !debouncedSlaveSearch
              ? <><p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>No slave devices configured</p><p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Click "Configure New Slave" to add your first device.</p></>
              : <p style={{ color: 'var(--text-muted)', margin: 0 }}>No slaves match your search.</p>}
          </div>
        ) : (
          <div className="slave-grid">
            {slaves.map((slave) => {
              const enabledRegs = slave.registers.filter((r: any) => r.enabled).length;
              return (
                <div key={slave.id} className="slave-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div className="slave-card-name">{slave.deviceName}</div>
                      <div className="slave-card-id">Slave ID #{slave.slaveId} · {slave.configName || 'global'}</div>
                    </div>
                    <span className={slave.enabled ? 'status-online' : 'status-offline'} style={{ flexShrink: 0, marginTop: 2 }}>
                      {slave.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="slave-card-stats">
                    <div className="slave-stat">
                      <div className="slave-stat-label">Polling</div>
                      <div className="slave-stat-value">{slave.pollingIntervalMs}ms</div>
                    </div>
                    <div className="slave-stat">
                      <div className="slave-stat-label">Timeout</div>
                      <div className="slave-stat-value">{slave.timeoutMs}ms</div>
                    </div>
                    <div className="slave-stat" style={{ gridColumn: '1 / -1' }}>
                      <div className="slave-stat-label">Registers</div>
                      <div className="slave-stat-value">{enabledRegs} active / {slave.registers.length} total</div>
                    </div>
                  </div>
                  <div className="slave-card-actions">
                    <button onClick={() => setEditingSlave(slave)} className="slave-card-btn slave-card-btn-edit">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => handleDeleteSlave(slave)} className="slave-card-btn slave-card-btn-delete">
                      <Trash2 size={13} /> Delete
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
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} slaves
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
        <div className="portal-modal-backdrop">
          <div className="portal-modal-container">
            <div className="portal-modal-header">
              <div className="portal-modal-header-left">
                <div className="portal-modal-icon portal-modal-icon-danger">
                  <AlertTriangle size={22} color="white" />
                </div>
                <span className="portal-modal-title">Delete Slave Device</span>
              </div>
              <button onClick={() => setDeleteModal({ show: false, slave: null })} className="portal-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <div className="portal-modal-body">
              <p>
                Are you sure you want to delete slave device <strong>{deleteModal.slave.deviceName}</strong> (ID: {deleteModal.slave.slaveId})?
              </p>
              <div className="portal-modal-warning-box">
                <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Warning:</strong> This will permanently delete the slave device and all its register mappings.
              </div>
            </div>
            <div className="portal-modal-footer">
              <button onClick={() => setDeleteModal({ show: false, slave: null })} className="portal-modal-btn portal-modal-btn-cancel">
                Cancel
              </button>
              <button onClick={confirmDeleteSlave} className="portal-modal-btn portal-modal-btn-danger">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal */}
      {successModal.show && ReactDOM.createPortal(
        <div className="portal-modal-backdrop">
          <div className="portal-modal-container">
            <div className="portal-modal-header">
              <div className="portal-modal-header-left">
                <div className="portal-modal-icon portal-modal-icon-success">
                  <CheckCircle2 size={22} color="white" />
                </div>
                <span className="portal-modal-title">Success</span>
              </div>
              <button onClick={() => setSuccessModal({ show: false, message: '' })} className="portal-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <div className="portal-modal-body">
              <p>{successModal.message}</p>
            </div>
            <div className="portal-modal-footer">
              <button onClick={() => setSuccessModal({ show: false, message: '' })} className="portal-modal-btn portal-modal-btn-primary">
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
