import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import {
  RefreshCw, Search, X, Settings, CheckCircle, XCircle,
  Clock, Hash, ChevronDown, ChevronUp, Database,
  AlertTriangle, Cpu, Radio,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

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
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });

  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #004d1e, #006b2b)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configuration</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>{counts.total} slaves · {counts.activeRegs} active registers</div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchSlaves(true); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '6px 8px', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Total',    value: counts.total,      bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' },
            { label: 'Enabled',  value: counts.enabled,    bg: 'rgba(34,197,94,0.25)',  color: '#86efac' },
            { label: 'Disabled', value: counts.disabled,   bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
            { label: 'Registers',value: counts.totalRegs,  bg: 'rgba(59,130,246,0.2)',  color: '#93c5fd' },
          ].map(({ label, value, bg: kBg, color }) => (
            <div key={label} style={{ background: kBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Register health */}
        <div style={card({ padding: '10px 14px' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={14} color={accent} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.7rem', color: sub }}>Active registers</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: text }}>{counts.activeRegs} / {counts.totalRegs}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                <div style={{ height: '100%', borderRadius: 2, background: accent, width: counts.totalRegs > 0 ? `${(counts.activeRegs / counts.totalRegs) * 100}%` : '0%', transition: 'width 0.4s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={14} color={muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or slave ID…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: text }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={muted} /></button>}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button key={f} style={pill(filter === f, f === 'enabled' ? '#22c55e' : f === 'disabled' ? '#64748b' : accent)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', color: muted }}>
          {filtered.length} slave device{filtered.length !== 1 ? 's' : ''}
          {totalPages > 1 && <span style={{ color: accent }}> · page {page}/{totalPages}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card(), padding: '40px 20px', textAlign: 'center' }}>
              <Settings size={28} color={border} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.875rem', color: muted }}>No slave devices found</div>
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
              <div key={slave.id} style={card()}>
                <button onClick={() => toggle(expanded, setExpanded, slave.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: enabled ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${enabled ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
                    {enabled ? <CheckCircle size={16} color="#22c55e" /> : <XCircle size={16} color="#64748b" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: enabled ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: enabled ? '#22c55e' : '#64748b' }}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {slaveId != null && <div style={{ fontSize: '0.7rem', color: muted, marginBottom: 3 }}>Slave ID: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: sub }}>{slaveId}</span></div>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {polling != null && <span style={{ fontSize: '0.68rem', color: sub }}>Poll: {fmtMs(polling)}</span>}
                      {regs.length > 0 && <span style={{ fontSize: '0.68rem', color: sub }}>{activeR}/{regs.length} regs</span>}
                      {lastPolled && <span style={{ fontSize: '0.68rem', color: muted }}>Last: {lastPolled}</span>}
                    </div>
                  </div>
                  <div style={{ color: muted, flexShrink: 0 }}>
                    {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {isExp && (
                  <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${border}`, paddingTop: 10 }}>

                    {/* Detail grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {timeout != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Timeout</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Clock size={11} color={muted} />{fmtMs(timeout)}</div>
                        </div>
                      )}
                      {slave.protocol && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protocol</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Radio size={11} color={muted} />{slave.protocol}</div>
                        </div>
                      )}
                      {baud != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Baud rate</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Cpu size={11} color={muted} />{baud}</div>
                        </div>
                      )}
                      {slave.parity && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Parity</div>
                          <div style={{ fontSize: '0.72rem', color: sub }}>{slave.parity}</div>
                        </div>
                      )}
                      {slave.stop_bits != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stop bits</div>
                          <div style={{ fontSize: '0.72rem', color: sub }}>{slave.stop_bits}</div>
                        </div>
                      )}
                      {successRate != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Poll success</div>
                          <div style={{ fontSize: '0.72rem', color: successRate < 80 ? '#ef4444' : successRate < 95 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>{successRate}%</div>
                        </div>
                      )}
                      {slave.error_count != null && slave.error_count > 0 && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Errors</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#f59e0b' }}><AlertTriangle size={11} color="#f59e0b" />{slave.error_count}</div>
                        </div>
                      )}
                    </div>

                    {/* Registers */}
                    {regs.length > 0 && (
                      <>
                        <button onClick={() => toggle(regsOpen, setRegsOpen, slave.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', cursor: 'pointer', marginBottom: isRegs ? 8 : 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 600, color: muted }}>
                            <Database size={12} color={muted} />Registers ({activeR}/{regs.length} active)
                          </span>
                          {isRegs ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                        </button>

                        {isRegs && (
                          <div style={{ borderRadius: 8, border: `1px solid ${border}`, overflow: 'hidden', background: isDark ? '#050b14' : '#f8fafc' }}>
                            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                              {regs.map((reg, i) => {
                                const regEnabled = reg.enabled !== false;
                                return (
                                  <div key={reg.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: i === 0 ? 'none' : `1px solid ${border}`, opacity: regEnabled ? 1 : 0.5 }}>
                                    <Hash size={11} color={muted} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reg.name ?? `Register ${i + 1}`}</div>
                                      <div style={{ fontSize: '0.6rem', color: muted }}>
                                        {reg.address != null && `0x${reg.address.toString(16).toUpperCase().padStart(4, '0')}`}
                                        {reg.data_type && ` · ${reg.data_type}`}
                                        {reg.unit && ` · ${reg.unit}`}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: regEnabled ? '#22c55e' : '#64748b' }}>{regEnabled ? 'ON' : 'OFF'}</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0 4px' }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 16px', background: page > 1 ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 8, cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? accent : muted, fontSize: '0.75rem', fontWeight: 600 }}>
              Prev
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${p === page ? accent : border}`, background: p === page ? `${accent}22` : 'transparent', cursor: 'pointer', color: p === page ? accent : muted, fontSize: '0.72rem', fontWeight: 700 }}>
                  {p}
                </button>
              ))}
            </div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 16px', background: page < totalPages ? `${accent}18` : 'transparent', border: `1px solid ${border}`, borderRadius: 8, cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? accent : muted, fontSize: '0.75rem', fontWeight: 600 }}>
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
