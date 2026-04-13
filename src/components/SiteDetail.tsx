import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';
import { MobileSiteDetail } from './mobile';
import { 
  ArrowLeft, Battery, Cpu, Server, Wifi, Activity, 
  Settings, Save, AlertTriangle, Link as LinkIcon, 
  Unlink, ArrowRightLeft, RefreshCw 
} from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import PageHeader from './PageHeader';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'gateway' | 'lifecycle';
const LIFECYCLE_OPTIONS = ['draft', 'commissioning', 'active', 'inactive', 'archived'];
interface OwnerUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const tabVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SiteDetail() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileSiteDetail />;
  const { siteId: siteIdParam } = useParams<{ siteId: string }>();
  const siteId = siteIdParam ? (() => { try { return decodeURIComponent(siteIdParam); } catch { return siteIdParam; } })() : '';
  const { isDark } = useTheme();

  // ── State ──
  const [tab, setTab] = useState<Tab>('overview');
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [ownerUsers, setOwnerUsers] = useState<OwnerUser[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcNote, setCalcNote] = useState<string | null>(null);

  // Form State
  const [devicePk, setDevicePk] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [lifecycleTo, setLifecycleTo] = useState('active');
  const [displayName, setDisplayName] = useState('');
  const [capacityKw, setCapacityKw] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [deyeStationId, setDeyeStationId] = useState('');
  const [loggerSerial, setLoggerSerial] = useState('');
  const [editingDeyeSettings, setEditingDeyeSettings] = useState(false);

  // ── Design Tokens ──
  const bg          = isDark ? '#020617' : '#f0fdf4';
  const surface     = isDark ? '#0f172a' : '#ffffff';
  const border      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';
  const textMain    = isDark ? '#f1f5f9' : '#0f172a';
  const textMute    = isDark ? '#64748b' : '#94a3b8';
  const textSub     = isDark ? '#94a3b8' : '#475569';
  const primary     = '#00a63e';

  const palette = {
    ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
    warn: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
    err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
    info: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.2)'  },
    mute: { bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: textSub, border: inputBorder },
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return palette.ok;
      case 'commissioning': return palette.info;
      case 'inactive': return palette.err;
      case 'draft': case 'archived': default: return palette.mute;
    }
  };

  // ── Shared Styles ──
  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${inputBorder}`, background: inputBg, color: textMain,
    fontSize: '0.85rem', outline: 'none', transition: 'border-color 150ms',
    minWidth: 180
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', 
    letterSpacing: '0.05em', color: textMute, display: 'block', marginBottom: 6
  };

  const buttonStyle = (isSecondary = false, isDanger = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    background: isDanger ? palette.err.bg : isSecondary ? palette.mute.bg : primary,
    color: isDanger ? palette.err.color : isSecondary ? textMain : '#fff',
    borderStyle: 'solid', borderWidth: 1,
    borderColor: isDanger ? palette.err.border : isSecondary ? palette.mute.border : primary,
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms', opacity: busy ? 0.7 : 1,
    boxShadow: isSecondary || isDanger ? 'none' : '0 4px 12px rgba(0,166,62,0.2)'
  });

  // ── Data Fetching & Handlers ──
  const refresh = useCallback(async () => {
    if (!siteId) return;
    setLoading(true); setError(null);
    try {
      const data = await apiService.getSiteStaffDetail(siteId);
      setSite(data);
      setDisplayName(data.display_name ?? '');
      setCapacityKw(data.capacity_kw != null ? String(data.capacity_kw) : '');
      setLatitude(data.latitude != null ? String(data.latitude) : '');
      setLongitude(data.longitude != null ? String(data.longitude) : '');
      setOwnerUserId(data.owner_user != null ? String(data.owner_user) : '');
      setLifecycleTo(data.site_status || 'active');
      setDeyeStationId(data.deye_station_id != null ? String(data.deye_station_id) : '');
      setLoggerSerial(data.logger_serial ?? '');
    } catch (e) {
      setSite(null);
      setError(e instanceof Error ? e.message : 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      setUsersBusy(true);
      try {
        const response = await apiService.getUsers();
        const users = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
        if (mounted) setOwnerUsers(users);
      } catch {
        if (mounted) setOwnerUsers([]);
      } finally {
        if (mounted) setUsersBusy(false);
      }
    };
    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAttach = async () => {
    const pk = parseInt(devicePk, 10);
    if (!pk || Number.isNaN(pk)) return;
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteAttachDevice(siteId, pk);
      setSite(data); setDevicePk('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Attach failed'); } 
    finally { setBusy(false); }
  };

  const handleDetach = async () => {
    if (!site?.gateway_device?.device_id) return;
    if (!window.confirm(`Detach gateway ${site.gateway_device.device_serial} from this site?`)) return;
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteDetachDevice(siteId, site.gateway_device.device_id);
      setSite(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Detach failed'); } 
    finally { setBusy(false); }
  };

  const handleMove = async () => {
    if (!site?.gateway_device?.device_id || !moveTarget.trim()) return;
    if (!window.confirm(`Move gateway to site "${moveTarget.trim()}"?`)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteMoveDevice(moveTarget.trim(), site.gateway_device.device_id, siteId);
      await refresh(); setMoveTarget('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Move failed'); } 
    finally { setBusy(false); }
  };

  const handleLifecycle = async () => {
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteLifecycle(siteId, lifecycleTo);
      setSite(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Lifecycle transition failed'); } 
    finally { setBusy(false); }
  };

  const resetDetailsForm = () => {
    setDisplayName(site?.display_name ?? '');
    setCapacityKw(site?.capacity_kw != null ? String(site.capacity_kw) : '');
    setLatitude(site?.latitude != null ? String(site.latitude) : '');
    setLongitude(site?.longitude != null ? String(site.longitude) : '');
    setOwnerUserId(site?.owner_user != null ? String(site.owner_user) : '');
    setCalcNote(null);
  };

  const calcCapacityFromEquipment = async () => {
    setCalcBusy(true); setCalcNote(null);
    try {
      const eq = await apiService.getSiteEquipment(siteId);
      // toPanelWp: old rows may store kWp-style values, so n<=20 → ×1000
      const toPanelWp = (raw: string | null | undefined) => {
        const n = Number(raw); if (!Number.isFinite(n) || n <= 0) return 0;
        return n <= 20 ? n * 1000 : n;
      };
      const activePanels = (eq.panels ?? []).filter((p: any) => p.is_active !== false);
      const totalPanelWp = activePanels.reduce((s: number, p: any) => s + toPanelWp(p.capacity_wp), 0);
      if (totalPanelWp > 0) {
        const kWp = +(totalPanelWp / 1000).toFixed(2);
        setCapacityKw(String(kWp));
        setCalcNote(`${activePanels.length} panel${activePanels.length !== 1 ? 's' : ''} → ${kWp} kWp`);
        return;
      }
      const activeInverters = (eq.inverters ?? []).filter((i: any) => i.is_active !== false);
      const totalKva = activeInverters.reduce((s: number, i: any) => s + (Number(i.capacity_kva) || 0), 0);
      if (totalKva > 0) {
        const kva = +totalKva.toFixed(2);
        setCapacityKw(String(kva));
        setCalcNote(`${activeInverters.length} inverter${activeInverters.length !== 1 ? 's' : ''} → ${kva} kVA`);
        return;
      }
      setCalcNote('No equipment found for this site.');
    } catch {
      setCalcNote('Failed to fetch equipment.');
    } finally {
      setCalcBusy(false);
    }
  };

  const saveSiteDetails = async () => {
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        display_name: displayName.trim(),
      };

      const parsedCapacity = Number(capacityKw);
      const parsedLatitude = Number(latitude);
      const parsedLongitude = Number(longitude);

      if (capacityKw.trim() !== '' && Number.isFinite(parsedCapacity)) payload.capacity_kw = parsedCapacity;
      if (latitude.trim() !== '' && Number.isFinite(parsedLatitude)) payload.latitude = parsedLatitude;
      if (longitude.trim() !== '' && Number.isFinite(parsedLongitude)) payload.longitude = parsedLongitude;
      payload.owner_user_id = ownerUserId.trim() === '' ? null : Number(ownerUserId);

      const data = await apiService.patchSiteStaff(siteId, payload);
      setSite(data);
      setEditingDetails(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } 
    finally { setBusy(false); }
  };

  const resetDeyeSettingsForm = () => {
    setDeyeStationId(site?.deye_station_id != null ? String(site.deye_station_id) : '');
    setLoggerSerial(site?.logger_serial ?? '');
  };

  const saveDeyeSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsedStation = deyeStationId.trim() === '' ? null : Number(deyeStationId);
      if (parsedStation !== null && Number.isNaN(parsedStation)) {
        throw new Error('Invalid Deye Station ID');
      }

      const payload: Record<string, unknown> = {
        deye_station_id: parsedStation,
        logger_serial: loggerSerial.trim() === '' ? null : loggerSerial.trim(),
      };

      const data = await apiService.patchSiteStaff(siteId, payload);
      setSite(data);
      setEditingDeyeSettings(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const gw = site?.gateway_device;
  const heartbeatHealth = gw?.heartbeat_health;

  // ── Loading State ──
  if (loading) {
    return (
      <div className="admin-container responsive-page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={24} color={textMute} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 60 }}>
      
      <PageHeader
        icon={<Server size={20} color="white" />}
        title={site?.display_name || 'Unnamed Site'}
        subtitle={siteId}
        rightSlot={
          <Link
            to="/sites"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, color: textMute, fontSize: '0.85rem', fontWeight: 600, transition: 'color 150ms' }}
            onMouseEnter={e => e.currentTarget.style.color = textMain}
            onMouseLeave={e => e.currentTarget.style.color = textMute}
          >
            <ArrowLeft size={16} /> Back to Sites
          </Link>
        }
      />

      <div style={{ maxWidth: 800, margin: '32px auto 0', padding: '0 24px' }}>
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 24, background: palette.err.bg, border: `1px solid ${palette.err.border}`, color: palette.err.color, fontSize: '0.85rem', fontWeight: 500 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Sub-header Profile Card ── */}
        {site && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,166,62,0.03)' }}>
            <div style={{ display: 'flex', gap: 24 }}>
               <div>
                  <div style={labelStyle}>Status</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: getStatusStyle(site.site_status).bg, color: getStatusStyle(site.site_status).color, border: `1px solid ${getStatusStyle(site.site_status).border}` }}>
                    {site.site_status}
                  </span>
               </div>
               <div>
                  <div style={labelStyle}>Capacity</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: textMain }}>{site.capacity_kw} <span style={{ fontSize: '0.8rem', color: textMute }}>kW</span></div>
               </div>
               <div>
                  <div style={labelStyle}>Owner</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: textMain }}>{site.owner_username || (site.owner_user != null ? `User #${site.owner_user}` : 'Unassigned')}</div>
               </div>
            </div>
          </div>
        )}

        {/* ── Segmented Tabs ── */}
        <div style={{ display: 'flex', gap: 8, padding: 6, background: inputBg, borderRadius: 12, border: `1px solid ${inputBorder}`, marginBottom: 24 }}>
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
            { id: 'gateway', label: 'Gateway Settings', icon: <Wifi size={14} /> },
            { id: 'lifecycle', label: 'Lifecycle Operations', icon: <Settings size={14} /> }
          ].map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id as Tab)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, transition: 'all 200ms',
                background: tab === t.id ? (isDark ? 'rgba(255,255,255,0.08)' : '#ffffff') : 'transparent',
                color: tab === t.id ? textMain : textMute,
                boxShadow: tab === t.id && !isDark ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {tab === 'overview' && site && (
              <motion.div key="overview" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>General Configuration</h2>
                    {!editingDetails ? (
                      <button type="button" disabled={busy} onClick={() => setEditingDetails(true)} style={buttonStyle(true)}>
                        <Settings size={14} /> Edit Details
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            resetDetailsForm();
                            setEditingDetails(false);
                          }}
                          style={buttonStyle(true)}
                        >
                          Cancel
                        </button>
                        <button type="button" disabled={busy} onClick={saveSiteDetails} style={buttonStyle()}>
                          <Save size={14} /> Save
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={labelStyle}>Display Name</label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="Site Name"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Capacity (kW)</label>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        border: `1px solid ${inputBorder}`, borderRadius: 8,
                        background: inputBg, opacity: editingDetails ? 1 : 0.8,
                        overflow: 'hidden',
                      }}>
                        <input
                          type="number"
                          step="0.01"
                          value={capacityKw}
                          onChange={e => { setCapacityKw(e.target.value); setCalcNote(null); }}
                          style={{
                            flex: 1, padding: '10px 14px', border: 'none', background: 'transparent',
                            color: textMain, fontSize: '0.85rem', outline: 'none', minWidth: 0,
                          }}
                          placeholder="e.g. 5.5"
                          disabled={!editingDetails || busy}
                        />
                        {editingDetails && (
                          <button
                            type="button"
                            onClick={calcCapacityFromEquipment}
                            disabled={calcBusy || busy}
                            title="Calculate from equipment"
                            style={{
                              padding: '0 12px', height: '100%', border: 'none',
                              borderLeft: `1px solid ${inputBorder}`,
                              background: 'transparent', color: textSub,
                              cursor: calcBusy ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                              opacity: calcBusy ? 0.5 : 1, transition: 'opacity 150ms',
                            }}
                          >
                            {calcBusy ? '…' : '⚡ Calc'}
                          </button>
                        )}
                      </div>
                      {calcNote && (
                        <div style={{ fontSize: '0.72rem', color: calcNote.startsWith('No') || calcNote.startsWith('Failed') ? '#f59e0b' : primary, marginTop: 4 }}>
                          {calcNote}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={latitude}
                        onChange={e => setLatitude(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. 11.0168"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Owner User</label>
                      <select
                        value={ownerUserId}
                        onChange={e => setOwnerUserId(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8, cursor: editingDetails ? 'pointer' : 'not-allowed' }}
                        disabled={!editingDetails || busy || usersBusy}
                      >
                        <option value="">Unassigned</option>
                        {ownerUsers.map((u) => {
                          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                          const label = fullName ? `${fullName} (${u.username || `#${u.id}`})` : (u.username || `User #${u.id}`);
                          return (
                            <option key={u.id} value={String(u.id)}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={longitude}
                        onChange={e => setLongitude(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. 76.9558"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                  </div>

                  <div style={{ height: 1, background: border, margin: '24px 0' }} />
                  
                  <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: textMain }}>Related Records</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Link to={`/equipment?site=${encodeURIComponent(siteId)}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: 16, borderRadius: 10, background: inputBg, border: `1px solid ${inputBorder}`, color: textMain, display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = palette.mute.bg} onMouseLeave={e => e.currentTarget.style.background = inputBg}>
                        <div style={{ background: palette.info.bg, color: palette.info.color, padding: 8, borderRadius: 8 }}><Battery size={16} /></div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Equipment Registry</div>
                          <div style={{ fontSize: '0.7rem', color: textMute }}>Inverters & panels</div>
                        </div>
                      </div>
                    </Link>
                    <Link to="/devices" style={{ textDecoration: 'none' }}>
                       <div style={{ padding: 16, borderRadius: 10, background: inputBg, border: `1px solid ${inputBorder}`, color: textMain, display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = palette.mute.bg} onMouseLeave={e => e.currentTarget.style.background = inputBg}>
                        <div style={{ background: palette.warn.bg, color: palette.warn.color, padding: 8, borderRadius: 8 }}><Cpu size={16} /></div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hardware Devices</div>
                          <div style={{ fontSize: '0.7rem', color: textMute }}>View all devices</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* GATEWAY TAB */}
            {tab === 'gateway' && (
              <motion.div key="gateway" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Wifi size={18} color={primary} />
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Gateway Device</h2>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: textMute, margin: '0 0 24px' }}>
                    A site can have a maximum of one primary gateway. The device owner must match the site owner.
                  </p>

                  {gw ? (
                    <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${palette.ok.border}`, background: palette.ok.bg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: palette.ok.color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>Attached Device</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: textMain }}>{gw.device_serial}</div>
                          <div style={{ fontSize: '0.8rem', color: textSub, fontFamily: 'monospace' }}>PK: {gw.device_id}</div>
                        </div>
                        <button type="button" disabled={busy} onClick={handleDetach} style={buttonStyle(false, true)}>
                          <Unlink size={14} /> Detach
                        </button>
                      </div>

                      <div style={{ height: 1, background: palette.ok.border, margin: '16px 0' }} />
                      <div style={{ fontSize: '0.84rem', color: textSub, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <span><strong>Last seen:</strong> {gw.last_seen_at ? new Date(gw.last_seen_at).toLocaleString() : 'Never'}</span>
                        <span><strong>Signal:</strong> {gw.signal_strength_dbm != null ? `${gw.signal_strength_dbm}%` : 'N/A'}</span>
                        <span style={{ textTransform: 'capitalize' }}><strong>Health:</strong> {heartbeatHealth?.severity || 'ok'}</span>
                      </div>

                      <div style={{ height: 1, background: palette.ok.border, margin: '20px 0' }} />
                      
                      <label style={{ ...labelStyle, color: textMain }}>Reassign to another site</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <input value={moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="Target Site ID" style={{ ...inputStyle, background: surface, borderColor: palette.ok.border }} />
                        <button type="button" disabled={busy || !moveTarget.trim()} onClick={handleMove} style={buttonStyle(true)}>
                          <ArrowRightLeft size={14} /> Move Device
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 24, borderRadius: 12, border: `1px dashed ${inputBorder}`, background: inputBg, textAlign: 'center' }}>
                      <Wifi size={28} color={textMute} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: textMain }}>No Gateway Attached</h3>
                      <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 20px' }}>Enter a Device ID to link hardware telemetry to this site.</p>
                      
                      <div style={{ display: 'flex', gap: 12, maxWidth: 400, margin: '0 auto' }}>
                        <input type="number" value={devicePk} onChange={e => setDevicePk(e.target.value)} placeholder="Device ID (e.g. 402)" style={inputStyle} />
                        <button type="button" disabled={busy || !devicePk} onClick={handleAttach} style={buttonStyle()}>
                          <LinkIcon size={14} /> Attach
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deye Cloud settings */}
                  <div style={{ marginTop: 20, padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Wifi size={18} color={primary} />
                        <div>
                          <div style={{ fontWeight: 700, color: textMain }}>Deye Cloud Settings</div>
                          <div style={{ fontSize: '0.8rem', color: textSub }}>Used for Deye Cloud fallback /device/latest rich payloads.</div>
                        </div>
                      </div>
                      {!editingDeyeSettings ? (
                        <button type="button" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(true); }} style={buttonStyle(true)}>
                          <Settings size={14} /> Edit
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(false); }} style={buttonStyle(true)}>
                            Cancel
                          </button>
                          <button type="button" disabled={busy} onClick={saveDeyeSettings} style={buttonStyle()}>
                            <Save size={14} /> Save
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                      <div>
                        <label style={labelStyle}>Deye Station ID</label>
                        <input
                          type="number"
                          value={deyeStationId}
                          onChange={e => setDeyeStationId(e.target.value)}
                          disabled={!editingDeyeSettings || busy}
                          style={{ ...inputStyle, background: surface, opacity: !editingDeyeSettings ? 0.8 : 1 }}
                          placeholder="e.g. 12616 (from Deye Cloud portal)"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Logger Serial</label>
                        <input
                          value={loggerSerial}
                          onChange={e => setLoggerSerial(e.target.value)}
                          disabled={!editingDeyeSettings || busy}
                          style={{ ...inputStyle, background: surface, opacity: !editingDeyeSettings ? 0.8 : 1 }}
                          placeholder="e.g. 2509273375 (SolarmanV5/LSW3 dongle)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* LIFECYCLE TAB */}
            {tab === 'lifecycle' && (
              <motion.div key="lifecycle" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Settings size={18} color={textMute} />
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Lifecycle Management</h2>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: textMute, margin: '0 0 24px' }}>
                    Change the operational state of this site. Invalid API state transitions will be automatically rejected.
                  </p>

                  <div style={{ padding: 20, borderRadius: 12, background: inputBg, border: `1px solid ${inputBorder}` }}>
                    <label style={labelStyle}>Target Status</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <select 
                        value={lifecycleTo} onChange={e => setLifecycleTo(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                      >
                        {LIFECYCLE_OPTIONS.map(o => (
                          <option key={o} value={o}>{o.toUpperCase()}</option>
                        ))}
                      </select>
                      <button type="button" disabled={busy || lifecycleTo === site?.site_status} onClick={handleLifecycle} style={buttonStyle()}>
                        Apply Transition
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}