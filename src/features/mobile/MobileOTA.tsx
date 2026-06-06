import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  RefreshCw, Upload, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Clock, Zap,
  Play, RotateCcw, Trash2, X, Shield, Plus,
  ArrowRight, Package,
} from 'lucide-react';

interface FirmwareVersion {
  id: number; name: string; version: string; deviceModel: string;
  size: number; checksum: string; signatureValid: boolean;
  releaseNotes: string; status: 'draft' | 'stable'; uploadDate: string;
  is_active?: boolean;
}

interface DeviceStatus {
  deviceId: string; currentVersion: string; targetVersion: string;
  activeSlot: 'A' | 'B';
  status: 'idle' | 'downloading' | 'flashing' | 'rebooting' | 'trial' | 'healthy' | 'failed' | 'rolledback';
  bootCount: number; lastError: string; progress?: number; lastCheckedAt?: string;
}

const S: Record<string, { color: string; label: string }> = {
  idle:        { color: '#64748b', label: 'Idle' },
  healthy:     { color: '#2FBF71', label: 'Healthy' },
  trial:       { color: '#60A5FA', label: 'Trial' },
  downloading: { color: '#F59E0B', label: 'Downloading' },
  flashing:    { color: '#a78bfa', label: 'Flashing' },
  rebooting:   { color: '#F59E0B', label: 'Rebooting' },
  failed:      { color: '#F87171', label: 'Failed' },
  rolledback:  { color: '#f97316', label: 'Rolled Back' },
};

const ACTIVE_STATUSES = ['downloading', 'flashing', 'rebooting', 'trial'];
const fmtBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
const fmtDate  = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const mapLogStatus = (s: string | null): DeviceStatus['status'] => {
  switch (s?.toLowerCase()) {
    case 'pending':     return 'idle';
    case 'checking':
    case 'available':   return 'trial';
    case 'downloading': return 'downloading';
    case 'completed':   return 'healthy';
    case 'failed':      return 'failed';
    case 'skipped':     return 'idle';
    default:            return 'idle';
  }
};

