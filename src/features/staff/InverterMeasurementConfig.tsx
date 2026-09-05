import { useCallback, useEffect, useState } from 'react';
import {
  MonitorCog, Gauge, Zap, PlugZap, RefreshCw, Link2, Unlink, ArrowRightLeft, Plus,
  Pencil, Trash2, Check,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  SetupShell, SetupCard, StatusChip, Item, Flow, Field, controlStyle, Btn, EmptyState,
  InlineConfirm, useTokens, applianceIcon, applianceName,
} from './siteHardware/ui';
import SmartDeviceComposer from './siteHardware/SmartDeviceComposer';

// Same 5-min window as EnergyFlow's isDeviceOffline (index.tsx) — kept as a
// standalone copy rather than a shared import since the two components live
// in different feature trees; keep them in sync if this window ever changes.
const isReadingFresh = (timestamp?: string | null) =>
  !!timestamp && Date.now() - new Date(timestamp).getTime() <= 5 * 60 * 1000;

interface SmartDeviceForm {
  device_type: string;
  provider_device_id: string;
  appliance_label: string;
  circuit: string;
  display_name: string;
  is_active: boolean;
  ingest_mode: string;
}
const blankSmartDeviceForm = (): SmartDeviceForm => ({
  device_type: 'tuya_plug',
  provider_device_id: '',
  appliance_label: 'fridge',
  circuit: 'inverter_backup',
  display_name: '',
  is_active: true,
  ingest_mode: 'poll',
});

interface CircuitLineForm {
  circuit: string;
  label: string;
  device: number | null;
}
const blankCircuitLineForm = (): CircuitLineForm => ({
  circuit: 'ev_line',
  label: '',
  device: null,
});

export interface InverterMeasurementConfigProps {
  siteId: string;
  ownerUserId?: string;
  onGatewayAttached?: (devicePk: number) => void;
}

