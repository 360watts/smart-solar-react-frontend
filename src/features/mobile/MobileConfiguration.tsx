import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import {
  RefreshCw, Search, X, Settings, CheckCircle, XCircle,
  Clock, Hash, ChevronDown, ChevronUp, Database,
  AlertTriangle, Cpu, Radio,
  Menu,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';

interface Register {
  id?: number; name?: string; address?: number;
  register_type?: string; data_type?: string;
  enabled?: boolean; unit?: string;
}

interface SlaveDevice {
  id: number;
  slaveId?: number; slave_id?: number;
  deviceName?: string; name?: string;
  pollingIntervalMs?: number; polling_interval_ms?: number;
  timeoutMs?: number; timeout_ms?: number;
  enabled?: boolean;
  protocol?: string;
  baud_rate?: number; baudRate?: number;
  parity?: string;
  stop_bits?: number;
  registers?: Register[];
  last_polled_at?: string;
  error_count?: number;
  success_count?: number;
}

const fmtMs = (ms?: number) => {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
};

const fmtLastPolled = (ts?: string) => {
  if (!ts) return null;
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

const MobileConfiguration: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';

  const [slaves,     setSlaves]     = useState<SlaveDevice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<'all' | 'enabled' | 'disabled'>('all');
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());
  const [regsOpen,   setRegsOpen]   = useState<Set<number>>(new Set());
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 10;

  const fetchSlaves = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getGlobalSlaves(undefined, 1, 200);
      setSlaves(Array.isArray(res) ? res : (res?.results ?? []));
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSlaves(); }, [fetchSlaves]);

  const counts = useMemo(() => ({
    total:    slaves.length,
    enabled:  slaves.filter(s => s.enabled !== false).length,
    disabled: slaves.filter(s => s.enabled === false).length,
    totalRegs: slaves.reduce((a, s) => a + (s.registers?.length ?? 0), 0),
    activeRegs: slaves.reduce((a, s) => a + (s.registers?.filter(r => r.enabled !== false).length ?? 0), 0),
  }), [slaves]);

  const filtered = useMemo(() => {
    setPage(1);
    return slaves.filter(s => {
      if (filter === 'enabled'  && s.enabled === false) return false;
      if (filter === 'disabled' && s.enabled !== false) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = (s.deviceName ?? s.name ?? '').toLowerCase();
        const id = String(s.slaveId ?? s.slave_id ?? '');
        return nm.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [slaves, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (set: Set<number>, setFn: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) => {
    setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', ...extra,
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 68 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>Configuration</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: text, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>{counts.total} slaves · {counts.activeRegs} active regs</div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchSlaves(true); }}
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', color: muted, padding: '7px 9px', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Total',    value: counts.total,      color: 'rgba(241,245,249,0.9)', bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            { label: 'Enabled',  value: counts.enabled,    color: '#2FBF71', bg: 'rgba(47,191,113,0.1)' },
            { label: 'Disabled', value: counts.disabled,   color: '#94A3B8', bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            { label: 'Registers',value: counts.totalRegs,  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          ].map(({ label, value, bg: kBg, color }) => (
            <div key={label} style={{ background: kBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: `1px solid ${border}` }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
              <div style={{ fontSize: '0.57rem', color: muted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={card({ padding: '12px 14px' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={14} color={accent} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>Active registers</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: text, fontFamily: "'JetBrains Mono', monospace" }}>{counts.activeRegs} / {counts.totalRegs}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
                <div style={{ height: '100%', borderRadius: 3, background: accent, width: counts.totalRegs > 0 ? `${(counts.activeRegs / counts.totalRegs) * 100}%` : '0%', transition: 'width 0.4s' }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 12, padding: '10px 14px' }}>
          <Search size={14} color={muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or slave ID…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', color: text, fontFamily: "'DM Sans', sans-serif" }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={muted} /></button>}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'enabled', 'disabled'] as const).map(f => {
            const c = f === 'enabled' ? '#2FBF71' : f === 'disabled' ? '#64748b' : accent;
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', flexShrink: 0, background: filter === f ? `${c}18` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), color: filter === f ? c : muted, fontFamily: "'DM Sans', sans-serif" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '0.7rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>
          {filtered.length} slave device{filtered.length !== 1 ? 's' : ''}
          {totalPages > 1 && <span style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}> · page {page}/{totalPages}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card(), padding: '48px 20px', textAlign: 'center' }}>
              <Settings size={28} color={border} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.875rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No slave devices found</div>
            </div>
          ) : paginated.map(slave => {
            const enabled   = slave.enabled !== false;
            const name      = slave.deviceName ?? slave.name ?? `Slave ${slave.slaveId ?? slave.slave_id}`;
            const slaveId   = slave.slaveId ?? slave.slave_id;
            const polling   = slave.pollingIntervalMs ?? slave.polling_interval_ms;
            const timeout   = slave.timeoutMs ?? slave.timeout_ms;
            const baud      = slave.baudRate ?? slave.baud_rate;
            const regs      = slave.registers ?? [];
            const activeR   = regs.filter(r => r.enabled !== false).length;
            const isExp     = expanded.has(slave.id);
            const isRegs    = regsOpen.has(slave.id);
            const lastPolled = fmtLastPolled(slave.last_polled_at);
            const successRate = slave.success_count != null && slave.error_count != null
              ? Math.round((slave.success_count / Math.max(1, slave.success_count + slave.error_count)) * 100) : null;

            return (
              <div key={slave.id} style={{ ...card(), borderLeft: `3px solid ${enabled ? accent : '#64748b'}` }}>
                <button onClick={() => toggle(expanded, setExpanded, slave.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: enabled ? 'rgba(47,191,113,0.1)' : 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${enabled ? 'rgba(47,191,113,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
                    {enabled ? <CheckCircle size={16} color="#2FBF71" /> : <XCircle size={16} color="#64748b" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontFamily: "'DM Sans', sans-serif" }}>{name}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: enabled ? 'rgba(47,191,113,0.12)' : 'rgba(100,116,139,0.12)', color: enabled ? '#2FBF71' : '#64748b', fontFamily: "'DM Sans', sans-serif" }}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {slaveId != null && <div style={{ fontSize: '0.7rem', color: muted, marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Slave ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: text }}>{slaveId}</span></div>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {polling != null && <span style={{ fontSize: '0.68rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>Poll: {fmtMs(polling)}</span>}
                      {regs.length > 0 && <span style={{ fontSize: '0.68rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{activeR}/{regs.length} regs</span>}
                      {lastPolled && <span style={{ fontSize: '0.68rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>Last: {lastPolled}</span>}
                    </div>
                  </div>
                  <div style={{ color: muted, flexShrink: 0 }}>
                    {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {isExp && (
                  <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${border}`, paddingTop: 12 }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {timeout != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Timeout</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: text, marginTop: 2 }}><Clock size={11} color={muted} /><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtMs(timeout)}</span></div>
                        </div>
                      )}
                      {slave.protocol && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Protocol</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: text, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}><Radio size={11} color={muted} />{slave.protocol}</div>
                        </div>
                      )}
                      {baud != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Baud rate</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: text, marginTop: 2 }}><Cpu size={11} color={muted} /><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{baud}</span></div>
                        </div>
                      )}
                      {slave.parity && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Parity</div>
                          <div style={{ fontSize: '0.72rem', color: text, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{slave.parity}</div>
                        </div>
                      )}
                      {slave.stop_bits != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Stop bits</div>
                          <div style={{ fontSize: '0.72rem', color: text, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{slave.stop_bits}</div>
                        </div>
                      )}
                      {successRate != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Poll success</div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", color: successRate < 80 ? '#F87171' : successRate < 95 ? '#F59E0B' : '#2FBF71' }}>{successRate}%</div>
                        </div>
                      )}
                      {slave.error_count != null && slave.error_count > 0 && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>Errors</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#F59E0B', marginTop: 2 }}><AlertTriangle size={11} color="#F59E0B" /><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{slave.error_count}</span></div>
                        </div>
                      )}
                    </div>

                    {regs.length > 0 && (
                      <>
                        <button onClick={() => toggle(regsOpen, setRegsOpen, slave.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', cursor: 'pointer', marginBottom: isRegs ? 8 : 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 600, color: muted, fontFamily: "'DM Sans', sans-serif" }}>
                            <Database size={12} color={muted} />Registers ({activeR}/{regs.length} active)
                          </span>
                          {isRegs ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                        </button>

                        {isRegs && (
                          <div style={{ borderRadius: 10, border: `1px solid ${border}`, overflow: 'hidden', background: isDark ? 'rgba(0,0,0,0.3)' : '#F8FAFC' }}>
                            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                              {regs.map((reg, i) => {
                                const regEnabled = reg.enabled !== false;
                                return (
                                  <div key={reg.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderTop: i === 0 ? 'none' : `1px solid ${border}`, opacity: regEnabled ? 1 : 0.5 }}>
                                    <Hash size={11} color={muted} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{reg.name ?? `Register ${i + 1}`}</div>
                                      <div style={{ fontSize: '0.6rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>
                                        {reg.address != null && `0x${reg.address.toString(16).toUpperCase().padStart(4, '0')}`}
                                        {reg.data_type && ` · ${reg.data_type}`}
                                        {reg.unit && ` · ${reg.unit}`}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: regEnabled ? '#2FBF71' : '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>{regEnabled ? 'ON' : 'OFF'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0 4px' }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 16px', background: page > 1 ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 999, cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? accent : muted, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              Prev
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${p === page ? accent : border}`, background: p === page ? `${accent}18` : 'transparent', cursor: 'pointer', color: p === page ? accent : muted, fontSize: '0.72rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  {p}
                </button>
              ))}
            </div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 16px', background: page < totalPages ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 999, cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? accent : muted, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              Next
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MobileConfiguration;
