import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService, AlertItem } from '../../services/api';
import { RefreshCw, XCircle, AlertTriangle, Info, CheckCircle, Search, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

type FilterStatus   = 'all' | 'active' | 'acknowledged' | 'resolved';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

const SEV_CFG = {
  critical: { Icon: XCircle,       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  warning:  { Icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  info:     { Icon: Info,          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};
const STATUS_COLOR: Record<string, string> = {
  active: '#ef4444', acknowledged: '#f59e0b', resolved: '#22c55e',
};

const MobileAlerts: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

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
    active:   alerts.filter(a => !a.resolved && a.status === 'active').length,
    critical: alerts.filter(a => !a.resolved && a.severity === 'critical').length,
    resolved: alerts.filter(a => a.resolved  || a.status === 'resolved').length,
  }), [alerts]);

  const filtered = useMemo(() => {
    setPage(1);
    return alerts.filter(a => {
    const isResolved = a.status === 'resolved' || a.resolved;
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

  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding: '5px 13px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? color+'44' : border}`,
    whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}18` : 'transparent',
    color: active ? color : muted,
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/>
      <span style={{ fontSize:'0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'14px 16px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Alerts</div>
            <div style={{ fontSize:'1.05rem', fontWeight:700, color:'#fff', marginTop:2 }}>
              {counts.active} active
              {counts.critical > 0 && <span style={{ fontSize:'0.8rem', color:'#fca5a5', fontWeight:500 }}> · {counts.critical} critical</span>}
            </div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchAlerts(true); }}
            style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'7px 8px', display:'flex' }}>
            <RefreshCw size={15} style={{ animation:refreshing?'spin 1s linear infinite':'none' }}/>
          </button>
        </div>

        {/* Inline summary bar */}
        <div style={{ display:'flex', gap:8 }}>
          {[
            { label:'Active',   val:counts.active,          color:'#fca5a5', bg:'rgba(239,68,68,0.2)' },
            { label:'Critical', val:counts.critical,        color:'#fca5a5', bg:'rgba(239,68,68,0.3)' },
            { label:'Resolved', val:counts.resolved,        color:'#86efac', bg:'rgba(34,197,94,0.2)' },
            { label:'Total',    val:alerts.length,           color:'rgba(255,255,255,0.85)', bg:'rgba(255,255,255,0.1)' },
          ].map(({ label, val, color, bg:kb }) => (
            <div key={label} style={{ flex:1, background:kb, borderRadius:10, padding:'7px 4px', textAlign:'center', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:'1.1rem', fontWeight:700, color, lineHeight:1 }}>{val}</div>
              <div style={{ fontSize:'0.57rem', color:'rgba(255,255,255,0.55)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky search + filters */}
      <div style={{ position:'sticky', top:0, zIndex:10, background:bg, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8, borderBottom:`1px solid ${border}` }}>
        {/* Search */}
        <div style={{ position:'relative' }}>
          <Search size={14} color={muted} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search message, device, fault code…"
            style={{ width:'100%', background:surface, border:`1px solid ${border}`, borderRadius:9, padding:'8px 10px 8px 32px', fontSize:'0.8rem', color:text, outline:'none', boxSizing:'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:muted, display:'flex', padding:2 }}>
              ×
            </button>
          )}
        </div>

        {/* Status filter */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:1 }}>
          {(['all','active','acknowledged','resolved'] as FilterStatus[]).map(s => (
            <button key={s} style={pill(filterStatus===s, STATUS_COLOR[s]??accent)} onClick={() => setFilterStatus(s)}>
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

      {/* Count */}
      <div style={{ padding:'8px 14px', fontSize:'0.7rem', color:muted }}>
        {filtered.length} alert{filtered.length!==1?'s':''}
          {totalPages > 1 && <span style={{ color: accent }}> · page {page}/{totalPages}</span>}
        {(filterStatus !== 'all' || filterSeverity !== 'all' || search) && (
          <button onClick={() => { setFilterStatus('all'); setFilterSeverity('all'); setSearch(''); }}
            style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:accent, fontSize:'0.7rem', fontWeight:600 }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 20px', gap:10 }}>
          <CheckCircle size={36} color={muted} strokeWidth={1.5}/>
          <div style={{ fontSize:'0.875rem', fontWeight:600, color:text }}>No alerts found</div>
          <div style={{ fontSize:'0.75rem', color:muted }}>Try adjusting your search or filters</div>
        </div>
      )}

      {/* Alert list */}
      <div style={{ padding:'0 12px', display:'flex', flexDirection:'column', gap:6 }}>
        {paginated.map(a => {
          const isResolved = a.status === 'resolved' || a.resolved;
          const cfg = SEV_CFG[a.severity as keyof typeof SEV_CFG] ?? SEV_CFG.info;
          const { Icon } = cfg;
          const statusCol = STATUS_COLOR[a.status ?? ''] ?? cfg.color;
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              style={{ width:'100%', background:surface, border:`1px solid ${border}`, borderRadius:12, padding:'11px 12px', textAlign:'left', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:10, opacity:isResolved?0.6:1, borderLeft:`3px solid ${cfg.color}` }}
            >
              {/* Severity icon */}
              <div style={{ width:32, height:32, borderRadius:9, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <Icon size={15} color={cfg.color}/>
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'0.8rem', fontWeight:600, color:text, lineHeight:1.35, marginBottom:4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>
                  {a.message}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  {a.fault_code && (
                    <span style={{ fontSize:'0.6rem', fontWeight:700, fontFamily:'monospace', padding:'1px 5px', borderRadius:4, background:cfg.bg, color:cfg.color }}>
                      {a.fault_code}
                    </span>
                  )}
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:'0.65rem', fontWeight:700, color:statusCol }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:statusCol, display:'inline-block', flexShrink:0 }}/>
                    {(a.status ?? (isResolved ? 'resolved' : 'active')).toUpperCase()}
                  </span>
                  <span style={{ fontSize:'0.65rem', color:muted }}>Dev {a.device_id}</span>
                  <span style={{ fontSize:'0.65rem', color:muted, display:'flex', alignItems:'center', gap:2, marginLeft:'auto' }}>
                    <Clock size={10}/>{new Date(a.timestamp).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 12px 4px' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 16px', background: page > 1 ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 8, cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? accent : muted, fontSize: '0.75rem', fontWeight: 600 }}>
            Prev
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${p === page ? accent : border}`, background: p === page ? `${accent}22` : 'transparent', cursor: 'pointer', color: p === page ? accent : muted, fontSize: '0.72rem', fontWeight: 700 }}>
                  {p}
                </button>
              );
            })}
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 16px', background: page < totalPages ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 8, cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? accent : muted, fontSize: '0.75rem', fontWeight: 600 }}>
            Next
          </button>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (() => {
        const a = selected;
        const isResolved = a.status === 'resolved' || a.resolved;
        const cfg = SEV_CFG[a.severity as keyof typeof SEV_CFG] ?? SEV_CFG.info;
        const { Icon } = cfg;
        return (
          <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            {/* Backdrop */}
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)' }} onClick={() => setSelected(null)}/>
            {/* Sheet */}
            <div style={{ position:'relative', background:surface, borderRadius:'20px 20px 0 0', padding:'20px 16px 40px', maxHeight:'75dvh', overflowY:'auto' }}>
              {/* Handle */}
              <div style={{ width:36, height:4, borderRadius:2, background:border, margin:'0 auto 16px' }}/>

              {/* Title row */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={20} color={cfg.color}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, color:text, lineHeight:1.4, marginBottom:6 }}>{a.message}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {a.fault_code && (
                      <span style={{ padding:'2px 8px', borderRadius:5, fontSize:'0.65rem', fontWeight:700, fontFamily:'monospace', background:cfg.bg, color:cfg.color }}>
                        {a.fault_code}
                      </span>
                    )}
                    <span style={{ padding:'2px 8px', borderRadius:5, fontSize:'0.65rem', fontWeight:700,
                      background:`${STATUS_COLOR[a.status??'']??cfg.color}18`,
                      color:STATUS_COLOR[a.status??'']??cfg.color }}>
                      {(a.status ?? (isResolved ? 'resolved' : 'active')).toUpperCase()}
                    </span>
                    <span style={{ padding:'2px 8px', borderRadius:5, fontSize:'0.65rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>
                      {(a.severity ?? 'info').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { label:'Alert ID',  value:`#${a.id}` },
                  { label:'Device',    value:String(a.device_id) },
                  ...(a.site_id ? [{ label:'Site', value:a.site_id }] : []),
                  { label:'Triggered', value:new Date(a.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) },
                  ...(a.resolved_at ? [{ label:'Resolved', value:new Date(a.resolved_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:'0.8rem', fontWeight:600, color:sub, wordBreak:'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>

              {isResolved && a.resolved_at && (
                <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:6, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:'10px 12px', fontSize:'0.75rem', color:'#22c55e' }}>
                  <CheckCircle size={14}/> Resolved on {new Date(a.resolved_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                </div>
              )}

              <button onClick={() => setSelected(null)}
                style={{ width:'100%', marginTop:16, padding:'12px', background:`${accent}18`, border:`1px solid ${accent}33`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.85rem', fontWeight:600 }}>
                Done
              </button>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileAlerts;
