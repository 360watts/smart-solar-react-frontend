import React, { useState, useEffect, useMemo } from 'react';
import MobileConfiguration from '../mobile/staff/MobileConfiguration';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { Cpu } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Input } from '../../shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Switch } from '../../shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table';
import { ConfirmDialog } from './siteHardware/ui';
import { apiService } from '../../services/api';
import type { SlaveFormData } from './SlaveConfigModal';
import SlaveEditDialog from './SlaveEditDialog';
import { DATA_TYPES, hex, toRegisterPayload, toSlavePayload } from './slaveForm';
import PageHeader from '../../shared/layout/PageHeader';
import { DEFAULT_PAGE_SIZE } from '../../app/constants';

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

type StatusFilter = 'all' | 'enabled' | 'disabled';

const Configuration: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [savingReg, setSavingReg] = useState(false);
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [creatingSlave, setCreatingSlave] = useState(false);
  const [editingSlave, setEditingSlave] = useState<SlaveDevice | null>(null);
  const [slaveSearch, setSlaveSearch] = useState('');
  const [debouncedSlaveSearch, setDebouncedSlaveSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Delete / success modals
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; slave: SlaveDevice | null }>({ show: false, slave: null });

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
      numRegisters: reg.numRegisters ?? reg.num_registers,
      functionCode: reg.functionCode ?? reg.function_code,
      dataType: reg.dataType ?? reg.data_type,
      scaleFactor: reg.scaleFactor ?? reg.scale_factor,
      offset: reg.offset,
      enabled: reg.enabled,
      registerType: reg.registerType ?? reg.register_type,
      byteOrder: reg.byteOrder ?? reg.byte_order,
      wordOrder: reg.wordOrder ?? reg.word_order,
      accessMode: reg.accessMode ?? reg.access_mode,
      unit: reg.unit,
      decimalPlaces: reg.decimalPlaces ?? reg.decimal_places,
      category: reg.category,
      highAlarmThreshold: reg.highAlarmThreshold ?? reg.high_alarm_threshold,
      lowAlarmThreshold: reg.lowAlarmThreshold ?? reg.low_alarm_threshold,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedSlaveSearch, currentPage, pageSize]);

  // ── Modal initialForm (for edit mode) ──────────────────────────────────────

  const editInitialForm: SlaveFormData | undefined = useMemo(() => editingSlave
    ? {
        slave_id: editingSlave.slaveId.toString(),
        device_name: editingSlave.deviceName,
        polling_interval_ms: editingSlave.pollingIntervalMs,
        timeout_ms: editingSlave.timeoutMs,
        priority: editingSlave.priority || 1,
        enabled: editingSlave.enabled,
        registers: [...editingSlave.registers],
      }
    : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [editingSlave?.slaveId, editingSlave?.deviceName, editingSlave?.pollingIntervalMs,
   editingSlave?.timeoutMs, editingSlave?.priority, editingSlave?.enabled,
   editingSlave?.registers]);

  // ── Save handler (called by SlaveConfigModal) ───────────────────────────────

  // Switch on the register table: send the slave with that one register flipped, show the server's answer.
  const toggleRegister = async (slave: SlaveDevice, index: number, enabled: boolean) => {
    setSavingReg(true);
    try {
      const registers = slave.registers.map((r, i) => (i === index ? { ...r, enabled } : r));
      const updated = await apiService.updateGlobalSlave(slave.id, {
        slave_id: slave.slaveId, device_name: slave.deviceName,
        polling_interval_ms: slave.pollingIntervalMs, timeout_ms: slave.timeoutMs,
        priority: slave.priority ?? 1, enabled: slave.enabled, registers: registers.map(toRegisterPayload),
      });
      setSlaves((prev) => prev.map((s) => (s.id === slave.id ? mapSlave(updated) : s)));
    } catch (err) {
      addToast({ type: 'error', title: 'Could not change the register', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingReg(false);
    }
  };

  const handleSaveSlave = async (formData: SlaveFormData) => {
    const slaveId = parseInt(formData.slave_id);

    if (!editingSlave) {
      // Scope duplicate check to the same config — slave IDs are only unique per RS-485 bus (per config)
      const existingSlave = slaves.find((s) => s.slaveId === slaveId && s.configId === null);
      if (existingSlave) {
        setModalError(`Slave ID ${slaveId} already exists in this configuration. Please choose a different ID.`);
        return;
      }
    }

    try {
      const slaveData = toSlavePayload(formData);

      if (editingSlave) {
        const updated = await apiService.updateGlobalSlave(editingSlave.id, slaveData);
        setSlaves(slaves.map((s) => (s.id === editingSlave.id ? mapSlave(updated) : s)));
      } else {
        const created = await apiService.createGlobalSlave(slaveData);
        setSlaves([...slaves, mapSlave(created)]);
      }

      setCreatingSlave(false);
      setEditingSlave(null);
      setModalError(null);
      if (!editingSlave) setCurrentPage(1);
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
      addToast({ type: 'success', title: 'Slave deleted', message: deleteModal.slave.deviceName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slave');
      setDeleteModal({ show: false, slave: null });
    }
  };

  if (isMobile) return <MobileConfiguration />;

  if (loading && slaves.length === 0) return <div className="loading">Loading configuration...</div>;

  const visible = slaves.filter((s) => statusFilter === 'all' || (statusFilter === 'enabled') === s.enabled);
  const selected = slaves.find((s) => s.id === selectedId) ?? visible[0] ?? null;
  const activeRegs = (s: SlaveDevice) => s.registers.filter((r: any) => r.enabled).length;

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<Cpu size={20} color="white" />}
        title="Slave configuration"
        subtitle="Modbus slaves and their registers"
      />

      {!creatingSlave && !editingSlave && error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error" style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <section className="overflow-hidden rounded-[20px] border border-border bg-card" aria-label="Slave devices">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border px-4 py-3.5">
          <div className="flex min-w-0 flex-[1_1_240px] flex-wrap items-center gap-x-3.5 gap-y-2.5">
            <h2 className="m-0 text-[1.05rem] font-semibold">Slave devices</h2>
            {totalCount > 0 && <span className="font-mono text-[0.85rem] text-muted-foreground">{totalCount} slaves</span>}
            <Input
              type="search"
              aria-label="Search slaves"
              placeholder="Search name or slave ID"
              value={slaveSearch}
              onChange={(e) => setSlaveSearch(e.target.value)}
              className="max-w-80 flex-[1_1_200px]"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-auto min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button type="button" onClick={() => { setCreatingSlave(true); setModalError(null); }} className="ui-btn ui-btn--main">Add slave</button>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Cpu size={40} strokeWidth={1.25} className="mx-auto mb-3 text-muted-foreground" />
            <p className="m-0 font-semibold">
              {totalCount === 0 && !debouncedSlaveSearch ? 'No slaves yet' : 'No slaves match'}
            </p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {totalCount === 0 && !debouncedSlaveSearch ? 'Use Add slave to create the first one.' : 'Change the search or the status filter.'}
            </p>
          </div>
        ) : (
          <Table containerClassName="rounded-none border-0">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Slave ID</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Polling</TableHead>
                <TableHead className="text-right">Timeout</TableHead>
                <TableHead className="text-right">Registers</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((slave) => (
                <TableRow
                  key={slave.id}
                  data-testid={`slave-row-${slave.id}`}
                  aria-selected={selected?.id === slave.id}
                  tabIndex={0}
                  onClick={() => setSelectedId(slave.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(slave.id); }}
                  className={`cursor-pointer ${selected?.id === slave.id ? 'bg-primary/10' : ''}`}
                >
                  <TableCell className="font-medium">{slave.deviceName}</TableCell>
                  <TableCell className="text-right font-mono">#{slave.slaveId}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{slave.configName || 'global'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${slave.enabled ? 'bg-primary/15 text-primary' : 'border border-border text-muted-foreground'}`}>
                      <span className="size-[7px] rounded-full bg-current" />
                      {slave.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{slave.pollingIntervalMs} ms</TableCell>
                  <TableCell className="text-right font-mono">{slave.timeoutMs} ms</TableCell>
                  <TableCell className={`text-right font-mono ${activeRegs(slave) === 0 ? 'text-amber-500' : ''}`}>
                    {activeRegs(slave)} / {slave.registers.length}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={(e) => { e.stopPropagation(); setEditingSlave(slave); }}>Edit</button>
                      <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={(e) => { e.stopPropagation(); handleDeleteSlave(slave); }}>Delete</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="font-mono text-[0.85rem] text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger aria-label="Rows per page" className="w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>)}
                </SelectContent>
              </Select>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={currentPage === 1} onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}>Previous</button>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}>Next</button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="mt-5 overflow-hidden rounded-[20px] border border-border bg-card" aria-label="Registers">
          <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 border-b border-border px-4 py-3.5">
            <div className="min-w-0">
              <h2 className="m-0 text-[1.05rem] font-semibold">{selected.deviceName} registers</h2>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>Slave <b className="font-mono font-medium text-foreground">#{selected.slaveId}</b></span>
                <span>Polling <b className="font-mono font-medium text-foreground">{selected.pollingIntervalMs} ms</b></span>
                <span>Timeout <b className="font-mono font-medium text-foreground">{selected.timeoutMs} ms</b></span>
                <span>Active <b className="font-mono font-medium text-foreground">{activeRegs(selected)} of {selected.registers.length}</b></span>
              </div>
            </div>
            <button type="button" className="ui-btn ui-btn--support" onClick={() => setEditingSlave(selected)}>Edit registers</button>
          </div>
          {selected.registers.length === 0 ? (
            <p className="m-0 px-5 py-8 text-center text-sm text-muted-foreground">No registers on this slave yet.</p>
          ) : (
            <Table containerClassName="max-h-[420px] overflow-y-auto rounded-none border-0">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-card">Label</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">Address</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card text-right">Function</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">Type</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card text-right">Scale</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">Unit</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.registers.map((r: any, i: number) => (
                  <TableRow key={r.id ?? i}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="font-mono">{hex(r.address)}</TableCell>
                    <TableCell className="text-right font-mono">{r.functionCode}</TableCell>
                    <TableCell className="font-mono">{DATA_TYPES[r.dataType] ?? r.dataType}</TableCell>
                    <TableCell className="text-right font-mono">{r.scaleFactor}</TableCell>
                    <TableCell>{r.unit || ''}</TableCell>
                    <TableCell>
                      <Switch
                        checked={!!r.enabled}
                        disabled={savingReg}
                        aria-label={`${r.label} enabled`}
                        onCheckedChange={(v) => toggleRegister(selected, i, v)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {/* Shared SlaveConfigModal */}
      <SlaveEditDialog
        open={creatingSlave || !!editingSlave}
        editingSlave={editingSlave}
        existingSlaveIds={slaves.filter((s) => s.configId === null).map((s) => s.slaveId)}
        initialForm={editInitialForm}
        onSave={handleSaveSlave}
        onCancel={handleCancel}
        error={modalError}
        onClearError={() => setModalError(null)}
      />

      <ConfirmDialog
        isDark={isDark}
        open={deleteModal.show && !!deleteModal.slave}
        title="Delete this slave?"
        body={deleteModal.slave && `${deleteModal.slave.deviceName} (slave #${deleteModal.slave.slaveId}) and its ${deleteModal.slave.registers.length} registers will be removed. This cannot be undone.`}
        confirmLabel="Delete slave"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteSlave}
        onCancel={() => setDeleteModal({ show: false, slave: null })}
      />
    </div>
  );
};

export default Configuration;
