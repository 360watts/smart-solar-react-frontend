import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService, AlertItem } from '../../../services/api';
import { RefreshCw, XCircle, AlertTriangle, Info, CheckCircle, Search, Clock, Menu } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import finalLogo from '../../../assets/finalLogo.png';

type FilterStatus   = 'all' | 'active' | 'acknowledged' | 'resolved';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

const SEV_CFG = {
  critical: { Icon: XCircle,       color: '#F87171', bg: 'rgba(248,113,113,0.12)'  },
  warning:  { Icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  info:     { Icon: Info,          color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
};
const STATUS_COLOR: Record<string, string> = {
  active: '#F87171', acknowledged: '#F59E0B', resolved: '#2FBF71',
};

const isResolvedAlert = (alert: AlertItem) => alert.resolved || alert.status === 'resolved';
const isActiveAlert = (alert: AlertItem) => !isResolvedAlert(alert) && (alert.status === 'active' || alert.status == null);

const MobileAlerts: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';

  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterStatus,   setFilterStatus]   = useState<FilterStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [selected, setSelected]     = useState<AlertItem | null>(null);
  const [page,     setPage]         = useState(1);
  const PAGE_SIZE = 20;

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const counts = useMemo(() => ({
    active:   alerts.filter(isActiveAlert).length,
    critical: alerts.filter(a => !isResolvedAlert(a) && a.severity === 'critical').length,
    resolved: alerts.filter(isResolvedAlert).length,
  }), [alerts]);

  const filtered = useMemo(() => {
    setPage(1);
    return alerts.filter(a => {
    const isResolved = isResolvedAlert(a);
    if (filterStatus === 'active'       && (isResolved || a.status === 'acknowledged')) return false;
    if (filterStatus === 'acknowledged' && a.status !== 'acknowledged')                 return false;
    if (filterStatus === 'resolved'     && !isResolved)                                 return false;
    if (filterSeverity !== 'all'        && a.severity !== filterSeverity)               return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.message?.toLowerCase().includes(q) &&
          !String(a.device_id).includes(q) &&
          !a.fault_code?.toLowerCase().includes(q) &&
          !a.site_id?.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  }, [alerts, filterStatus, filterSeverity, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pill = (active: boolean, color = '#2FBF71'): React.CSSProperties => ({
    padding: '5px 13px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? color+'44' : border}`,
    whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}18` : 'transparent',
    color: active ? color : muted,
    fontFamily: "'DM Sans', sans-serif",
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/>
      <span style={{ fontSize:'0.875rem', fontFamily:"'DM Sans', sans-serif" }}>Loading…</span>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:68 }}>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${border}`,
        padding: '12px 16px 12px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)', border: '1px solid rgba(47,191,113,0.18)', boxShadow: '0 2px 8px rgba(47,191,113,0.2)', flexShrink: 0 }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: text, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>360Watts</span>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))} style={{ background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: '1px solid rgba(47,191,113,0.22)', borderRadius: 9, cursor: 'pointer', color: '#2FBF71', padding: '6px', display: 'flex' }}>
            <Menu size={16} />
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:muted, fontFamily:"'DM Sans', sans-serif" }}>Alerts</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:text, marginTop:2, fontFamily:"'Outfit', sans-serif" }}>
              {counts.active} active
              {counts.critical > 0 && <span style={{ fontSize:'0.78rem', color:'#F87171', fontWeight:500, fontFamily:"'DM Sans', sans-serif" }}> · {counts.critical} critical</span>}
            </div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchAlerts(true); }}
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:10, cursor:'pointer', color:muted, padding:'7px', display:'flex' }}>
            <RefreshCw size={15} style={{ animation:refreshing?'spin 1s linear infinite':'none' }}/>
          </button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom: 12 }}>
          {[
            { label:'Active',   val:counts.active,   color:'#F87171' },
            { label:'Critical', val:counts.critical, color:'#F87171' },
            { label:'Resolved', val:counts.resolved, color:'#2FBF71' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ flex:1, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius:12, padding:'8px 4px', textAlign:'center', border:`1px solid ${border}` }}>
              <div style={{ fontSize:'1.1rem', fontWeight:700, color, lineHeight:1, fontFamily:"'JetBrains Mono', monospace" }}>{val}</div>
              <div style={{ fontSize:'0.57rem', color:muted, marginTop:3, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ position:'relative', marginBottom: 10 }}>
          <Search size={14} color={muted} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search message, device, fault code…"
            style={{
              width:'100%', background: surface, backdropFilter: 'blur(16px)',
              border:`1px solid ${border}`, borderRadius:12,
              padding:'9px 10px 9px 34px', fontSize:'0.8rem', color:text,
              outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans', sans-serif",
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:muted, display:'flex', padding:2, fontSize: '1rem', lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>

        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:1 }}>
          {(['all','active','acknowledged','resolved'] as FilterStatus[]).map(s => (
            <button key={s} style={pill(filterStatus===s, STATUS_COLOR[s]??'#2FBF71')} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
          <div style={{ width:1, background:border, flexShrink:0, margin:'0 2px' }}/>
          {(['critical','warning','info'] as FilterSeverity[]).map(s => (
            <button key={s} style={pill(filterSeverity===s, SEV_CFG[s].color)} onClick={() => setFilterSeverity(filterSeverity===s ? 'all' : s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'8px 14px 2px', display:'flex', alignItems:'center', gap:4, fontSize:'0.7rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>
        <span>{filtered.length} alert{filtered.length!==1?'s':''}</span>
        {totalPages > 1 && <span style={{ color: '#2FBF71' }}> · page {page}/{totalPages}</span>}
        {(filterStatus !== 'all' || filterSeverity !== 'all' || search) && (
          <button onClick={() => { setFilterStatus('all'); setFilterSeverity('all'); setSearch(''); }}
            style={{ marginLeft:6, background:'none', border:'none', cursor:'pointer', color:'#2FBF71', fontSize:'0.7rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'64px 20px', gap:12 }}>
          <CheckCircle size={40} color="#2FBF71" strokeWidth={1.5}/>
          <div style={{ fontSize:'1rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>All clear</div>
          <div style={{ fontSize:'0.78rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>
            {search || filterStatus !== 'all' || filterSeverity !== 'all' ? 'Try adjusting your search or filters' : 'No alerts at this time'}
          </div>
        </div>
      )}

      <div style={{ padding:'6px 12px', display:'flex', flexDirection:'column', gap:8 }}>
        {paginated.map(a => {
          const isResolved = a.status === 'resolved' || a.resolved;
          const cfg = SEV_CFG[a.severity as keyof typeof SEV_CFG] ?? SEV_CFG.info;
          const { Icon } = cfg;
          const statusCol = STATUS_COLOR[a.status ?? ''] ?? cfg.color;
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              style={{
                width:'100%',
                background: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                backdropFilter: 'blur(16px)',
                border:`1px solid ${border}`,
                borderRadius:14, padding:0,
                textAlign:'left', cursor:'pointer',
                display:'flex', alignItems:'stretch',
                opacity:isResolved?0.6:1,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: 4, background: cfg.color, flexShrink: 0 }} />
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 12px', flex:1, minWidth:0 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                  <Icon size={15} color={cfg.color}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' }}>
                    {a.fault_code && (
                      <span style={{ fontSize:'0.6rem', fontWeight:700, fontFamily:"'JetBrains Mono', monospace", padding:'2px 7px', borderRadius:999, background:cfg.bg, color:cfg.color, flexShrink:0 }}>
                        {a.fault_code}
                      </span>
                    )}
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:'0.6rem', fontWeight:700, color:statusCol, padding:'2px 7px', borderRadius:999, background:`${statusCol}15`, flexShrink:0, fontFamily:"'DM Sans', sans-serif" }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:statusCol, display:'inline-block' }}/>
                      {(a.status ?? (isResolved ? 'resolved' : 'active')).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize:'0.8rem', fontWeight:600, color:text, lineHeight:1.4, marginBottom:5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, fontFamily:"'DM Sans', sans-serif" }}>
                    {a.message}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.62rem', color:muted, fontFamily:"'JetBrains Mono', monospace" }}>Dev {a.device_id}</span>
                    <span style={{ fontSize:'0.62rem', color:muted, display:'flex', alignItems:'center', gap:2, marginLeft:'auto', fontFamily:"'DM Sans', sans-serif" }}>
                      <Clock size={10}/>{new Date(a.timestamp).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 12px 4px' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 16px', background: page > 1 ? 'rgba(47,191,113,0.12)' : 'transparent', border: `1px solid ${border}`, borderRadius: 999, cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? '#2FBF71' : muted, fontSize: '0.75rem', fontWeight: 600, fontFamily:"'DM Sans', sans-serif" }}>
            Prev
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${p === page ? '#2FBF71' : border}`, background: p === page ? 'rgba(47,191,113,0.15)' : 'transparent', cursor: 'pointer', color: p === page ? '#2FBF71' : muted, fontSize: '0.72rem', fontWeight: 700, fontFamily:"'JetBrains Mono', monospace" }}>
                  {p}
                </button>
              );
            })}
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 16px', background: page < totalPages ? 'rgba(47,191,113,0.12)' : 'transparent', border: `1px solid ${border}`, borderRadius: 999, cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? '#2FBF71' : muted, fontSize: '0.75rem', fontWeight: 600, fontFamily:"'DM Sans', sans-serif" }}>
            Next
          </button>
        </div>
      )}

      {selected && (() => {
        const a = selected;
        const isResolved = a.status === 'resolved' || a.resolved;
        const cfg = SEV_CFG[a.severity as keyof typeof SEV_CFG] ?? SEV_CFG.info;
        const { Icon } = cfg;
        return (
          <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} onClick={() => setSelected(null)}/>
            <div style={{
              position:'relative',
              background: isDark ? 'rgba(12,14,22,0.98)' : '#FFFFFF',
              backdropFilter: 'blur(20px)',
              borderRadius:'20px 20px 0 0',
              borderTop: `1px solid ${border}`,
              padding:'20px 16px 40px',
              maxHeight:'75dvh', overflowY:'auto',
            }}>
              <div style={{ width:36, height:4, borderRadius:2, background:border, margin:'0 auto 18px' }}/>

              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:18 }}>
                <div style={{ width:42, height:42, borderRadius:13, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={20} color={cfg.color}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, color:text, lineHeight:1.4, marginBottom:8, fontFamily:"'DM Sans', sans-serif" }}>{a.message}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {a.fault_code && (
                      <span style={{ padding:'3px 9px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, fontFamily:"'JetBrains Mono', monospace", background:cfg.bg, color:cfg.color }}>
                        {a.fault_code}
                      </span>
                    )}
                    <span style={{ padding:'3px 9px', borderRadius:999, fontSize:'0.65rem', fontWeight:700,
                      background:`${STATUS_COLOR[a.status??'']??cfg.color}18`,
                      color:STATUS_COLOR[a.status??'']??cfg.color, fontFamily:"'DM Sans', sans-serif" }}>
                      {(a.status ?? (isResolved ? 'resolved' : 'active')).toUpperCase()}
                    </span>
                    <span style={{ padding:'3px 9px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:cfg.bg, color:cfg.color, fontFamily:"'DM Sans', sans-serif" }}>
                      {(a.severity ?? 'info').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'Alert ID',  value:`#${a.id}` },
                  { label:'Device',    value:String(a.device_id) },
                  ...(a.site_id ? [{ label:'Site', value:a.site_id }] : []),
                  { label:'Triggered', value:new Date(a.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) },
                  ...(a.resolved_at ? [{ label:'Resolved', value:new Date(a.resolved_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius:12, padding:'10px 12px', border:`1px solid ${border}` }}>
                    <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, color:text, wordBreak:'break-all', fontFamily:"'JetBrains Mono', monospace" }}>{value}</div>
                  </div>
                ))}
              </div>

              {isResolved && a.resolved_at && (
                <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:8, background:'rgba(47,191,113,0.08)', border:'1px solid rgba(47,191,113,0.2)', borderRadius:12, padding:'10px 12px', fontSize:'0.75rem', color:'#2FBF71', fontFamily:"'DM Sans', sans-serif" }}>
                  <CheckCircle size={14}/> Resolved on {new Date(a.resolved_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                </div>
              )}

              <button onClick={() => setSelected(null)}
                style={{ width:'100%', marginTop:16, padding:'13px', background:'rgba(47,191,113,0.1)', border:'1px solid rgba(47,191,113,0.25)', borderRadius:12, cursor:'pointer', color:'#2FBF71', fontSize:'0.85rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
                Done
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MobileAlerts;
