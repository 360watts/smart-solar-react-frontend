import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  RefreshCw, Upload, Cpu, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Clock, Zap,
  Play, RotateCcw, Trash2, X, Shield,
} from 'lucide-react';

interface FirmwareVersion {
  id: number; name: string; version: string; deviceModel: string;
  size: number; checksum: string; signatureValid: boolean;
  releaseNotes: string; status: 'draft'|'stable'; uploadDate: string;
  is_active?: boolean;
}

interface DeviceStatus {
  deviceId: string; currentVersion: string; targetVersion: string;
  activeSlot: 'A'|'B';
  status: 'idle'|'downloading'|'flashing'|'rebooting'|'trial'|'healthy'|'failed'|'rolledback';
  bootCount: number; lastError: string; progress?: number; lastCheckedAt?: string;
}

const STATUS_CFG: Record<string, { color: string; bg: string; Icon: any }> = {
  idle:        { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', Icon: Clock },
  healthy:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   Icon: CheckCircle },
  trial:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  Icon: Shield },
  downloading: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  Icon: RefreshCw },
  flashing:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', Icon: Zap },
  rebooting:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  Icon: RefreshCw },
  failed:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   Icon: XCircle },
  rolledback:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  Icon: RotateCcw },
};

const fmtBytes = (b: number) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;