const MobileOTA: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const surface2= isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';
  const inp     = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  const [firmwares, setFirmwares]     = useState<FirmwareVersion[]>([]);
  const [devices, setDevices]         = useState<DeviceStatus[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [devFilter, setDevFilter]     = useState<string>('all');
  const [expandedFW, setExpandedFW]   = useState<Set<number>>(new Set());
  const [expandedDev, setExpandedDev] = useState<Set<string>>(new Set());
  const [fwSearch, setFwSearch]       = useState('');

  const [sheet, setSheet]             = useState(false);
  const [pickingFW, setPickingFW]     = useState(false);
  const [deployFWId, setDeployFWId]   = useState<number | ''>('');
  const [deployDevices, setDeployDevices] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes]     = useState(false);
  const [notes, setNotes]             = useState('');
  const [deploying, setDeploying]     = useState(false);
  const [deployErr, setDeployErr]     = useState('');

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fw, dev] = await Promise.allSettled([
        apiService.getFirmwareVersions(false),
        apiService.getOTADevices(),
      ]);
      if (fw.status === 'fulfilled') {
        const list = Array.isArray(fw.value?.results) ? fw.value.results : Array.isArray(fw.value) ? fw.value : [];
        setFirmwares(list);
      }
      if (dev.status === 'fulfilled') {
        const raw: any[] = Array.isArray(dev.value) ? dev.value : [];
        setDevices(raw.map((d: any) => ({
          deviceId:       d.device_serial ?? d.deviceId ?? '',
          currentVersion: d.current_firmware ?? d.currentVersion ?? 'Not reported',
          targetVersion:  d.target_firmware_version ?? d.targetVersion ?? 'N/A',
          activeSlot:     (d.active_slot ?? 'A') as 'A' | 'B',
          status:         mapLogStatus(d.log_status ?? d.status ?? null),
          bootCount:      d.boot_count ?? d.bootCount ?? 0,
          lastError:      d.log_error ?? d.lastError ?? '',
          progress:       d.progress ?? undefined,
          lastCheckedAt:  d.log_last_checked_at ?? d.lastCheckedAt ?? undefined,
        })));
      }
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const campaigns = useMemo(() => {
    const map = new Map<string, DeviceStatus[]>();
    devices
      .filter(d => ACTIVE_STATUSES.includes(d.status))
      .forEach(d => {
        const key = d.targetVersion;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(d);
      });
    return Array.from(map.entries()).map(([version, devs]) => ({
      version,
      devices: devs,
      avgProgress: Math.round(devs.reduce((s, d) => s + (d.progress ?? 0), 0) / devs.length),
      failed: devs.filter(d => d.status === 'failed').length,
    }));
  }, [devices]);

  const filteredFW = useMemo(() =>
    firmwares.filter(f => !fwSearch || f.version.includes(fwSearch) || f.name.toLowerCase().includes(fwSearch.toLowerCase())),
    [firmwares, fwSearch]);

  const filteredDevices = useMemo(() =>
    devFilter === 'all' ? devices : devices.filter(d => d.status === devFilter),
    [devices, devFilter]);

  const openDeploy = (fwId?: number) => {
    setDeployFWId(fwId ?? '');
    setDeployDevices(new Set());
    setPickingFW(!fwId);
    setShowNotes(false);
    setNotes('');
    setDeployErr('');
    setSheet(true);
  };

  const toggleDev = (id: string) => setDeployDevices(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selectedFW = firmwares.find(f => f.id === deployFWId);

  const outdatedDevices = useMemo(() => {
    if (!selectedFW) return devices;
    return devices.filter(d => d.currentVersion !== selectedFW.version);
  }, [devices, selectedFW]);

  const handleDeploy = async () => {
    if (!deployFWId) { setDeployErr('Select a firmware version'); return; }
    if (deployDevices.size === 0) { setDeployErr('Select at least one device'); return; }
    setDeploying(true); setDeployErr('');
    try {
      await apiService.deployFirmware(deployFWId as number, Array.from(deployDevices), notes.trim() || undefined);
      setSheet(false);
      fetchAll(true);
    } catch (e: any) { setDeployErr(e?.message ?? 'Deploy failed'); }
    finally { setDeploying(false); }
  };

  const handleActivate = async (id: number) => {
    try { await apiService.updateFirmwareVersion(id, { is_active: true }); fetchAll(true); } catch { }
  };
  const handleDelete = async (id: number) => {
    try { await apiService.deleteFirmwareVersion(id); fetchAll(true); } catch { }
  };
  const handleRollback = async (deviceId: string) => {
    try { await apiService.triggerRollback(deviceId, 'Manual rollback'); fetchAll(true); } catch { }
  };

  const card = (leftColor?: string): React.CSSProperties => ({
    background: surface, backdropFilter: 'blur(16px)', borderRadius: 16, overflow: 'hidden',
    border: `1px solid ${border}`,
    borderLeft: leftColor ? `3px solid ${leftColor}` : `1px solid ${border}`,
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', background: inp, border: `1px solid ${border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: '0.82rem', color: text, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
  };

  const counts = {
    healthy:  devices.filter(d => d.status === 'healthy').length,
    failed:   devices.filter(d => d.status === 'failed').length,
    active:   devices.filter(d => ACTIVE_STATUSES.includes(d.status)).length,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: muted, marginBottom: 8, fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 68 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ ...mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 3 }}>
              OTA · Firmware Manager
            </div>
            <div style={{ fontSize: '0.82rem', color: muted, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: text, fontWeight: 600 }}>{firmwares.length} versions</span>
              <span>·</span>
              <span style={{ color: text, fontWeight: 600 }}>{devices.length} devices</span>
              {counts.active > 0 && <><span>·</span><span style={{ color: '#F59E0B', fontWeight: 700 }}>{counts.active} active</span></>}
              {counts.failed > 0 && <><span>·</span><span style={{ color: '#F87171', fontWeight: 700 }}>{counts.failed} failed</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setRefreshing(true); fetchAll(true); }}
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', color: muted, padding: '7px', display: 'flex' }}>
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={() => openDeploy()}
              style={{ background: accent, border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
              <Plus size={14} /> Deploy
            </button>
          </div>
        </div>

        {devices.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {[
              { label: 'Healthy',  value: counts.healthy, color: '#2FBF71' },
              { label: 'Updating', value: counts.active,  color: '#F59E0B' },
              { label: 'Failed',   value: counts.failed,  color: '#F87171' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, animation: label === 'Updating' && value > 0 ? 'pulse 2s ease-in-out infinite' : 'none' }}/>
                <div>
                  <div style={{ ...mono, fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.57rem', color: `${color}bb`, fontWeight: 600, marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 16px', gap: 12 }}>
          <RefreshCw size={20} color={muted} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '0.75rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>Loading…</div>
        </div>
      ) : (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {campaigns.length > 0 && (
            <section>
              <div style={sectionLabel}>Active Deployments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campaigns.map(c => (
                  <div key={c.version} style={card('#F59E0B')}>
                    <div style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ ...mono, fontSize: '0.88rem', fontWeight: 700, color: text }}>v{c.version}</span>
                            {c.failed > 0 && (
                              <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 999, fontWeight: 700, background: 'rgba(248,113,113,0.12)', color: '#F87171', fontFamily: "'DM Sans', sans-serif" }}>
                                {c.failed} failed
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: muted, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>
                            {c.devices.length} device{c.devices.length !== 1 ? 's' : ''} in progress
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ ...mono, fontSize: '1.15rem', fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{c.avgProgress}%</div>
                          <div style={{ fontSize: '0.57rem', color: muted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>avg progress</div>
                        </div>
                      </div>
                      <div style={{ height: 5, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${c.avgProgress}%`, borderRadius: 99, background: 'linear-gradient(90deg, #F59E0B, #fbbf24)', transition: 'width 600ms ease' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                        {c.devices.map(d => {
                          const sc = S[d.status] ?? S.idle;
                          return (
                            <div key={d.deviceId} title={`${d.deviceId} · ${sc.label}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 7px', border: `1px solid ${border}` }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, animation: ACTIVE_STATUSES.slice(0, 3).includes(d.status) ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                              <span style={{ ...mono, fontSize: '0.58rem', color: muted }}>{d.deviceId.slice(-6)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={sectionLabel}>Firmware Library</div>
              <div style={{ ...mono, fontSize: '0.6rem', color: muted }}>{firmwares.length} versions</div>
            </div>

            <input value={fwSearch} onChange={e => setFwSearch(e.target.value)} placeholder="Search version or name…" style={{ ...inputStyle, marginBottom: 8 }} />

            {filteredFW.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: muted, fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>
                {fwSearch ? 'No versions match.' : 'No firmware uploaded yet.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {filteredFW.map(fw => {
                  const isExp = expandedFW.has(fw.id);
                  const statusColor = fw.status === 'stable' ? '#2FBF71' : '#64748b';
                  return (
                    <div key={fw.id} style={card(fw.is_active ? accent : statusColor)}>
                      <button
                        onClick={() => setExpandedFW(prev => { const n = new Set(prev); n.has(fw.id) ? n.delete(fw.id) : n.add(fw.id); return n; })}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: fw.is_active ? `${accent}12` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${fw.is_active ? accent+'25' : border}` }}>
                          <Package size={15} color={fw.is_active ? accent : muted} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ ...mono, fontSize: '0.9rem', fontWeight: 700, color: text }}>v{fw.version}</span>
                            <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 999, fontWeight: 700, background: `${statusColor}12`, color: statusColor, fontFamily: "'DM Sans', sans-serif" }}>{fw.status}</span>
                            {fw.is_active && <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 999, fontWeight: 700, background: `${accent}12`, color: accent, fontFamily: "'DM Sans', sans-serif" }}>ACTIVE</span>}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                            {fw.name} · {fw.deviceModel}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.65rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBytes(fw.size)}</span>
                          {isExp ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                        </div>
                      </button>

                      {isExp && (
                        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${border}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, marginBottom: 14 }}>
                            <div>
                              <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Uploaded</div>
                              <div style={{ fontSize: '0.72rem', color: text, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(fw.uploadDate)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Signature</div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: fw.signatureValid ? '#2FBF71' : '#F87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {fw.signatureValid ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                {fw.signatureValid ? 'Valid' : 'Invalid'}
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Checksum</div>
                              <div style={{ ...mono, fontSize: '0.63rem', color: muted, background: surface2, padding: '5px 8px', borderRadius: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${border}` }}>
                                {fw.checksum?.slice(0, 24) ?? '—'}…
                              </div>
                            </div>
                            {fw.releaseNotes && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Release Notes</div>
                                <div style={{ fontSize: '0.72rem', color: muted, lineHeight: 1.6, background: surface2, padding: '9px 12px', borderRadius: 9, border: `1px solid ${border}`, fontFamily: "'DM Sans', sans-serif" }}>
                                  {fw.releaseNotes}
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 7 }}>
                            <button onClick={() => openDeploy(fw.id)}
                              style={{ flex: 1, padding: '9px', background: `${accent}12`, border: `1px solid ${accent}25`, borderRadius: 10, cursor: 'pointer', color: accent, fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
                              <Play size={12} /> Deploy
                            </button>
                            {!fw.is_active && (
                              <button onClick={() => handleActivate(fw.id)}
                                style={{ flex: 1, padding: '9px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', color: muted, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
                                <CheckCircle size={12} /> Set Active
                              </button>
                            )}
                            <button onClick={() => handleDelete(fw.id)}
                              style={{ padding: '9px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, cursor: 'pointer', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={sectionLabel}>Device Fleet</div>
              <div style={{ ...mono, fontSize: '0.6rem', color: muted }}>{filteredDevices.length} / {devices.length}</div>
            </div>

            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {(['all', 'healthy', 'failed', 'downloading', 'flashing', 'trial', 'idle', 'rolledback'] as const).map(f => {
                const c = S[f]?.color ?? accent;
                return (
                  <button key={f} onClick={() => setDevFilter(f)}
                    style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', flexShrink: 0, background: devFilter === f ? `${c}18` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), color: devFilter === f ? c : muted, fontFamily: "'DM Sans', sans-serif" }}>
                    {f === 'all' ? 'All' : S[f]?.label ?? f}
                  </button>
                );
              })}
            </div>

            {filteredDevices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: muted, fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>No devices match.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {filteredDevices.map(d => {
                  const sc = S[d.status] ?? S.idle;
                  const isExp = expandedDev.has(d.deviceId);
                  const isAnimating = ['downloading', 'flashing', 'rebooting'].includes(d.status);
                  return (
                    <div key={d.deviceId} style={card(sc.color)}>
                      <button
                        onClick={() => setExpandedDev(prev => { const n = new Set(prev); n.has(d.deviceId) ? n.delete(d.deviceId) : n.add(d.deviceId); return n; })}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0, animation: isAnimating ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...mono, fontSize: '0.82rem', fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.deviceId}</div>
                          <div style={{ fontSize: '0.67rem', color: muted, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ ...mono }}>v{d.currentVersion}</span>
                            {d.targetVersion && d.targetVersion !== d.currentVersion && (
                              <><ArrowRight size={9} color={muted} /><span style={{ ...mono, color: '#F59E0B' }}>v{d.targetVersion}</span></>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: sc.color, fontFamily: "'DM Sans', sans-serif" }}>{sc.label}</span>
                          {d.progress != null && ACTIVE_STATUSES.includes(d.status) && (
                            <span style={{ ...mono, fontSize: '0.6rem', color: muted }}>{d.progress}%</span>
                          )}
                          {isExp ? <ChevronUp size={12} color={muted} /> : <ChevronDown size={12} color={muted} />}
                        </div>
                      </button>

                      {d.progress != null && ACTIVE_STATUSES.includes(d.status) && (
                        <div style={{ height: 3, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '0 14px', borderRadius: 99 }}>
                          <div style={{ height: '100%', width: `${d.progress}%`, background: sc.color, borderRadius: 99, transition: 'width 400ms ease' }} />
                        </div>
                      )}

                      {isExp && (
                        <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${border}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Slot</div>
                              <div style={{ ...mono, fontSize: '0.78rem', color: text }}>{d.activeSlot}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Boot Count</div>
                              <div style={{ ...mono, fontSize: '0.78rem', color: text }}>{d.bootCount}</div>
                            </div>
                            {d.lastCheckedAt && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: '0.57rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Last Checked</div>
                                <div style={{ fontSize: '0.72rem', color: text, fontFamily: "'DM Sans', sans-serif" }}>
                                  {new Date(d.lastCheckedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            )}
                          </div>
                          {d.lastError && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 9, padding: '8px 10px', marginBottom: 10 }}>
                              <AlertTriangle size={11} color="#F87171" style={{ marginTop: 1, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.7rem', color: '#F87171', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{d.lastError}</span>
                            </div>
                          )}
                          {['failed', 'trial'].includes(d.status) && (
                            <button onClick={() => handleRollback(d.deviceId)}
                              style={{ width: '100%', padding: '9px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, cursor: 'pointer', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
                              <RotateCcw size={12} /> Rollback
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {sheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSheet(false)}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', backdropFilter: 'blur(20px)', borderRadius: '20px 20px 0 0', width: '100%', height: 'min(640px, 91dvh)', display: 'flex', flexDirection: 'column', border: `1px solid ${border}` }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '12px 16px 12px', flexShrink: 0, borderBottom: `1px solid ${border}` }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: border, margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif" }}>New Deployment</div>
                  <div style={{ fontSize: '0.68rem', color: muted, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>
                    {deployDevices.size > 0
                      ? `${deployDevices.size} device${deployDevices.size > 1 ? 's' : ''} selected`
                      : selectedFW ? `v${selectedFW.version} selected` : 'Choose firmware & devices'}
                  </div>
                </div>
                <button onClick={() => setSheet(false)}
                  style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', color: muted, display: 'flex', padding: '7px' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {deployErr && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '9px 12px', fontSize: '0.73rem', color: '#F87171', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
                  <AlertTriangle size={12} /> {deployErr}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={sectionLabel}>Firmware</div>
                  {selectedFW && !pickingFW && (
                    <button onClick={() => setPickingFW(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: '0.68rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                      Change
                    </button>
                  )}
                </div>

                {selectedFW && !pickingFW ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', borderRadius: 12, background: `${accent}0C`, border: `1.5px solid ${accent}30` }}>
                    <Package size={15} color={accent} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ ...mono, fontSize: '0.88rem', fontWeight: 700, color: accent }}>v{selectedFW.version}</span>
                        <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, fontWeight: 700, background: selectedFW.status === 'stable' ? 'rgba(47,191,113,0.12)' : 'rgba(100,116,139,0.12)', color: selectedFW.status === 'stable' ? '#2FBF71' : '#64748b', fontFamily: "'DM Sans', sans-serif" }}>{selectedFW.status}</span>
                      </div>
                      <div style={{ fontSize: '0.67rem', color: muted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{selectedFW.name} · {fmtBytes(selectedFW.size)}</div>
                    </div>
                    <CheckCircle size={15} color={accent} style={{ flexShrink: 0 }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {firmwares.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: muted, fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>No firmware available</div>
                    ) : firmwares.map(f => {
                      const sel = deployFWId === f.id;
                      return (
                        <button key={f.id} onClick={() => { setDeployFWId(f.id); setPickingFW(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${sel ? accent : border}`, background: sel ? `${accent}0C` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${sel ? accent : border}`, background: sel ? accent : 'transparent', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ ...mono, fontSize: '0.83rem', fontWeight: 700, color: sel ? accent : text }}>v{f.version}</span>
                              <span style={{ fontSize: '0.58rem', padding: '1px 6px', borderRadius: 999, fontWeight: 700, background: f.status === 'stable' ? 'rgba(47,191,113,0.1)' : 'rgba(100,116,139,0.1)', color: f.status === 'stable' ? '#2FBF71' : '#64748b', fontFamily: "'DM Sans', sans-serif" }}>{f.status}</span>
                              {f.is_active && <span style={{ fontSize: '0.58rem', padding: '1px 6px', borderRadius: 999, fontWeight: 700, background: `${accent}12`, color: accent, fontFamily: "'DM Sans', sans-serif" }}>active</span>}
                            </div>
                            <div style={{ fontSize: '0.67rem', color: muted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{f.name} · {fmtBytes(f.size)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ ...sectionLabel, marginBottom: 0 }}>
                    Target Devices
                    {selectedFW && outdatedDevices.length < devices.length && (
                      <span style={{ color: accent, marginLeft: 6 }}>· {outdatedDevices.length} outdated</span>
                    )}
                  </div>
                  {outdatedDevices.length > 0 && (
                    <button
                      onClick={() => {
                        if (deployDevices.size === outdatedDevices.length)
                          setDeployDevices(new Set());
                        else
                          setDeployDevices(new Set(outdatedDevices.map(d => d.deviceId)));
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: '0.68rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                      {deployDevices.size === outdatedDevices.length ? 'Clear' : 'Select outdated'}
                    </button>
                  )}
                </div>

                {outdatedDevices.length === 0 && selectedFW ? (
                  <div style={{ fontSize: '0.78rem', color: muted, textAlign: 'center', padding: '16px', background: `${accent}07`, borderRadius: 10, border: `1px solid ${accent}18`, fontFamily: "'DM Sans', sans-serif" }}>
                    All devices are already on v{selectedFW.version}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(selectedFW ? outdatedDevices : devices).map(d => {
                      const sel = deployDevices.has(d.deviceId);
                      const sc = S[d.status] ?? S.idle;
                      return (
                        <button key={d.deviceId} onClick={() => toggleDev(d.deviceId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${sel ? accent : border}`, background: sel ? `${accent}07` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${sel ? accent : border}`, background: sel ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {sel && <svg width="11" height="11" viewBox="0 0 11 11"><polyline points="2,5.5 4.5,8 9,3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ ...mono, fontSize: '0.78rem', fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.deviceId}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.6rem', color: sc.color, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{sc.label}</span>
                              <span style={{ ...mono, fontSize: '0.6rem', color: muted }}>· v{d.currentVersion}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => setShowNotes(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: '0.72rem', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  {showNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showNotes ? 'Hide notes' : 'Add deployment notes (optional)'}
                </button>
                {showNotes && (
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Reason for deployment, version highlights…"
                    rows={3}
                    style={{ ...inputStyle, marginTop: 8, resize: 'none', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}
                  />
                )}
              </div>

              <div style={{ height: 4 }} />
            </div>

            <div style={{ padding: '10px 16px 32px', borderTop: `1px solid ${border}`, flexShrink: 0, background: isDark ? '#0D1117' : '#FFFFFF' }}>
              <button onClick={handleDeploy}
                disabled={deploying || !deployFWId || deployDevices.size === 0}
                style={{
                  width: '100%', padding: '13px',
                  background: deploying || !deployFWId || deployDevices.size === 0
                    ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
                    : accent,
                  border: 'none', borderRadius: 14,
                  cursor: deploying || !deployFWId || deployDevices.size === 0 ? 'not-allowed' : 'pointer',
                  color: deploying || !deployFWId || deployDevices.size === 0 ? muted : '#fff',
                  fontSize: '0.88rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif",
                }}>
                <Play size={14} />
                {deploying ? 'Deploying…' : deployDevices.size > 0 ? `Deploy to ${deployDevices.size} device${deployDevices.size > 1 ? 's' : ''}` : 'Select devices to deploy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
      `}</style>
    </div>
  );
};

export default MobileOTA;