export default function InverterMeasurementConfig({
  siteId,
  ownerUserId,
  onGatewayAttached,
}: InverterMeasurementConfigProps) {
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gatewayDevicePk, setGatewayDevicePk] = useState('');
  const [energyMeterPk, setEnergyMeterPk] = useState('');
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const [smartDevices, setSmartDevices] = useState<any[]>([]);
  const [smartDevicesLoading, setSmartDevicesLoading] = useState(false);
  const [smartDevicesSaving, setSmartDevicesSaving] = useState(false);
  const [editingSmartDeviceId, setEditingSmartDeviceId] = useState<number | null>(null);
  const [smartDeviceDraft, setSmartDeviceDraft] = useState<SmartDeviceForm>(blankSmartDeviceForm());
  const [tuyaCloudDevices, setTuyaCloudDevices] = useState<Array<{ id: string; name: string; product_name?: string; category?: string; online?: boolean; already_registered: boolean }>>([]);
  const [tuyaCloudLoading, setTuyaCloudLoading] = useState(false);
  const [tuyaCloudError, setTuyaCloudError] = useState<string | null>(null);
  const [lastProvisioning, setLastProvisioning] = useState<{ ok?: boolean; error?: string | null; meters?: boolean } | null>(null);
  const [smartComposerOpen, setSmartComposerOpen] = useState(false);
  const [gatewayComposerOpen, setGatewayComposerOpen] = useState(false);
  const [meterComposerOpen, setMeterComposerOpen] = useState(false);
  const [circuitComposerOpen, setCircuitComposerOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ kind: string; id: number; label: string } | null>(null);
  const [circuitLines, setCircuitLines] = useState<any[]>([]);
  const [circuitLinesLoading, setCircuitLinesLoading] = useState(false);
  const [circuitLinesSaving, setCircuitLinesSaving] = useState(false);
  const [editingCircuitLineId, setEditingCircuitLineId] = useState<number | null>(null);
  const [circuitLineDraft, setCircuitLineDraft] = useState<CircuitLineForm>(blankCircuitLineForm());
  // mirror-pairing fields (mirrored_by_serials / mirrors_device_id / mirrors_device_serial) are
  // NOT on getDevices() list items — they come from getSiteStaffDetail(siteId) (site-scoped).
  const [siteDetail, setSiteDetail] = useState<any>(null);

  const siteStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { background: t.goodBg, color: t.goodInk };
      case 'commissioning': return { background: 'rgba(59,130,246,0.14)', color: '#5a9bff' };
      case 'inactive': return { background: 'rgba(229,72,77,0.14)', color: '#e5484d' };
      default: return { background: t.idleBg, color: t.ink2 };
    }
  };

  // ── Data loading ──
  const refreshSmartDevices = useCallback(async () => {
    if (!siteId) return;
    setSmartDevicesLoading(true);
    try {
      const devices = await apiService.getSmartDevices(siteId);
      setSmartDevices(Array.isArray(devices) ? devices : []);
    } catch { setSmartDevices([]); }
    finally { setSmartDevicesLoading(false); }
  }, [siteId]);

  const refreshCircuitLines = useCallback(async () => {
    if (!siteId) return;
    setCircuitLinesLoading(true);
    try {
      const lines = await apiService.getCircuitLines(siteId);
      setCircuitLines(Array.isArray(lines) ? lines : []);
    } catch { setCircuitLines([]); }
    finally { setCircuitLinesLoading(false); }
  }, [siteId]);

  const refreshSiteDetail = useCallback(async () => {
    if (!siteId) return;
    try {
      const data = await apiService.getSiteStaffDetail(siteId);
      setSiteDetail(data);
    } catch { setSiteDetail(null); }
  }, [siteId]);

  const loadAvailableDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      if (ownerUserId) {
        const devices = await apiService.getUserDevices(parseInt(ownerUserId, 10));
        setAvailableDevices(Array.isArray(devices) ? devices : []);
      } else {
        const devices = await apiService.getDevices('', 1, 100);
        if (Array.isArray(devices)) setAvailableDevices(devices);
        else setAvailableDevices(devices.results ?? []);
      }
    } catch { setAvailableDevices([]); }
    finally { setDevicesLoading(false); }
  }, [ownerUserId]);

  useEffect(() => {
    if (!siteId) return;
    const loadSites = async () => {
      setSitesLoading(true);
      try {
        const sites = await apiService.getSitesList({ includeInactive: true });
        const list = Array.isArray(sites) ? sites : (sites as any).results ?? [];
        setAvailableSites(list.filter((s: any) => s.site_id !== siteId));
      } catch { setAvailableSites([]); }
      finally { setSitesLoading(false); }
    };
    loadAvailableDevices();
    loadSites();
    refreshSmartDevices();
    refreshCircuitLines();
    refreshSiteDetail();
  }, [siteId, loadAvailableDevices, refreshSmartDevices, refreshCircuitLines, refreshSiteDetail]);

  // ── Attach / detach / move / mirror ──
  const handleAttach = async (rawPk: string, label: string) => {
    const pk = parseInt(rawPk, 10);
    if (!pk || Number.isNaN(pk)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteAttachDevice(siteId, pk);
      if (label === 'gateway') { setGatewayDevicePk(''); setGatewayComposerOpen(false); onGatewayAttached?.(pk); }
      else { setEnergyMeterPk(''); setMeterComposerOpen(false); }
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't connect that device") ; }
    finally { setBusy(false); }
  };

  const handleDetach = async (deviceId: number) => {
    setBusy(true); setError(null);
    try {
      await apiService.siteDetachDevice(siteId, deviceId);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't disconnect that device"); }
    finally { setBusy(false); setConfirmDel(null); }
  };

  const handleMove = async (deviceId: number, targetSiteId?: string) => {
    const target = targetSiteId ?? moveTarget.trim();
    if (!target) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteMoveDevice(target, deviceId, siteId);
      setMoveTarget(''); setMoveSearch(''); setMoveDropdownOpen(false); setGatewayComposerOpen(false);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't move that device"); }
    finally { setBusy(false); }
  };

  const handleSetMirror = async (deviceId: number, mirrorsDevicePk: number | null) => {
    setBusy(true); setError(null);
    try {
      await apiService.siteSetDeviceMirror(siteId, deviceId, mirrorsDevicePk);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the backup path"); }
    finally { setBusy(false); }
  };

  // ── Smart-device CRUD ──
  const resetSmartDeviceForm = () => {
    setEditingSmartDeviceId(null);
    setSmartDeviceDraft(blankSmartDeviceForm());
    setSmartComposerOpen(false);
    setTuyaCloudDevices([]);
  };
  const beginAddSmartDevice = () => {
    setEditingSmartDeviceId(null);
    setSmartDeviceDraft(blankSmartDeviceForm());
    setTuyaCloudDevices([]);
    setLastProvisioning(null);
    setSmartComposerOpen(true);
  };
  const beginEditSmartDevice = (device: any) => {
    setLastProvisioning(null);
    setEditingSmartDeviceId(device.id);
    setSmartDeviceDraft({
      device_type: device.device_type ?? 'tuya_plug',
      provider_device_id: device.provider_device_id ?? '',
      appliance_label: device.appliance_label ?? 'other',
      circuit: device.circuit ?? 'grid_direct',
      display_name: device.display_name ?? '',
      is_active: device.is_active !== false,
      ingest_mode: device.ingest_mode ?? 'poll',
    });
    setSmartComposerOpen(true);
  };
  const saveSmartDevice = async () => {
    if (!siteId) return;
    const payload = {
      device_type: smartDeviceDraft.device_type,
      provider_device_id: smartDeviceDraft.provider_device_id.trim(),
      appliance_label: smartDeviceDraft.appliance_label,
      circuit: smartDeviceDraft.circuit,
      display_name: smartDeviceDraft.display_name.trim() || applianceName(smartDeviceDraft.appliance_label),
      is_active: smartDeviceDraft.is_active,
      ingest_mode: smartDeviceDraft.ingest_mode,
    };
    if (!payload.provider_device_id) { setError('Pick a plug first'); return; }
    setSmartDevicesSaving(true); setError(null); setLastProvisioning(null);
    try {
      if (editingSmartDeviceId != null) {
        await apiService.updateSmartDevice(editingSmartDeviceId, payload);
      } else {
        const created = await apiService.createSmartDevice(siteId, payload);
        if (created?.provisioning) setLastProvisioning(created.provisioning);
      }
      resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that plug"); }
    finally { setSmartDevicesSaving(false); }
  };
  const discoverTuyaDevices = useCallback(async () => {
    if (!siteId) return;
    setTuyaCloudLoading(true); setTuyaCloudError(null);
    try {
      setTuyaCloudDevices(await apiService.getTuyaCloudDevices(siteId));
    } catch (e) {
      setTuyaCloudError(e instanceof Error ? e.message : "Couldn't reach the plugs");
      setTuyaCloudDevices([]);
    } finally { setTuyaCloudLoading(false); }
  }, [siteId]);
  const removeSmartDevice = async (id: number) => {
    setSmartDevicesSaving(true); setError(null);
    try {
      await apiService.deleteSmartDevice(id);
      if (editingSmartDeviceId === id) resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove that plug"); }
    finally { setSmartDevicesSaving(false); setConfirmDel(null); }
  };

  // ── Circuit-line CRUD ──
  const resetCircuitLineForm = () => {
    setEditingCircuitLineId(null);
    setCircuitLineDraft(blankCircuitLineForm());
    setCircuitComposerOpen(false);
  };
  const beginAddCircuitLine = (preset?: { circuit: string; label: string }) => {
    setEditingCircuitLineId(null);
    setCircuitLineDraft({ ...blankCircuitLineForm(), ...(preset ?? {}) });
    setCircuitComposerOpen(true);
  };
  const beginEditCircuitLine = (line: any) => {
    setEditingCircuitLineId(line.id);
    setCircuitLineDraft({ circuit: line.circuit ?? 'ev_line', label: line.label ?? '', device: line.device ?? null });
    setCircuitComposerOpen(true);
  };
  const saveCircuitLine = async () => {
    if (!siteId) return;
    const payload = { circuit: circuitLineDraft.circuit, label: circuitLineDraft.label.trim(), device: circuitLineDraft.device };
    setCircuitLinesSaving(true); setError(null);
    try {
      if (editingCircuitLineId != null) await apiService.updateCircuitLine(siteId, editingCircuitLineId, payload);
      else await apiService.createCircuitLine(siteId, payload);
      resetCircuitLineForm();
      await refreshCircuitLines();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that circuit"); }
    finally { setCircuitLinesSaving(false); }
  };
  const removeCircuitLine = async (id: number) => {
    if (!siteId) return;
    setCircuitLinesSaving(true); setError(null);
    try {
      await apiService.deleteCircuitLine(siteId, id);
      if (editingCircuitLineId === id) resetCircuitLineForm();
      await refreshCircuitLines();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove that circuit"); }
    finally { setCircuitLinesSaving(false); setConfirmDel(null); }
  };

  // ── Derived ──
  const mirrorInfoReady = !!siteDetail;
  const hasGateway = !!siteDetail?.gateway_device;
  const hasEnergyMeter = Array.isArray(siteDetail?.energy_meters) && siteDetail.energy_meters.length > 0;
  const availableGatewayDevices = availableDevices.filter((d: any) => !d.site_id && (d.device_type || 'gateway') === 'gateway');
  const availableEnergyMeterDevices = availableDevices.filter((d: any) => !d.site_id && d.device_type === 'energy_meter');
  const gw = siteDetail?.gateway_device ?? null;
  const energyMeters = Array.isArray(siteDetail?.energy_meters) ? siteDetail.energy_meters : [];
  const heartbeatHealth = gw?.heartbeat_health;

  const ago = (s?: string) => {
    if (!s) return 'never';
    const mins = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    return new Date(s).toLocaleDateString();
  };

  const done = [hasGateway, hasEnergyMeter, hasGateway || hasEnergyMeter || circuitLines.length > 0, smartDevices.length > 0]
    .filter(Boolean).length;

  const siteName = siteDetail?.display_name || siteId;

  return (
    <SetupShell
      isDark={isDark}
      heading={`Let’s get ${siteName} monitored`}
      sub="Connect the hardware and add a smart plug for each appliance you want to track. We’ll show you what’s working and what still needs a hand."
      progress={{ done, total: 4 }}
    >
      {error && (
        <div style={{
          padding: '11px 13px', borderRadius: 12, fontSize: '0.87rem',
          background: 'rgba(229,72,77,0.1)', border: '1px solid rgba(229,72,77,0.28)', color: '#e5484d',
        }}>
          {error}
        </div>
      )}

      {/* ── INVERTER MONITOR ─────────────────────────────────────────── */}
      <SetupCard
        isDark={isDark}
        index={0}
        icon={<MonitorCog size={21} strokeWidth={1.8} />}
        title="Inverter monitor"
        purpose="The box on-site that reads your solar inverter."
        status={hasGateway
          ? <StatusChip isDark={isDark} state={heartbeatHealth?.severity === 'critical' ? 'wait' : 'good'}>
              {heartbeatHealth?.severity === 'critical' ? 'Needs attention' : 'Connected'}
            </StatusChip>
          : <StatusChip isDark={isDark} state="wait">Not set up yet</StatusChip>}
        action={!hasGateway && !gatewayComposerOpen && availableGatewayDevices.length > 0 && (
          <Btn isDark={isDark} variant="soft" onClick={() => setGatewayComposerOpen(true)}><Plus size={15} /> Connect the monitor</Btn>
        )}
      >
        {gw ? (
          <Item
            isDark={isDark}
            icon={<MonitorCog size={19} strokeWidth={1.8} />}
            title={`Monitor ${gw.device_serial}`}
            status={
              heartbeatHealth?.severity === 'critical'
                ? <span style={{ color: t.waitInk, fontWeight: 600 }}>Not reporting — last update {ago(gw.last_seen_at)}</span>
                : <><span style={{ color: t.goodInk, fontWeight: 600 }}>Reporting normally</span> · last update {ago(gw.last_seen_at)}</>
            }
            actions={[
              { label: 'Move to another site', icon: <ArrowRightLeft size={14} />, onClick: () => setGatewayComposerOpen(true) },
              { label: 'Disconnect', icon: <Unlink size={14} />, danger: true, onClick: () => setConfirmDel({ kind: 'gateway', id: gw.device_id, label: `Monitor ${gw.device_serial}` }) },
            ]}
          />
        ) : (
          !gatewayComposerOpen && (
            <EmptyState
              isDark={isDark}
              headline="No monitor connected"
              detail={availableGatewayDevices.length ? 'Connect the on-site box so we can read the inverter.' : 'No spare monitor is available to connect right now.'}
              action={availableGatewayDevices.length > 0 && (
                <Btn isDark={isDark} variant="soft" onClick={() => setGatewayComposerOpen(true)}><Plus size={15} /> Connect the monitor</Btn>
              )}
            />
          )
        )}

        {gw && Array.isArray(gw.mirrored_by_serials) && gw.mirrored_by_serials.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: t.goodInk }}>
            <Link2 size={13} /> Backed up by {gw.mirrored_by_serials.join(', ')} if this one goes offline
          </div>
        )}

        <Flow
          isDark={isDark}
          open={gatewayComposerOpen}
          title={gw ? 'Move the monitor' : 'Connect the monitor'}
          subtitle={gw ? `Send ${gw.device_serial} to a different site.` : 'Pick the on-site box for this address.'}
          onClose={() => { setGatewayComposerOpen(false); setMoveSearch(''); setMoveTarget(''); }}
          footer={
            <>
              <Btn isDark={isDark} variant="plain" onClick={() => { setGatewayComposerOpen(false); setMoveSearch(''); setMoveTarget(''); }}>Cancel</Btn>
              {gw ? (
                <Btn isDark={isDark} disabled={busy || !moveTarget.trim()} onClick={() => handleMove(gw.device_id)}><ArrowRightLeft size={14} /> Move</Btn>
              ) : (
                <Btn isDark={isDark} disabled={busy || !gatewayDevicePk} onClick={() => handleAttach(gatewayDevicePk, 'gateway')}><Link2 size={14} /> Connect</Btn>
              )}
            </>
          }
        >
          {gw ? (
            <Field isDark={isDark} label="Which site?">
              <div style={{ position: 'relative' }}>
                <input
                  value={moveSearch || (moveTarget && !moveDropdownOpen ? moveTarget : moveSearch)}
                  onChange={e => { setMoveSearch(e.target.value); setMoveTarget(''); setMoveDropdownOpen(true); }}
                  onFocus={() => setMoveDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 150)}
                  placeholder={sitesLoading ? 'Loading sites…' : 'Search by name or ID…'}
                  disabled={sitesLoading}
                  style={controlStyle(isDark)}
                />
                {moveDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                    border: `1px solid ${t.line}`, borderRadius: 11, background: t.card, maxHeight: 220,
                    overflowY: 'auto', boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
                  }}>
                    {availableSites
                      .filter(s => { const q = moveSearch.toLowerCase(); return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q); })
                      .map(s => (
                        <div
                          key={s.site_id}
                          onMouseDown={() => { setMoveTarget(s.site_id); setMoveSearch(''); setMoveDropdownOpen(false); }}
                          onMouseEnter={e => (e.currentTarget.style.background = t.card2)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.87rem', color: t.ink, borderBottom: `1px solid ${t.line2}` }}
                        >
                          <span style={{ fontWeight: 600 }}>{s.display_name || s.site_id}</span>
                          {s.display_name && <span style={{ color: t.ink2, marginLeft: 8, fontSize: '0.8rem' }}>{s.site_id}</span>}
                          {s.site_status && (
                            <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '1px 6px', borderRadius: 5, ...siteStatusStyle(s.site_status) }}>{s.site_status}</span>
                          )}
                        </div>
                      ))}
                    {availableSites.filter(s => { const q = moveSearch.toLowerCase(); return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q); }).length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: '0.85rem', color: t.ink2, textAlign: 'center' }}>No sites found</div>
                    )}
                  </div>
                )}
              </div>
            </Field>
          ) : (
            <Field isDark={isDark} label="Which monitor?">
              <select value={gatewayDevicePk} onChange={e => setGatewayDevicePk(e.target.value)} disabled={devicesLoading} style={controlStyle(isDark)}>
                <option value="">Choose a monitor…</option>
                {availableGatewayDevices.map(d => <option key={d.id} value={String(d.id)}>{d.device_serial}</option>)}
              </select>
            </Field>
          )}
        </Flow>
      </SetupCard>

      {/* ── WHOLE-HOME METER ─────────────────────────────────────────── */}
      <SetupCard
        isDark={isDark}
        index={1}
        icon={<Gauge size={21} strokeWidth={1.8} />}
        title="Whole-home meter"
        purpose="Measures total electricity used and sent back to the grid."
        status={hasEnergyMeter
          ? <StatusChip isDark={isDark} state="good">Connected</StatusChip>
          : <StatusChip isDark={isDark} state="wait">Not set up yet</StatusChip>}
        action={!meterComposerOpen && availableEnergyMeterDevices.length > 0 && (
          <Btn isDark={isDark} variant="soft" onClick={() => setMeterComposerOpen(true)}><Plus size={15} /> Add a meter</Btn>
        )}
      >
        {energyMeters.length > 0 ? (
          energyMeters.map((meter: any) => {
            const relayed = meter.mirrors_device_id && meter.mirrors_device_id === gw?.id;
            return (
              <Item
                key={meter.device_id}
                isDark={isDark}
                icon={<Gauge size={19} strokeWidth={1.8} />}
                title={`Meter ${meter.device_serial}`}
                status={relayed
                  ? <><span style={{ color: t.goodInk, fontWeight: 600 }}>Connected</span> · via the monitor</>
                  : <><span style={{ color: t.goodInk, fontWeight: 600 }}>Connected</span> · last update {ago(meter.last_seen_at)}</>}
                actions={[
                  ...(gw && mirrorInfoReady && !relayed ? [{ label: 'Route through the monitor', icon: <Link2 size={14} />, onClick: () => handleSetMirror(meter.device_id, gw.device_id) }] : []),
                  { label: 'Move to another site', icon: <ArrowRightLeft size={14} />, onClick: () => {
                    const target = window.prompt(`Move the meter to which site ID?`, '');
                    if (target) handleMove(meter.device_id, target);
                  } },
                  { label: 'Disconnect', icon: <Unlink size={14} />, danger: true, onClick: () => setConfirmDel({ kind: 'meter', id: meter.device_id, label: `Meter ${meter.device_serial}` }) },
                ]}
              />
            );
          })
        ) : (
          !meterComposerOpen && (
            <EmptyState
              isDark={isDark}
              headline="No meter connected"
              detail="Add a whole-home meter here to track total usage and what's sent to the grid."
            />
          )
        )}

        <Flow
          isDark={isDark}
          open={meterComposerOpen}
          title="Add a whole-home meter"
          onClose={() => setMeterComposerOpen(false)}
          footer={
            <>
              <Btn isDark={isDark} variant="plain" onClick={() => setMeterComposerOpen(false)}>Cancel</Btn>
              <Btn isDark={isDark} disabled={busy || !energyMeterPk} onClick={() => handleAttach(energyMeterPk, 'energy_meter')}><Link2 size={14} /> Connect</Btn>
            </>
          }
        >
          <Field isDark={isDark} label="Which meter?">
            <select value={energyMeterPk} onChange={e => setEnergyMeterPk(e.target.value)} disabled={devicesLoading} style={controlStyle(isDark)}>
              <option value="">Choose a meter…</option>
              {availableEnergyMeterDevices.map(d => <option key={d.id} value={String(d.id)}>{d.device_serial}</option>)}
            </select>
          </Field>
        </Flow>
      </SetupCard>

      {/* ── OTHER CIRCUITS ───────────────────────────────────────────── */}
      <SetupCard
        isDark={isDark}
        index={2}
        icon={<Zap size={21} strokeWidth={1.8} />}
        title="Circuits"
        purpose="What this site's power is split into. The inverter's backup output is always here; add the grid feed or an EV charger if you want them noted too."
        action={!circuitComposerOpen && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn isDark={isDark} variant="soft" size="sm" onClick={() => beginAddCircuitLine({ circuit: 'grid_direct', label: 'Grid' })}><Plus size={14} /> Add grid</Btn>
            <Btn isDark={isDark} variant="soft" size="sm" onClick={() => beginAddCircuitLine({ circuit: 'ev_line', label: 'EV charger' })}><Plus size={14} /> Add EV</Btn>
            <Btn isDark={isDark} variant="plain" size="sm" onClick={() => beginAddCircuitLine()}><Plus size={14} /> Something else</Btn>
          </div>
        )}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.card2, fontSize: '0.88rem',
        }}>
          <span>Inverter</span>
          {hasGateway
            ? <span style={{ color: t.goodInk, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={14} strokeWidth={2.6} /> Tracked</span>
            : <span style={{ color: t.waitInk, fontWeight: 600 }}>Not tracked yet</span>}
        </div>

        {circuitLinesLoading ? (
          <div style={{ fontSize: '0.85rem', color: t.ink2 }}>Loading…</div>
        ) : circuitLines.map((line: any) => (
          <Item
            key={line.id}
            isDark={isDark}
            icon={<PlugZap size={19} strokeWidth={1.8} />}
            title={line.label || 'Circuit'}
            status={line.is_monitored ? <span style={{ color: t.goodInk, fontWeight: 600 }}>Being measured</span> : 'Noted — not measured'}
            actions={[
              { label: 'Edit', icon: <Pencil size={14} />, onClick: () => beginEditCircuitLine(line) },
              { label: 'Remove', icon: <Trash2 size={14} />, danger: true, onClick: () => setConfirmDel({ kind: 'circuit', id: line.id, label: line.label || 'this circuit' }) },
            ]}
          />
        ))}

        <Flow
          isDark={isDark}
          open={circuitComposerOpen}
          title={editingCircuitLineId != null ? 'Edit this circuit' : 'Note another circuit'}
          subtitle="For anything wired on its own, like a garage EV charger."
          onClose={resetCircuitLineForm}
          footer={
            <>
              <Btn isDark={isDark} variant="plain" onClick={resetCircuitLineForm}>Cancel</Btn>
              <Btn isDark={isDark} disabled={circuitLinesSaving} onClick={saveCircuitLine}>
                {circuitLinesSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} strokeWidth={3} />}
                {editingCircuitLineId != null ? 'Save' : 'Add'}
              </Btn>
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Field isDark={isDark} label="What is it?">
              <input value={circuitLineDraft.label} onChange={e => setCircuitLineDraft({ ...circuitLineDraft, label: e.target.value })}
                placeholder="e.g. Garage EV charger" style={controlStyle(isDark)} />
            </Field>
            <Field isDark={isDark} label="Measured by a plug?" hint="pick one on this circuit, or leave as not measured">
              <select
                value={circuitLineDraft.device != null ? String(circuitLineDraft.device) : ''}
                onChange={e => setCircuitLineDraft({ ...circuitLineDraft, device: e.target.value ? parseInt(e.target.value, 10) : null })}
                style={controlStyle(isDark)}
              >
                <option value="">Not measured</option>
                {smartDevices.filter((d: any) => d.circuit === circuitLineDraft.circuit).map((d: any) => (
                  <option key={d.id} value={String(d.id)}>{d.display_name || applianceName(d.appliance_label)}</option>
                ))}
              </select>
            </Field>
          </div>
        </Flow>
      </SetupCard>

      {/* ── SMART PLUGS ──────────────────────────────────────────────── */}
      <SetupCard
        isDark={isDark}
        index={3}
        icon={<PlugZap size={21} strokeWidth={1.8} />}
        title="Smart plugs"
        purpose="Add one for each appliance you want to see on its own."
        status={<StatusChip isDark={isDark} state={smartDevices.length ? 'good' : 'idle'}>
          {smartDevices.length
            ? `${smartDevices.filter((d: any) => isReadingFresh(d.latest?.timestamp)).length} of ${smartDevices.length} online`
            : '0 appliances'}
        </StatusChip>}
        action={!smartComposerOpen && (
          <Btn isDark={isDark} variant="soft" full onClick={beginAddSmartDevice}><Plus size={15} /> Add a smart plug</Btn>
        )}
      >
        {lastProvisioning && !smartComposerOpen && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.85rem', color: t.ink,
            padding: '11px 13px', borderRadius: 12,
            border: `1px solid ${lastProvisioning.ok ? t.good : t.wait}`,
            background: lastProvisioning.ok ? t.goodBg : t.waitBg,
          }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 999, flexShrink: 0, background: lastProvisioning.ok ? t.good : t.wait, color: '#fff' }}>
              {lastProvisioning.ok ? <Check size={11} strokeWidth={3} /> : <RefreshCw size={11} />}
            </span>
            <span>
              {lastProvisioning.ok
                ? <>Plug added{lastProvisioning.meters === false ? ' — this one only shows on/off, not power' : ''}. It’ll start reporting shortly.</>
                : <>Plug added, but we couldn’t set it up automatically. Check it’s online, then try again from the plug’s menu.</>}
            </span>
          </div>
        )}

        {smartDevicesLoading ? (
          <div style={{ fontSize: '0.85rem', color: t.ink2 }}>Loading…</div>
        ) : smartDevices.length === 0 ? (
          !smartComposerOpen && (
            <EmptyState
              isDark={isDark}
              headline="No smart plugs yet"
              detail="Add one to start tracking an appliance on its own."
              action={<Btn isDark={isDark} variant="soft" onClick={beginAddSmartDevice}><Plus size={15} /> Add the first plug</Btn>}
            />
          )
        ) : (
          smartDevices.map((device: any) => {
            // Ground truth for "is this appliance actually delivering data" —
            // mirrors EnergyFlow's isDeviceOffline and the backend's own
            // check_local_poller_health() gate (a stale/missing
            // SmartDeviceReading, not is_online or poller_consecutive_failures
            // directly). Both of those proved unreliable in isolation:
            // is_online is Tuya's cloud-side WiFi check and can lag a real LAN
            // outage, and poller_consecutive_failures resets on any single
            // successful poll — coim_002's AC(NEW) sat at is_online=true,
            // 0-1 failures for hours while its last real reading was 21+
            // hours stale (Sep 5 2026). poller_last_seen_at can't catch it
            // either — the Pi refreshes it on every push for every device it
            // status-reports on, failing ones included.
            const online = isReadingFresh(device.latest?.timestamp);
            const power = device.latest?.power_w;
            let status: React.ReactNode;
            if (!online) status = <>Offline · appliance switched off or unplugged</>;
            else if (power != null && power > 5) status = <><span style={{ color: t.goodInk, fontWeight: 600 }}>Live</span> · using {power >= 1000 ? `${(power / 1000).toFixed(1)} kW` : `${Math.round(power)} W`} right now</>;
            else status = <>Idle · connected</>;
            return (
              <Item
                key={device.id}
                isDark={isDark}
                iconTone="good"
                icon={applianceIcon(device.appliance_label)}
                title={device.display_name || applianceName(device.appliance_label)}
                status={status}
                actions={[
                  { label: 'Edit', icon: <Pencil size={14} />, onClick: () => beginEditSmartDevice(device) },
                  { label: 'Remove', icon: <Trash2 size={14} />, danger: true, onClick: () => setConfirmDel({ kind: 'smart', id: device.id, label: device.display_name || applianceName(device.appliance_label) }) },
                ]}
              />
            );
          })
        )}

        <SmartDeviceComposer
          isDark={isDark}
          open={smartComposerOpen}
          editing={editingSmartDeviceId != null}
          saving={smartDevicesSaving}
          draft={smartDeviceDraft}
          setDraft={setSmartDeviceDraft}
          onClose={resetSmartDeviceForm}
          onSave={saveSmartDevice}
          scanDevices={tuyaCloudDevices}
          scanLoading={tuyaCloudLoading}
          scanError={tuyaCloudError}
          onScan={discoverTuyaDevices}
        />
      </SetupCard>

      {/* ── remove confirmation ──────────────────────────────────────── */}
      {confirmDel && (
        <div style={{ position: 'sticky', bottom: 12, zIndex: 30 }}>
          <InlineConfirm
            isDark={isDark}
            message={`Remove ${confirmDel.label}?`}
            onCancel={() => setConfirmDel(null)}
            onConfirm={() => {
              if (confirmDel.kind === 'smart') removeSmartDevice(confirmDel.id);
              else if (confirmDel.kind === 'circuit') removeCircuitLine(confirmDel.id);
              else handleDetach(confirmDel.id);
            }}
          />
        </div>
      )}
    </SetupShell>
  );
}
