import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  CheckCircle2, ChevronRight, Server, Wifi, Check, 
  ArrowRight, AlertTriangle, Loader2, Compass, LayoutDashboard
} from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import PageHeader from './PageHeader';

// ── Components & Animations ──────────────────────────────────────────────────

const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const slideVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

export default function CommissioningWizard() {
  const { isDark } = useTheme();

  // ── State ──
  const [step, setStep] = useState(1);
  const [siteId, setSiteId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerUsers, setOwnerUsers] = useState<Array<{
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  }>>([]);
  const [displayName, setDisplayName] = useState('');
  const [latitude, setLatitude] = useState('11.0');
  const [longitude, setLongitude] = useState('77.0');
  const [capacityKw, setCapacityKw] = useState('');
  const [inverterCapacityKw, setInverterCapacityKw] = useState('');
  const [tiltDeg, setTiltDeg] = useState('');
  const [azimuthDeg, setAzimuthDeg] = useState('');
  const [timezoneValue, setTimezoneValue] = useState('');
  const [loggerSerial, setLoggerSerial] = useState('');
  const [dataLoggerSerial, setDataLoggerSerial] = useState('');
  const [devicePk, setDevicePk] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null);
  const [usersBusy, setUsersBusy] = useState(false);
  const [idBusy, setIdBusy] = useState(false);

  // ── Tokens ──
  const bg          = isDark ? '#020617' : '#f0fdf4';
  const surface     = isDark ? '#0f172a' : '#ffffff';
  const border      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';
  const textMain    = isDark ? '#f1f5f9' : '#0f172a';
  const textMute    = isDark ? '#64748b' : '#94a3b8';
  const textSub     = isDark ? '#94a3b8' : '#475569';
  const primary     = '#00a63e';
  const nativeSelectBg = isDark ? '#0f172a' : '#ffffff';
  const nativeSelectFg = isDark ? '#e2e8f0' : '#0f172a';

  // ── Shared Styles ──
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${inputBorder}`, background: inputBg, color: textMain,
    fontSize: '0.85rem', outline: 'none', transition: 'border-color 150ms',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', 
    letterSpacing: '0.05em', color: textMute, display: 'flex', alignItems: 'center', gap: 6
  };

  const buttonStyle = (isSecondary = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    background: isSecondary 
      ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') 
      : primary,
    color: isSecondary ? textMain : '#fff',
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms', opacity: busy ? 0.7 : 1,
    boxShadow: isSecondary ? 'none' : '0 4px 12px rgba(0,166,62,0.25)'
  });

  const fetchNextSiteId = async () => {
    setIdBusy(true);
    try {
      const res = await apiService.getNextSiteId();
      setSiteId(res.site_id);
    } catch { /* leave field as-is */ } finally {
      setIdBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setUsersBusy(true);
      setIdBusy(true);
      try {
        const [usersResp, idResp] = await Promise.all([
          apiService.getUsers(),
          apiService.getNextSiteId(),
        ]);
        if (!mounted) return;
        const users = Array.isArray(usersResp?.results) ? usersResp.results : Array.isArray(usersResp) ? usersResp : [];
        setOwnerUsers(users);
        setSiteId(idResp.site_id);
      } catch {
        if (mounted) setOwnerUsers([]);
      } finally {
        if (mounted) { setUsersBusy(false); setIdBusy(false); }
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const filteredOwnerUsers = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return ownerUsers.slice(0, 20);
    return ownerUsers
      .filter((u) => {
        const full = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return (
          String(u.id).includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          full.includes(q)
        );
      })
      .slice(0, 20);
  }, [ownerUsers, ownerSearch]);

  const selectedOwner = useMemo(
    () => ownerUsers.find((u) => String(u.id) === ownerUserId) || null,
    [ownerUsers, ownerUserId]
  );

  // ── Logic ──
  const step1 = async () => {
    setBusy(true); setError(null);
    try {
      const owner = parseInt(ownerUserId, 10);
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const cap = capacityKw.trim() === '' ? undefined : parseFloat(capacityKw);
      const invCap = inverterCapacityKw.trim() === '' ? undefined : parseFloat(inverterCapacityKw);
      const tilt = tiltDeg.trim() === '' ? undefined : parseFloat(tiltDeg);
      const azimuth = azimuthDeg.trim() === '' ? undefined : parseFloat(azimuthDeg);
      const logger = loggerSerial.trim() === '' ? undefined : parseInt(loggerSerial, 10);
      const dataLogger = dataLoggerSerial.trim() === '' ? undefined : dataLoggerSerial.trim();

      if (!siteId.trim() || !owner || Number.isNaN(owner)) throw new Error('Site ID and Owner User ID are required');
      if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error('Invalid coordinates');
      if (cap !== undefined && Number.isNaN(cap)) throw new Error('Invalid capacity');
      if (invCap !== undefined && Number.isNaN(invCap)) throw new Error('Invalid inverter capacity');
      if (tilt !== undefined && Number.isNaN(tilt)) throw new Error('Invalid tilt angle');
      if (azimuth !== undefined && Number.isNaN(azimuth)) throw new Error('Invalid azimuth angle');
      if (logger !== undefined && Number.isNaN(logger)) throw new Error('Invalid logger serial');

      const payload: Record<string, unknown> = {
        site_id: siteId.trim(), owner_user_id: owner, display_name: displayName.trim(),
        latitude: lat, longitude: lon,
      };
      if (cap !== undefined) payload.capacity_kw = cap;
      if (invCap !== undefined) payload.inverter_capacity_kw = invCap;
      if (tilt !== undefined) payload.tilt_deg = tilt;
      if (azimuth !== undefined) payload.azimuth_deg = azimuth;
      if (timezoneValue.trim()) payload.timezone = timezoneValue.trim();
      if (logger !== undefined) payload.deye_station_id = logger;
      if (dataLogger !== undefined) payload.logger_serial = dataLogger;

      const res = await apiService.createSiteStaff(payload);
      
      setCreatedSiteId(res.site_id);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create site');
    } finally {
      setBusy(false);
    }
  };

  const step2 = async () => {
    const sid = createdSiteId || siteId.trim();
    const pk = parseInt(devicePk, 10);
    
    if (!sid || !pk || Number.isNaN(pk)) {
      setError('A valid numeric Device ID is required');
      return;
    }
    
    setBusy(true); setError(null);
    try {
      await apiService.siteAttachDevice(sid, pk);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to attach gateway');
    } finally {
      setBusy(false);
    }
  };

  const sid = createdSiteId || siteId.trim();

  // ── Render Helpers ──
  const renderStepper = () => {
    const steps = [
      { num: 1, label: 'Create Site', icon: <Server size={14} /> },
      { num: 2, label: 'Assign Gateway', icon: <Wifi size={14} /> },
      { num: 3, label: 'Complete', icon: <CheckCircle2 size={14} /> }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, maxWidth: 600, margin: '0 auto 32px' }}>
        {steps.map((s, i) => {
          const isActive = step === s.num;
          const isPast = step > s.num;
          const color = isActive || isPast ? primary : textMute;
          const bg = isActive || isPast ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.1)') : inputBg;

          return (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 80 }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bg, color: color, border: `1px solid ${isActive || isPast ? primary : inputBorder}`,
                  transition: 'all 300ms', boxShadow: isActive ? '0 0 0 4px rgba(0,166,62,0.1)' : 'none'
                }}>
                  {isPast ? <Check size={16} /> : s.icon}
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isActive ? textMain : textMute, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > i + 1 ? primary : border, margin: '0 8px 20px', transition: 'background 300ms' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 60 }}>
      <PageHeader
        icon={<LayoutDashboard size={20} color="white" />}
        title="Commissioning Wizard"
        subtitle="Configure site details and attach gateway"
        rightSlot={
          <Link to="/sites" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}`,
              color: textMain, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
            }}>
               Cancel
            </button>
          </Link>
        }
      />

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 800, margin: '40px auto 0', padding: '0 24px' }}>
        
        {/* Header Text */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: textMain, margin: '0 0 8px' }}>
            {step === 1 ? 'Configure Site Details' : step === 2 ? 'Establish Connectivity' : 'Commissioning Complete'}
          </h2>
          <p style={{ fontSize: '0.9rem', color: textSub, margin: 0 }}>
            {step === 1 ? 'Establish the core record for this installation before assigning equipment.' : 
             step === 2 ? 'Link a physical gateway device to enable telemetry and monitoring.' : 
             'The site and gateway are linked. You can now provision specific hardware.'}
          </p>
        </div>

        {renderStepper()}

        {/* Form Container */}
        <div style={{ 
          background: surface, border: `1px solid ${border}`, borderRadius: 16, 
          padding: 32, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,166,62,0.04)',
          maxWidth: 500, margin: '0 auto', position: 'relative', overflow: 'hidden'
        }}>
          
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 24,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 500
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: MOTION_EASE }}>
                
                <div style={{ display: 'grid', gap: 20 }}>
                  <div>
                    <label style={labelStyle}><Server size={12} /> Site ID</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', marginTop: 6,
                      border: `1px solid ${inputBorder}`, borderRadius: 8,
                      background: inputBg, overflow: 'hidden',
                    }}>
                      <input
                        value={siteId}
                        onChange={e => setSiteId(e.target.value)}
                        style={{ flex: 1, padding: '10px 14px', border: 'none', background: 'transparent', color: textMain, fontSize: '0.85rem', outline: 'none' }}
                        placeholder={idBusy ? 'Generating…' : 'e.g., SS-00001'}
                        disabled={idBusy}
                      />
                      <button
                        type="button"
                        onClick={fetchNextSiteId}
                        disabled={idBusy || busy}
                        title="Generate new ID"
                        style={{
                          padding: '0 12px', height: '100%', border: 'none',
                          borderLeft: `1px solid ${inputBorder}`,
                          background: 'transparent', color: textSub,
                          cursor: idBusy ? 'not-allowed' : 'pointer',
                          fontSize: '1rem', opacity: idBusy ? 0.4 : 1,
                          transition: 'opacity 150ms',
                        }}
                      >↻</button>
                    </div>
                  </div>
                  
                  <div>
                    <label style={labelStyle}>Display Name</label>
                    <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g., North Roof Array" />
                  </div>

                  <div>
                    <label style={labelStyle}>Owner User (required)</label>
                    <input
                      value={ownerSearch}
                      onChange={e => setOwnerSearch(e.target.value)}
                      style={{ ...inputStyle, marginTop: 6 }}
                      placeholder={usersBusy ? 'Loading users...' : 'Search by ID, username, email'}
                    />
                    <select
                      value={ownerUserId}
                      onChange={(e) => setOwnerUserId(e.target.value)}
                      style={{
                        ...inputStyle,
                        marginTop: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Select owner user</option>
                      {filteredOwnerUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.id} - {u.username}{u.first_name || u.last_name ? ` (${`${u.first_name || ''} ${u.last_name || ''}`.trim()})` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedOwner && (
                      <div style={{ marginTop: 8, fontSize: '0.75rem', color: textSub }}>
                        Selected owner: <strong style={{ color: textMain }}>{selectedOwner.username}</strong>
                        {selectedOwner.email ? ` (${selectedOwner.email})` : ''}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelStyle}><Compass size={12} /> Latitude</label>
                      <input value={latitude} onChange={e => setLatitude(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input value={longitude} onChange={e => setLongitude(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Capacity (kW) <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>— optional</span></label>
                    <input value={capacityKw} onChange={e => setCapacityKw(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. 5.5 (can be set later)" />
                  </div>

                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
                    <div style={{ fontSize: '0.72rem', color: textMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, fontWeight: 700 }}>
                      Optional commissioning details (editable later)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={labelStyle}>Inverter Capacity (kW)</label>
                        <input value={inverterCapacityKw} onChange={e => setInverterCapacityKw(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g., 8" />
                      </div>
                      <div>
                        <label style={labelStyle}>Deye Station ID</label>
                        <input value={loggerSerial} onChange={e => setLoggerSerial(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. 12616 (from Deye Cloud portal)" />
                      </div>
                      <div>
                        <label style={labelStyle}>Logger Serial</label>
                        <input value={dataLoggerSerial} onChange={e => setDataLoggerSerial(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. 2509273375 (SolarmanV5/LSW3 dongle)" />
                      </div>
                      <div>
                        <label style={labelStyle}>Tilt (deg)</label>
                        <input value={tiltDeg} onChange={e => setTiltDeg(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g., 18" />
                      </div>
                      <div>
                        <label style={labelStyle}>Azimuth (deg)</label>
                        <input value={azimuthDeg} onChange={e => setAzimuthDeg(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g., 180" />
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <label style={labelStyle}>Timezone</label>
                      <input value={timezoneValue} onChange={e => setTimezoneValue(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g., Asia/Kolkata" />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 32 }}>
                  <button type="button" disabled={busy} onClick={step1} style={buttonStyle()}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create Site Record'}
                    {!busy && <ArrowRight size={16} />}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: MOTION_EASE }}>
                
                <div style={{ padding: '16px 20px', borderRadius: 10, background: inputBg, border: `1px solid ${inputBorder}`, marginBottom: 24 }}>
                  <div style={{ fontSize: '0.75rem', color: textMute, marginBottom: 4 }}>Target Site</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Server size={14} color={primary} /> {sid}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}><Wifi size={12} /> Device Primary Key (Gateway ID)</label>
                  <p style={{ fontSize: '0.75rem', color: textSub, margin: '6px 0 12px' }}>
                    Enter the numeric ID of the gateway device. This device must be owned by the same user assigned to the site.
                  </p>
                  <input type="number" value={devicePk} onChange={e => setDevicePk(e.target.value)} style={inputStyle} placeholder="e.g., 402" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
                  <button type="button" disabled={busy} onClick={step2} style={buttonStyle()}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : 'Attach Gateway'}
                    {!busy && <ArrowRight size={16} />}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setStep(3)} style={buttonStyle(true)}>
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: MOTION_EASE }} style={{ textAlign: 'center' }}>
                
                <div style={{ 
                  width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,166,62,0.1)', border: '1px solid rgba(0,166,62,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: primary
                }}>
                  <CheckCircle2 size={32} />
                </div>
                
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: textMain, margin: '0 0 8px' }}>Site Provisioned</h3>
                <p style={{ fontSize: '0.85rem', color: textMute, margin: '0 0 32px', lineHeight: 1.5 }}>
                  The foundational setup for <strong>{sid}</strong> is complete. You can now proceed to map physical hardware to this location.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Link to={`/equipment?site=${encodeURIComponent(sid)}`} style={{ textDecoration: 'none' }}>
                    <button style={buttonStyle()}>Provision Equipment <ArrowRight size={16} /></button>
                  </Link>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Link to={`/sites/${encodeURIComponent(sid)}`} style={{ textDecoration: 'none' }}>
                      <button style={buttonStyle(true)}>View Details</button>
                    </Link>
                    <Link to="/sites" style={{ textDecoration: 'none' }}>
                      <button style={buttonStyle(true)}>All Sites</button>
                    </Link>
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