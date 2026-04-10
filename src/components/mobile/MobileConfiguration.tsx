import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { RefreshCw, Search, X, Settings, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface SlaveDevice {
  id: number;
  slaveId?: number;
  slave_id?: number;
  deviceName?: string;
  name?: string;
  pollingIntervalMs?: number;
  polling_interval_ms?: number;
  timeoutMs?: number;
  timeout_ms?: number;
  enabled?: boolean;
  registers?: { enabled?: boolean }[];
}

const MobileConfiguration: React.FC = () => {
  const { isDark } = useTheme();

  const bg       = isDark ? '#020617' : '#f0fdf4';
  const surface  = isDark ? '#0f172a' : '#ffffff';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';

  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSlaves = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getGlobalSlaves(undefined, 1, 100);
      setSlaves(Array.isArray(res) ? res : (res?.results ?? []));
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSlaves(); }, [fetchSlaves]);

  const filtered = slaves.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (s.deviceName ?? s.name ?? '').toLowerCase();
    const id = String(s.slaveId ?? s.slave_id ?? '');
    return name.includes(q) || id.includes(q);
  });

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });

  const fmtMs = (ms?: number) => {
    if (ms == null) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: textMute }}>
        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.875rem' }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: textMain }}>Configuration</div>
          <div style={{ fontSize: '0.72rem', color: textMute, marginTop: 2 }}>
            {slaves.length} slave device{slaves.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={() => { setRefreshing(true); fetchSlaves(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMute, display: 'flex', padding: 8 }}>
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ padding: '12px 12px 0' }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total',    value: slaves.length,                                    color: textMain  },
            { label: 'Enabled',  value: slaves.filter(s => s.enabled !== false).length,  color: '#10b981' },
            { label: 'Disabled', value: slaves.filter(s => s.enabled === false).length,  color: '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={card({ padding: '10px 8px', textAlign: 'center' })}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: textMute, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={14} color={textMute} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or slave ID…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: textMain }}
          />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={textMute} /></button>}
        </div>

        {/* Slave list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={card({ padding: '40px 20px', textAlign: 'center' })}>
              <div style={{ fontSize: '0.875rem', color: textMute }}>No slave devices found</div>
            </div>
          ) : filtered.map(slave => {
            const enabled    = slave.enabled !== false;
            const name       = slave.deviceName ?? slave.name ?? `Slave ${slave.slaveId ?? slave.slave_id}`;
            const slaveId    = slave.slaveId ?? slave.slave_id;
            const polling    = slave.pollingIntervalMs ?? slave.polling_interval_ms;
            const timeout    = slave.timeoutMs ?? slave.timeout_ms;
            const regs       = slave.registers ?? [];
            const activeRegs = regs.filter(r => r.enabled !== false).length;

            return (
              <div key={slave.id} style={card({ padding: '14px' })}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {slaveId != null && <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 2 }}>Slave ID: {slaveId}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, flexShrink: 0, background: enabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', border: `1px solid ${enabled ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}` }}>
                    {enabled ? <CheckCircle size={11} color="#10b981" /> : <XCircle size={11} color="#64748b" />}
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: enabled ? '#10b981' : '#64748b' }}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {polling != null && (
                    <div style={{ fontSize: '0.7rem' }}>
                      <span style={{ color: textMute }}>Poll </span>
                      <span style={{ color: textSub, fontWeight: 500 }}>{fmtMs(polling)}</span>
                    </div>
                  )}
                  {timeout != null && (
                    <div style={{ fontSize: '0.7rem' }}>
                      <span style={{ color: textMute }}>Timeout </span>
                      <span style={{ color: textSub, fontWeight: 500 }}>{fmtMs(timeout)}</span>
                    </div>
                  )}
                  {regs.length > 0 && (
                    <div style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Settings size={11} color={textMute} />
                      <span style={{ color: textSub, fontWeight: 500 }}>{activeRegs}/{regs.length} registers</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileConfiguration;