const MobileOTA: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';
  const inputBg = isDark ? '#0a1628' : '#f8fafc';

  const [tab, setTab]                   = useState<'firmware'|'devices'>('firmware');
  const [firmwares, setFirmwares]       = useState<FirmwareVersion[]>([]);
  const [devices, setDevices]           = useState<DeviceStatus[]>([]);
  const [loadingFW, setLoadingFW]       = useState(true);
  const [loadingDev, setLoadingDev]     = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [expandedFW, setExpandedFW]     = useState<Set<number>>(new Set());
  const [expandedDev, setExpandedDev]   = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all'|string>('all');
  const [fwSearch, setFwSearch]         = useState('');

  // Deploy modal
  const [deployModal, setDeployModal]   = useState(false);
  const [deployFW, setDeployFW]         = useState('');
  const [deployMode, setDeployMode]     = useState<'immediate'|'canary'>('immediate');
  const [autoRollback, setAutoRollback] = useState(true);
  const [deploying, setDeploying]       = useState(false);
  const [deployErr, setDeployErr]       = useState('');

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setLoadingFW(true); setLoadingDev(true); }
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
        setDevices(Array.isArray(dev.value) ? dev.value : []);
      }
    } catch { } finally { setLoadingFW(false); setLoadingDev(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleActivate = async (id: number) => {
    try { await apiService.updateFirmwareVersion(id, { is_active: true }); fetchAll(true); } catch {}
  };
  const handleDelete = async (id: number) => {
    try { await apiService.deleteFirmwareVersion(id); fetchAll(true); } catch {}
  };
  const handleRollback = async (deviceId: string) => {
    try { await apiService.triggerRollback(deviceId, 'Manual rollback from mobile'); fetchAll(true); } catch {}
  };

  const handleDeploy = async () => {
    if (!deployFW) return;
    setDeploying(true); setDeployErr('');
    try {
      await apiService.deployFirmware({
        firmwareVersion: deployFW,
        targetDevices: [],
        mode: deployMode,
        autoRollback,
        healthTimeout: 300,
        failureThreshold: 20,
      });
      setDeployModal(false); fetchAll(true);
    } catch (e: any) { setDeployErr(e?.message ?? 'Deploy failed'); }
    finally { setDeploying(false); }
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });
  const inputStyle: React.CSSProperties = {
    width:'100%', background:inputBg, border:`1px solid ${border}`, borderRadius:8,
    padding:'9px 12px', fontSize:'0.8rem', color:text, outline:'none', boxSizing:'border-box',
  };
  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding:'5px 12px', borderRadius:999, fontSize:'0.7rem', fontWeight:600,
    cursor:'pointer', border:'none', whiteSpace:'nowrap' as const, flexShrink:0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });

  const filteredDevices = devices.filter(d => statusFilter === 'all' || d.status === statusFilter);
  const filteredFW = firmwares.filter(f =>
    !fwSearch || f.version.includes(fwSearch) || f.name.toLowerCase().includes(fwSearch.toLowerCase())
  );

  const counts = {
    healthy:  devices.filter(d => d.status === 'healthy').length,
    failed:   devices.filter(d => d.status === 'failed').length,
    updating: devices.filter(d => ['downloading','flashing','rebooting','trial'].includes(d.status)).length,
  };

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>OTA Firmware</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#fff', marginTop:1 }}>
              {firmwares.length} versions · {devices.length} devices
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setDeployModal(true)}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'6px 10px', display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem', fontWeight:600 }}>
              <Play size={13}/> Deploy
            </button>
            <button onClick={() => { setRefreshing(true); fetchAll(true); }}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'6px 8px', display:'flex' }}>
              <RefreshCw size={15} style={{ animation:refreshing?'spin 1s linear infinite':'none' }}/>
            </button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
          {[
            { label:'Versions', value:firmwares.length,  bg:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.9)' },
            { label:'Healthy',  value:counts.healthy,    bg:'rgba(34,197,94,0.25)',  color:'#86efac' },
            { label:'Updating', value:counts.updating,   bg:'rgba(59,130,246,0.25)', color:'#93c5fd' },
            { label:'Failed',   value:counts.failed,     bg:'rgba(239,68,68,0.25)',  color:'#fca5a5' },
          ].map(({ label, value, bg:kb, color }) => (
            <div key={label} style={{ background:kb, borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize:'1.2rem', fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.6)', marginTop:1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:surface, borderBottom:`1px solid ${border}` }}>
        {(['firmware','devices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex:1, padding:'11px 4px', background:'none', border:'none', cursor:'pointer',
              fontSize:'0.75rem', fontWeight:700, color:tab===t?accent:muted,
              borderBottom:tab===t?`2px solid ${accent}`:'2px solid transparent',
              textTransform:'capitalize' }}>
            {t === 'firmware' ? 'Firmware Versions' : 'Device Status'}
          </button>
        ))}
      </div>

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>

        {/* FIRMWARE TAB */}
        {tab === 'firmware' && (
          <>
            <input value={fwSearch} onChange={e => setFwSearch(e.target.value)} placeholder="Search versions…"
              style={inputStyle}/>
            {loadingFW ? (
              <div style={{ textAlign:'center', padding:'24px', color:muted, fontSize:'0.8rem' }}>Loading…</div>
            ) : filteredFW.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px', color:muted, fontSize:'0.8rem' }}>No firmware versions found.</div>
            ) : filteredFW.map(fw => {
              const isExp = expandedFW.has(fw.id);
              return (
                <div key={fw.id} style={card()}>
                  <button onClick={() => setExpandedFW(prev => { const n=new Set(prev); n.has(fw.id)?n.delete(fw.id):n.add(fw.id); return n; })}
                    style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'12px', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background: fw.status==='stable'?'rgba(34,197,94,0.15)':'rgba(148,163,184,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Upload size={15} color={fw.status==='stable'?'#22c55e':'#94a3b8'}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                        <span style={{ fontSize:'0.85rem', fontWeight:700, color:text, fontFamily:'monospace' }}>v{fw.version}</span>
                        <span style={{ padding:'1px 7px', borderRadius:999, fontSize:'0.6rem', fontWeight:700,
                          background: fw.status==='stable'?'rgba(34,197,94,0.15)':'rgba(148,163,184,0.1)',
                          color: fw.status==='stable'?'#22c55e':'#94a3b8' }}>
                          {fw.status}
                        </span>
                        {fw.is_active && <span style={{ padding:'1px 7px', borderRadius:999, fontSize:'0.6rem', fontWeight:700, background:'rgba(0,166,62,0.15)', color:accent }}>ACTIVE</span>}
                      </div>
                      <div style={{ fontSize:'0.7rem', color:muted }}>{fw.name} · {fw.deviceModel}</div>
                      <div style={{ fontSize:'0.65rem', color:muted, marginTop:1 }}>{fmtBytes(fw.size)} · {new Date(fw.uploadDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                    </div>
                    {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
                  </button>
                  {isExp && (
                    <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div>
                          <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Checksum</div>
                          <div style={{ fontSize:'0.68rem', fontFamily:'monospace', color:sub }}>{fw.checksum?.slice(0,16) ?? '—'}…</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Signature</div>
                          <div style={{ fontSize:'0.72rem', color:fw.signatureValid?'#22c55e':'#ef4444', fontWeight:600 }}>{fw.signatureValid?'Valid':'Invalid'}</div>
                        </div>
                      </div>
                      {fw.releaseNotes && (
                        <div style={{ fontSize:'0.72rem', color:sub, background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:8, padding:'8px 10px' }}>
                          {fw.releaseNotes}
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8 }}>
                        {!fw.is_active && (
                          <button onClick={() => handleActivate(fw.id)}
                            style={{ flex:1, padding:'7px', background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, cursor:'pointer', color:accent, fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                            <CheckCircle size={12}/> Activate
                          </button>
                        )}
                        <button onClick={() => handleDelete(fw.id)}
                          style={{ flex:1, padding:'7px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, cursor:'pointer', color:'#ef4444', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                          <Trash2 size={12}/> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* DEVICES TAB */}
        {tab === 'devices' && (
          <>
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
              {(['all','idle','healthy','trial','downloading','flashing','failed','rolledback'] as const).map(s => (
                <button key={s} style={pill(statusFilter===s, STATUS_CFG[s]?.color ?? accent)} onClick={() => setStatusFilter(s)}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ fontSize:'0.7rem', color:muted }}>{filteredDevices.length} device{filteredDevices.length!==1?'s':''}</div>
            {loadingDev ? (
              <div style={{ textAlign:'center', padding:'24px', color:muted, fontSize:'0.8rem' }}>Loading…</div>
            ) : filteredDevices.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px', color:muted, fontSize:'0.8rem' }}>No devices match filter.</div>
            ) : filteredDevices.map(d => {
              const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.idle;
              const { Icon } = cfg;
              const isExp = expandedDev.has(d.deviceId);
              return (
                <div key={d.deviceId} style={card()}>
                  <button onClick={() => setExpandedDev(prev => { const n=new Set(prev); n.has(d.deviceId)?n.delete(d.deviceId):n.add(d.deviceId); return n; })}
                    style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'12px', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={15} color={cfg.color} style={{ animation:['downloading','flashing','rebooting'].includes(d.status)?'spin 1s linear infinite':'none' }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.82rem', fontWeight:600, color:text, fontFamily:'monospace' }}>{d.deviceId}</div>
                      <div style={{ fontSize:'0.7rem', color:muted }}>
                        v{d.currentVersion} → v{d.targetVersion} · Slot {d.activeSlot}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, display:'inline-block' }}/>
                        <span style={{ fontSize:'0.65rem', fontWeight:700, color:cfg.color, textTransform:'uppercase' }}>{d.status}</span>
                        {d.progress != null && <span style={{ fontSize:'0.65rem', color:muted }}>· {d.progress}%</span>}
                      </div>
                    </div>
                    {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
                  </button>
                  {isExp && (
                    <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
                      {d.progress != null && (
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                            <span style={{ fontSize:'0.65rem', color:muted }}>Progress</span>
                            <span style={{ fontSize:'0.65rem', color:cfg.color, fontWeight:700 }}>{d.progress}%</span>
                          </div>
                          <div style={{ height:5, background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)', borderRadius:99 }}>
                            <div style={{ height:'100%', width:`${d.progress}%`, background:cfg.color, borderRadius:99, transition:'width 300ms' }}/>
                          </div>
                        </div>
                      )}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Boot Count</div><div style={{ fontSize:'0.75rem', color:sub }}>{d.bootCount}</div></div>
                        {d.lastCheckedAt && <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Last Checked</div><div style={{ fontSize:'0.72rem', color:sub }}>{new Date(d.lastCheckedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div></div>}
                      </div>
                      {d.lastError && (
                        <div style={{ display:'flex', alignItems:'flex-start', gap:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 10px' }}>
                          <AlertTriangle size={12} color="#ef4444" style={{ marginTop:1, flexShrink:0 }}/>
                          <span style={{ fontSize:'0.72rem', color:'#ef4444' }}>{d.lastError}</span>
                        </div>
                      )}
                      {['failed','trial'].includes(d.status) && (
                        <button onClick={() => handleRollback(d.deviceId)}
                          style={{ padding:'8px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, cursor:'pointer', color:'#f59e0b', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                          <RotateCcw size={12}/> Rollback
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Deploy modal */}
      {deployModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end' }} onClick={() => setDeployModal(false)}>
          <div style={{ background:surface, borderRadius:'20px 20px 0 0', padding:'20px 16px 32px', width:'100%', maxHeight:'75dvh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color:text }}>Deploy Firmware</div>
              <button onClick={() => setDeployModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:muted }}><X size={18}/></button>
            </div>
            {deployErr && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 12px', fontSize:'0.75rem', color:'#ef4444', marginBottom:12 }}>{deployErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={{ fontSize:'0.7rem', color:muted, marginBottom:4 }}>Firmware Version</div>
                <select value={deployFW} onChange={e => setDeployFW(e.target.value)} style={inputStyle}>
                  <option value="">Select version…</option>
                  {firmwares.map(f => <option key={f.id} value={f.version} style={{ background:isDark?'#0d1829':'#fff', color:text }}>v{f.version} — {f.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'0.7rem', color:muted, marginBottom:6 }}>Deploy Mode</div>
                <div style={{ display:'flex', gap:8 }}>
                  {(['immediate','canary'] as const).map(m => (
                    <button key={m} onClick={() => setDeployMode(m)}
                      style={{ flex:1, padding:'9px', borderRadius:8, border:`1.5px solid ${deployMode===m?accent:border}`, background:deployMode===m?`${accent}18`:'transparent', color:deployMode===m?accent:sub, fontSize:'0.78rem', fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.8rem', color:sub }}>
                <div onClick={() => setAutoRollback(v=>!v)}
                  style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${autoRollback?accent:border}`,background:autoRollback?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {autoRollback && <svg width="11" height="11" viewBox="0 0 11 11"><polyline points="2,5.5 4.5,8 9,3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                Auto-rollback on failure
              </label>
              <button onClick={handleDeploy} disabled={deploying || !deployFW}
                style={{ padding:'11px', background:'linear-gradient(135deg,#004d1e,#006b2b)', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:deploying||!deployFW?0.6:1 }}>
                <Play size={14}/>{deploying?'Deploying…':'Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileOTA;
