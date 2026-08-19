import { useCallback, useEffect, useState } from 'react';
import { Wifi, Zap, Plus, Trash2, Pencil, RefreshCw, LinkIcon, Unlink, ArrowRightLeft } from 'lucide-react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

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
  appliance_label: 'ev_charger',
  circuit: 'grid_direct',
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── State (moved from SiteDetail.tsx:453-471) ──
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
  const [circuitLines, setCircuitLines] = useState<any[]>([]);
  const [circuitLinesLoading, setCircuitLinesLoading] = useState(false);
  const [circuitLinesSaving, setCircuitLinesSaving] = useState(false);
  const [editingCircuitLineId, setEditingCircuitLineId] = useState<number | null>(null);
  const [circuitLineDraft, setCircuitLineDraft] = useState<CircuitLineForm>(blankCircuitLineForm());
  // Fix round 1: mirror-pairing fields (mirrored_by_serials / mirrors_device_id /
  // mirrors_device_serial) are NOT present on getDevices() list items — confirmed against
  // src/services/api.ts. SiteDetail.tsx originally sourced these from getSiteStaffDetail(siteId)
  // (site.gateway_device / site.energy_meters), so this component fetches that enriched,
  // siteId-scoped object too, purely to read those three fields.
  const [siteDetail, setSiteDetail] = useState<any>(null);

  // ── Style tokens (moved from SiteDetail.tsx:511-528) ──
  const surface     = 'var(--card)';
  const border      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';
  const textMain    = 'var(--foreground)';
  const textMute    = 'var(--muted-foreground)';
  const textSub     = 'var(--muted-foreground)';
  const primary     = '#00a63e';
  const nativeSelectBg = 'var(--foreground)';
  const nativeSelectFg = 'var(--foreground)';
  const palette = {
    ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
    warn: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
    err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
    info: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.2)'  },
    mute: { bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: textSub, border: inputBorder },
  };
  // Used by the move-target site search dropdown to badge a candidate site's status.
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return palette.ok;
      case 'commissioning': return palette.info;
      case 'inactive': return palette.err;
      case 'draft': case 'archived': default: return palette.mute;
    }
  };
  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${inputBorder}`, background: inputBg, color: textMain,
    fontSize: '0.85rem', outline: 'none', transition: 'border-color 150ms', minWidth: 180,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: textMute, display: 'block', marginBottom: 6,
  };
  const buttonStyle = (isSecondary = false, isDanger = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    background: isDanger ? 'rgba(239,68,68,0.1)' : isSecondary ? palette.mute.bg : primary,
    color: isDanger ? '#ef4444' : isSecondary ? textMain : '#fff',
    borderStyle: 'solid', borderWidth: 1,
    borderColor: isDanger ? 'rgba(239,68,68,0.2)' : isSecondary ? palette.mute.border : primary,
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms', opacity: busy ? 0.7 : 1,
    boxShadow: isSecondary || isDanger ? 'none' : '0 4px 12px rgba(0,166,62,0.2)',
  });

  // ── Data loading (moved from SiteDetail.tsx:539-563, 698-728) ──
  const refreshSmartDevices = useCallback(async () => {
    if (!siteId) return;
    setSmartDevicesLoading(true);
    try {
      const devices = await apiService.getSmartDevices(siteId);
      setSmartDevices(Array.isArray(devices) ? devices : []);
    } catch {
      setSmartDevices([]);
    } finally {
      setSmartDevicesLoading(false);
    }
  }, [siteId]);

  const refreshCircuitLines = useCallback(async () => {
    if (!siteId) return;
    setCircuitLinesLoading(true);
    try {
      const lines = await apiService.getCircuitLines(siteId);
      setCircuitLines(Array.isArray(lines) ? lines : []);
    } catch {
      setCircuitLines([]);
    } finally {
      setCircuitLinesLoading(false);
    }
  }, [siteId]);

  const refreshSiteDetail = useCallback(async () => {
    if (!siteId) return;
    try {
      const data = await apiService.getSiteStaffDetail(siteId);
      setSiteDetail(data);
    } catch {
      setSiteDetail(null);
    }
  }, [siteId]);

  // Unattached-device pool for the attach dropdowns. When an owner is known (ownerUserId,
  // passed by both call sites from the site's owner_user), scope to that owner's devices —
  // restores the original pre-refactor CommissioningWizard step 2 behavior of only offering
  // devices belonging to the site's owner, rather than the first 100 devices fleet-wide.
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
    } catch {
      setAvailableDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    if (!siteId) return;
    const loadSites = async () => {
      setSitesLoading(true);
      try {
        const sites = await apiService.getSitesList({ includeInactive: true });
        const list = Array.isArray(sites) ? sites : (sites as any).results ?? [];
        setAvailableSites(list.filter((s: any) => s.site_id !== siteId));
      } catch {
        setAvailableSites([]);
      } finally {
        setSitesLoading(false);
      }
    };
    loadAvailableDevices();
    loadSites();
    refreshSmartDevices();
    refreshCircuitLines();
    refreshSiteDetail();
  }, [siteId, loadAvailableDevices, refreshSmartDevices, refreshCircuitLines, refreshSiteDetail]);

  // ── Attach/detach/move (moved from SiteDetail.tsx:753-829, unchanged bodies except
  //    handleAttach fires onGatewayAttached for the gateway case) ──
  const handleAttach = async (rawPk: string, label: string) => {
    const pk = parseInt(rawPk, 10);
    if (!pk || Number.isNaN(pk)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteAttachDevice(siteId, pk);
      if (label === 'gateway') {
        setGatewayDevicePk('');
        onGatewayAttached?.(pk);
      } else setEnergyMeterPk('');
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : 'Attach failed'); }
    finally { setBusy(false); }
  };

  const handleDetach = async (deviceId: number, deviceSerial: string, roleLabel: string) => {
    if (!window.confirm(`Detach ${roleLabel} ${deviceSerial} from this site?`)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteDetachDevice(siteId, deviceId);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : 'Detach failed'); }
    finally { setBusy(false); }
  };

  const handleMove = async (deviceId: number, deviceLabel: string, targetSiteId?: string) => {
    const target = targetSiteId ?? moveTarget.trim();
    if (!target) return;
    if (!window.confirm(`Move ${deviceLabel} to site ${target}?`)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteMoveDevice(target, deviceId, siteId);
      setMoveTarget(''); setMoveSearch(''); setMoveDropdownOpen(false);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : 'Move failed'); }
    finally { setBusy(false); }
  };

  // Manual data-source pairing override (mirrors SiteDetail.tsx's handleSetMirror, adapted to
  // refresh from availableDevices/siteDetail instead of a single `site` state this component
  // doesn't otherwise hold).
  const handleSetMirror = async (deviceId: number, mirrorsDevicePk: number | null) => {
    setBusy(true); setError(null);
    try {
      await apiService.siteSetDeviceMirror(siteId, deviceId, mirrorsDevicePk);
      await loadAvailableDevices();
      refreshSiteDetail();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update data-source pairing'); }
    finally { setBusy(false); }
  };

  // ── Smart-device CRUD (moved from SiteDetail.tsx:930-966ish, unchanged) ──
  const resetSmartDeviceForm = () => {
    setEditingSmartDeviceId(null);
    setSmartDeviceDraft(blankSmartDeviceForm());
  };
  const beginEditSmartDevice = (device: any) => {
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
  };
  const saveSmartDevice = async () => {
    if (!siteId) return;
    const payload = {
      device_type: smartDeviceDraft.device_type,
      provider_device_id: smartDeviceDraft.provider_device_id.trim(),
      appliance_label: smartDeviceDraft.appliance_label,
      circuit: smartDeviceDraft.circuit,
      display_name: smartDeviceDraft.display_name.trim(),
      is_active: smartDeviceDraft.is_active,
      ingest_mode: smartDeviceDraft.ingest_mode,
    };
    if (!payload.provider_device_id) {
      setError('Provider device ID is required for smart devices');
      return;
    }
    setSmartDevicesSaving(true); setError(null);
    try {
      if (editingSmartDeviceId != null) await apiService.updateSmartDevice(editingSmartDeviceId, payload);
      else await apiService.createSmartDevice(siteId, payload);
      resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save smart device');
    } finally {
      setSmartDevicesSaving(false);
    }
  };
  const removeSmartDevice = async (device: any) => {
    if (!window.confirm(`Delete smart device ${device.display_name || device.provider_device_id || device.id}?`)) return;
    setSmartDevicesSaving(true); setError(null);
    try {
      await apiService.deleteSmartDevice(device.id);
      if (editingSmartDeviceId === device.id) resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete smart device');
    } finally {
      setSmartDevicesSaving(false);
    }
  };

  // ── Circuit-line CRUD (moved from SiteDetail.tsx:979-1033ish, unchanged) ──
  const resetCircuitLineForm = () => {
    setEditingCircuitLineId(null);
    setCircuitLineDraft(blankCircuitLineForm());
  };
  const beginEditCircuitLine = (line: any) => {
    setEditingCircuitLineId(line.id);
    setCircuitLineDraft({
      circuit: line.circuit ?? 'ev_line',
      label: line.label ?? '',
      device: line.device ?? null,
    });
  };
  const saveCircuitLine = async () => {
    if (!siteId) return;
    const payload = {
      circuit: circuitLineDraft.circuit,
      label: circuitLineDraft.label.trim(),
      device: circuitLineDraft.device,
    };
    setCircuitLinesSaving(true); setError(null);
    try {
      if (editingCircuitLineId != null) await apiService.updateCircuitLine(siteId, editingCircuitLineId, payload);
      else await apiService.createCircuitLine(siteId, payload);
      resetCircuitLineForm();
      await refreshCircuitLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save circuit line');
    } finally {
      setCircuitLinesSaving(false);
    }
  };
  const removeCircuitLine = async (line: any) => {
    if (!siteId) return;
    if (!window.confirm(`Delete circuit line ${line.label || line.circuit}?`)) return;
    setCircuitLinesSaving(true); setError(null);
    try {
      await apiService.deleteCircuitLine(siteId, line.id);
      if (editingCircuitLineId === line.id) resetCircuitLineForm();
      await refreshCircuitLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete circuit line');
    } finally {
      setCircuitLinesSaving(false);
    }
  };

  // ── Derived ──
  // "What's attached to THIS site" must come from siteDetail (getSiteStaffDetail(siteId) —
  // site-scoped, always correct), not from availableDevices (getDevices() — a global,
  // paginated, 100-item-capped list ordered by -provisioned_at that silently drops sites once
  // the fleet grows or a site's gateway falls off page 1). availableDevices remains the correct
  // source only for the "what's attachable" dropdowns below. siteDetail.gateway_device /
  // siteDetail.energy_meters items use `device_id` as their PK field (not `id`, unlike
  // availableDevices items) — confirmed against the pre-refactor SiteDetail.tsx that originally
  // read `site.gateway_device` / `site.energy_meters` directly.
  const mirrorInfoReady = !!siteDetail;
  const hasGateway = !!siteDetail?.gateway_device;
  const hasEnergyMeter = Array.isArray(siteDetail?.energy_meters) && siteDetail.energy_meters.length > 0;
  const availableGatewayDevices = availableDevices.filter((d: any) => !d.site_id && (d.device_type || 'gateway') === 'gateway');
  const availableEnergyMeterDevices = availableDevices.filter((d: any) => !d.site_id && d.device_type === 'energy_meter');
  const gw = siteDetail?.gateway_device ?? null;
  const energyMeters = Array.isArray(siteDetail?.energy_meters) ? siteDetail.energy_meters : [];
  const heartbeatHealth = gw?.heartbeat_health;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Gateway section — attach/detach/move/mirror, ported verbatim from SiteDetail.tsx:1410-1516.
          `gw`/`energyMeters` come straight from siteDetail (getSiteStaffDetail(siteId)), so PKs
          use `device_id`, matching the original SiteDetail.tsx source. */}
      {gw ? (
        <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${palette.ok.border}`, background: palette.ok.bg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: palette.ok.color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>Attached Gateway</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: textMain }}>{gw.device_serial}</div>
              <div style={{ fontSize: '0.8rem', color: textSub, fontFamily: 'monospace' }}>PK: {gw.device_id} · Type: gateway</div>
            </div>
            <button type="button" disabled={busy} onClick={() => handleDetach(gw.device_id, gw.device_serial, 'gateway')} style={buttonStyle(false, true)}>
              <Unlink size={14} /> Detach
            </button>
          </div>

          <div style={{ height: 1, background: palette.ok.border, margin: '16px 0' }} />
          <div style={{ fontSize: '0.84rem', color: textSub, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <span><strong>Last seen:</strong> {gw.last_seen_at ? new Date(gw.last_seen_at).toLocaleString() : 'Never'}</span>
            <span><strong>Signal:</strong> {gw.signal_strength_dbm != null ? `${gw.signal_strength_dbm}%` : 'N/A'}</span>
            <span style={{ textTransform: 'capitalize' }}><strong>Health:</strong> {heartbeatHealth?.severity || 'ok'}</span>
          </div>
          {Array.isArray(gw.mirrored_by_serials) && gw.mirrored_by_serials.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: palette.ok.color, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <LinkIcon size={12} />
              Backed up by {gw.mirrored_by_serials.join(', ')} — it will publish directly if this gateway goes offline
            </div>
          )}

          <div style={{ height: 1, background: palette.ok.border, margin: '20px 0' }} />

          <label style={{ ...labelStyle, color: textMain }}>Reassign to another site</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <input
                value={moveSearch || (moveTarget && !moveDropdownOpen ? (() => { const s = availableSites.find(s => s.site_id === moveTarget); return s ? `${s.site_id}${s.display_name ? ' — ' + s.display_name : ''}` : moveTarget; })() : moveSearch)}
                onChange={e => { setMoveSearch(e.target.value); setMoveTarget(''); setMoveDropdownOpen(true); }}
                onFocus={() => setMoveDropdownOpen(true)}
                onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 150)}
                placeholder={sitesLoading ? 'Loading sites…' : 'Search site ID or name…'}
                disabled={sitesLoading}
                style={{ ...inputStyle, width: '100%', background: surface, borderColor: palette.ok.border }}
              />
              {moveDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: surface, border: `1px solid ${palette.ok.border}`,
                  borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}>
                  {availableSites
                    .filter(s => {
                      const q = moveSearch.toLowerCase();
                      return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q);
                    })
                    .map(s => (
                      <div
                        key={s.site_id}
                        onMouseDown={() => { setMoveTarget(s.site_id); setMoveSearch(''); setMoveDropdownOpen(false); }}
                        style={{
                          padding: '9px 14px', cursor: 'pointer', fontSize: '0.84rem',
                          background: s.site_id === moveTarget ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent',
                          color: textMain,
                          borderBottom: `1px solid ${border}`,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = s.site_id === moveTarget ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent')}
                      >
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.site_id}</span>
                        {s.display_name && <span style={{ color: textSub, marginLeft: 8 }}>{s.display_name}</span>}
                        {s.site_status && (
                          <span style={{ marginLeft: 8, fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: getStatusStyle(s.site_status).bg, color: getStatusStyle(s.site_status).color }}>
                            {s.site_status}
                          </span>
                        )}
                      </div>
                    ))
                  }
                  {availableSites.filter(s => { const q = moveSearch.toLowerCase(); return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q); }).length === 0 && (
                    <div style={{ padding: '10px 14px', fontSize: '0.84rem', color: textMute, textAlign: 'center' }}>No sites found</div>
                  )}
                </div>
              )}
            </div>
            <button type="button" disabled={busy || !moveTarget.trim()} onClick={() => handleMove(gw.device_id, 'gateway')} style={buttonStyle(true)}>
              <ArrowRightLeft size={14} /> Move Device
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 24, borderRadius: 12, border: `1px dashed ${inputBorder}`, background: inputBg, textAlign: 'center' }}>
          <Wifi size={28} color={textMute} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: textMain }}>No Gateway Attached</h3>
          <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 20px' }}>Select an available gateway to link hardware telemetry to this site.</p>

          <div style={{ display: 'flex', gap: 12, maxWidth: 400, margin: '0 auto' }}>
            <select value={gatewayDevicePk} onChange={e => setGatewayDevicePk(e.target.value)} disabled={devicesLoading || busy} style={{ ...inputStyle, flex: 1, background: nativeSelectBg, color: nativeSelectFg }}>
              <option value="">-- Select Gateway --</option>
              {availableGatewayDevices.map(d => (
                <option key={d.id} value={String(d.id)}>
                  {d.device_serial} (ID: {d.id})
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || !gatewayDevicePk || devicesLoading} onClick={() => handleAttach(gatewayDevicePk, 'gateway')} style={buttonStyle()}>
              <LinkIcon size={14} /> Attach
            </button>
          </div>
        </div>
      )}

      {/* Energy Meter section — ported verbatim from SiteDetail.tsx:1518-1585 */}
      <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: textMute, fontWeight: 700, letterSpacing: '0.05em' }}>Energy Meters</div>
            <div style={{ fontSize: '0.9rem', color: textSub }}>Attach one or more energy meters for site-level load and import/export measurements.</div>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: textMain }}>{energyMeters.length} attached</div>
        </div>

        {energyMeters.length > 0 ? (
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {energyMeters.map((meter: any) => (
              <div key={meter.device_id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: textMain }}>{meter.device_serial}</div>
                  <div style={{ fontSize: '0.78rem', color: textSub, fontFamily: 'monospace' }}>PK: {meter.device_id} · Type: energy_meter</div>
                  <div style={{ fontSize: '0.78rem', color: textSub }}>Last seen: {meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString() : 'Never'}</div>
                  {meter.mirrors_device_id && meter.mirrors_device_id === gw?.id ? (
                    <div style={{ fontSize: '0.76rem', color: palette.ok.color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <LinkIcon size={12} />
                      Normally relayed via <strong style={{ fontFamily: 'monospace' }}>{meter.mirrors_device_serial}</strong> — falls back to direct cloud publish if the gateway goes offline
                    </div>
                  ) : gw && mirrorInfoReady ? (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', color: textMute }}>Not paired to the gateway's relay path.</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSetMirror(meter.device_id, gw.device_id)}
                        style={{ ...buttonStyle(true), padding: '2px 8px', fontSize: '0.74rem' }}
                      >
                        <LinkIcon size={11} /> Pair to {gw.device_serial}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} onClick={() => {
                    const target = window.prompt(`Move energy meter ${meter.device_serial} to which site ID?`, '');
                    if (target) handleMove(meter.device_id, `energy meter ${meter.device_serial}`, target);
                  }} style={buttonStyle(true)}>
                    <ArrowRightLeft size={14} /> Move
                  </button>
                  <button type="button" disabled={busy} onClick={() => handleDetach(meter.device_id, meter.device_serial, 'energy meter')} style={buttonStyle(false, true)}>
                    <Unlink size={14} /> Detach
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.84rem', color: textMute, marginBottom: 16 }}>No energy meters attached yet.</div>
        )}

        <div style={{ display: 'flex', gap: 12, maxWidth: 420 }}>
          <select value={energyMeterPk} onChange={e => setEnergyMeterPk(e.target.value)} disabled={devicesLoading || busy} style={{ ...inputStyle, flex: 1, background: nativeSelectBg, color: nativeSelectFg }}>
            <option value="">-- Select Energy Meter --</option>
            {availableEnergyMeterDevices.map(d => (
              <option key={d.id} value={String(d.id)}>
                {d.device_serial} (ID: {d.id})
              </option>
            ))}
          </select>
          <button type="button" disabled={busy || !energyMeterPk || devicesLoading} onClick={() => handleAttach(energyMeterPk, 'energy_meter')} style={buttonStyle()}>
            <LinkIcon size={14} /> Attach
          </button>
        </div>
      </div>

      {/* Circuit Lines section — two read-only status rows, then the ev_line-only list-builder */}
      <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Zap size={16} color={primary} />
          <div>
            <div style={{ fontWeight: 700, color: textMain }}>Circuit Lines</div>
            <div style={{ fontSize: '0.8rem', color: textSub }}>Inverter backup and grid-line coverage are automatic once hardware is attached above. Declare any other known circuit (e.g. an EV charger) even if unmonitored.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: surface }}>
            <span style={{ fontSize: '0.82rem', color: textMain }}>Inverter backup bus</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: hasGateway ? primary : palette.warn.color }}>
              {hasGateway ? 'Covered by attached gateway' : 'Not covered — no gateway attached'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: surface }}>
            <span style={{ fontSize: '0.82rem', color: textMain }}>Grid line</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: hasEnergyMeter ? primary : palette.warn.color }}>
              {hasEnergyMeter ? 'Covered by attached energy meter' : 'Not covered — no energy meter attached'}
            </span>
          </div>
        </div>

        {circuitLinesLoading ? (
          <div style={{ fontSize: '0.84rem', color: textMute }}>Loading circuit lines…</div>
        ) : circuitLines.length === 0 ? (
          <div style={{ fontSize: '0.84rem', color: textMute }}>No other circuit lines declared for this site.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {circuitLines.map((line: any) => (
              <div key={line.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surface }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: textMain }}>{line.label || line.circuit}</div>
                    <div style={{ fontSize: '0.78rem', color: textSub }}>
                      Circuit: <strong>EV line</strong>
                      {' · '}
                      <span style={{ color: line.is_monitored ? primary : palette.warn.color }}>
                        {line.is_monitored ? 'Monitored' : 'Unmonitored'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" disabled={circuitLinesSaving} onClick={() => beginEditCircuitLine(line)} style={buttonStyle(true)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" disabled={circuitLinesSaving} onClick={() => removeCircuitLine(line)} style={buttonStyle(false, true)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}`, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: textMain }}>
              {editingCircuitLineId != null ? 'Edit Circuit Line' : 'Add Circuit Line'}
            </div>
            {(editingCircuitLineId != null || circuitLineDraft.label) && (
              <button type="button" disabled={circuitLinesSaving} onClick={resetCircuitLineForm} style={buttonStyle(true)}>
                Cancel
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Label</label>
              <input
                value={circuitLineDraft.label}
                onChange={e => setCircuitLineDraft({ ...circuitLineDraft, label: e.target.value })}
                disabled={circuitLinesSaving}
                style={{ ...inputStyle, width: '100%', background: surface }}
                placeholder="e.g. Garage EV charger"
              />
            </div>
            <div>
              <label style={labelStyle}>Monitoring Device</label>
              <select
                value={circuitLineDraft.device != null ? String(circuitLineDraft.device) : ''}
                onChange={e => setCircuitLineDraft({ ...circuitLineDraft, device: e.target.value ? parseInt(e.target.value, 10) : null })}
                disabled={circuitLinesSaving}
                style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
              >
                <option value="">-- None (unmonitored) --</option>
                {smartDevices.filter((d: any) => d.circuit === 'ev_line').map((d: any) => (
                  <option key={d.id} value={String(d.id)}>{d.display_name || d.provider_device_id || d.id}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={circuitLinesSaving} onClick={() => saveCircuitLine()} style={buttonStyle()}>
              {circuitLinesSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              {editingCircuitLineId != null ? 'Update Circuit Line' : 'Add Circuit Line'}
            </button>
          </div>
        </div>
      </div>

      {/* Smart Devices section — ported verbatim from SiteDetail.tsx:1587-1737 (unchanged: still
          offers grid_direct/inverter_backup/ev_line for the device's own `circuit` field — that
          field describes which bus the physical device sits on, independent of whether a
          SiteCircuitLine happens to reference it) */}
      <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Zap size={16} color={primary} />
          <div>
            <div style={{ fontWeight: 700, color: textMain }}>Smart Devices</div>
            <div style={{ fontSize: '0.8rem', color: textSub }}>Mapped separately from hardware devices. Appliance mapping remains the source of truth for what each smart device powers.</div>
          </div>
        </div>
        {smartDevicesLoading ? (
          <div style={{ fontSize: '0.84rem', color: textMute }}>Loading smart devices…</div>
        ) : smartDevices.length === 0 ? (
          <div style={{ fontSize: '0.84rem', color: textMute }}>No smart devices mapped to this site.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {smartDevices.map((device: any) => (
              <div key={device.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surface }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: textMain }}>{device.display_name || device.appliance_label}</div>
                    <div style={{ fontSize: '0.78rem', color: textSub }}>
                      Provider type: <strong>{String(device.device_type || '').replace(/_/g, ' ') || 'unknown'}</strong>
                      {' · '}
                      Appliance: <strong>{String(device.appliance_label || '').replace(/_/g, ' ') || 'unmapped'}</strong>
                      {' · '}
                      Circuit: <strong>{device.circuit === 'inverter_backup' ? 'inverter backup' : device.circuit === 'ev_line' ? 'EV line' : 'grid line'}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: textSub, fontFamily: 'monospace' }}>
                      Provider ID: {device.provider_device_id || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.78rem', color: textSub }}>
                      {device.latest?.power_w != null ? `${(device.latest.power_w / 1000).toFixed(2)} kW` : 'No live power'}
                    </div>
                    <button type="button" disabled={smartDevicesSaving} onClick={() => beginEditSmartDevice(device)} style={buttonStyle(true)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" disabled={smartDevicesSaving} onClick={() => removeSmartDevice(device)} style={buttonStyle(false, true)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}`, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: textMain }}>
                {editingSmartDeviceId != null ? 'Edit Smart Device' : 'Add Smart Device'}
              </div>
              <div style={{ fontSize: '0.78rem', color: textSub }}>
                Keep the appliance mapping explicit. EV-linked devices should stay mapped as <strong style={{ color: textMain }}>ev_charger</strong>.
              </div>
            </div>
            {(editingSmartDeviceId != null || smartDeviceDraft.provider_device_id || smartDeviceDraft.display_name) && (
              <button type="button" disabled={smartDevicesSaving} onClick={resetSmartDeviceForm} style={buttonStyle(true)}>
                Cancel
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Provider Type</label>
              <select
                value={smartDeviceDraft.device_type}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, device_type: e.target.value })}
                disabled={smartDevicesSaving}
                style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
              >
                <option value="tuya_plug">Tuya Plug</option>
                <option value="tuya_switch">Tuya Switch</option>
                <option value="ct_clamp">CT Clamp</option>
                <option value="modbus_meter">Modbus Meter</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Appliance Mapping</label>
              <select
                value={smartDeviceDraft.appliance_label}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, appliance_label: e.target.value })}
                disabled={smartDevicesSaving}
                style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
              >
                <option value="ev_charger">EV Charger</option>
                <option value="geyser">Geyser</option>
                <option value="ac_unit">AC Unit</option>
                <option value="water_pump">Water Pump</option>
                <option value="washing_machine">Washing Machine</option>
                <option value="fridge">Fridge</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Circuit</label>
              <select
                value={smartDeviceDraft.circuit}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, circuit: e.target.value })}
                disabled={smartDevicesSaving}
                title="Which electrical circuit this device is on — grid line, inverter backup bus, or the isolated EV charger circuit"
                style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
              >
                <option value="grid_direct">Grid Line</option>
                <option value="inverter_backup">Inverter Backup</option>
                <option value="ev_line">EV Line</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ingest Mode</label>
              <select
                value={smartDeviceDraft.ingest_mode ?? 'poll'}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, ingest_mode: e.target.value })}
                disabled={smartDevicesSaving}
                style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
              >
                <option value="poll">Poll (5-min cron)</option>
                <option value="pulsar">Pulsar push (real-time)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Provider Device ID</label>
              <input
                value={smartDeviceDraft.provider_device_id}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, provider_device_id: e.target.value })}
                disabled={smartDevicesSaving}
                style={{ ...inputStyle, width: '100%', background: surface }}
                placeholder="e.g. bf12ab34cd56"
              />
            </div>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                value={smartDeviceDraft.display_name}
                onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, display_name: e.target.value })}
                disabled={smartDevicesSaving}
                style={{ ...inputStyle, width: '100%', background: surface }}
                placeholder="e.g. EV Charger Plug"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="smart-device-active"
              type="checkbox"
              checked={smartDeviceDraft.is_active}
              onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, is_active: e.target.checked })}
              disabled={smartDevicesSaving}
            />
            <label htmlFor="smart-device-active" style={{ fontSize: '0.82rem', color: textSub }}>Active</label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={smartDevicesSaving} onClick={saveSmartDevice} style={buttonStyle()}>
              {smartDevicesSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              {editingSmartDeviceId != null ? 'Update Smart Device' : 'Add Smart Device'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
