import { useMemo, useState } from 'react';
import { Radar, Lock, Check, RefreshCw, Zap, AlertCircle } from 'lucide-react';
import { useTokens } from './ui';

export interface TuyaCloudDevice {
  id: string;
  name: string;
  product_name?: string;
  category?: string;
  online?: boolean;
  already_registered: boolean;
}

// Tuya category codes that expose power / energy readings.
const CAN_METER = new Set(['cz', 'pc', 'aqcz', 'zncz']);

interface Props {
  isDark: boolean;
  devices: TuyaCloudDevice[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  onScan: () => void;
  onPick: (d: TuyaCloudDevice) => void;
}

export default function FoundPlugs({
  isDark, devices, loading, error, selectedId, onScan, onPick,
}: Props) {
  const t = useTokens(isDark);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtered = n
      ? devices.filter(d => (d.name || '').toLowerCase().includes(n) || (d.id || '').toLowerCase().includes(n))
      : devices;
    return [...filtered].sort((a, b) =>
      (a.already_registered ? 1 : 0) - (b.already_registered ? 1 : 0) ||
      (b.online ? 1 : 0) - (a.online ? 1 : 0));
  }, [devices, q]);

  const available = devices.filter(d => !d.already_registered).length;

  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: 13, overflow: 'hidden' }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
        borderBottom: devices.length || error ? `1px solid ${t.line2}` : 'none', background: t.card2,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: t.goodBg, color: t.goodInk,
        }}>
          <Radar size={15} style={loading ? { animation: 'fs-spin 2s linear infinite' } : undefined} />
        </span>
        <span style={{ flex: 1, fontSize: '0.85rem', color: t.ink2 }}>
          {loading ? 'Looking for plugs…'
            : error ? "Couldn't reach the plugs"
            : devices.length ? <>Found <b style={{ color: t.ink }}>{devices.length} {devices.length === 1 ? 'plug' : 'plugs'}</b> · {available} not added yet</>
            : 'Not looked yet'}
        </span>
        <button
          type="button" onClick={onScan} disabled={loading}
          style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 9, cursor: loading ? 'wait' : 'pointer',
            border: `1px solid ${t.line}`, background: t.card, color: t.ink,
            fontFamily: t.body, fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          {loading ? <RefreshCw size={12} style={{ animation: 'fs-spin 1s linear infinite' }} /> : devices.length ? 'Look again' : 'Look for plugs'}
        </button>
      </div>

      {error && !loading && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '11px 13px', fontSize: '0.82rem', color: t.waitInk }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error} — check the plugs are online in the Smart Life app, then try again.</span>
        </div>
      )}

      {devices.length > 6 && (
        <div style={{ padding: '10px 13px', borderBottom: `1px solid ${t.line2}` }}>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…"
            style={{ width: '100%', padding: '7px 11px', borderRadius: 9, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink, fontFamily: t.body, fontSize: '0.83rem', outline: 'none' }}
          />
        </div>
      )}

      {list.length > 0 && (
        <div style={{ maxHeight: 268, overflowY: 'auto' }}>
          {list.map((d, i) => {
            const selected = selectedId === d.id;
            const meters = CAN_METER.has(d.category || '');
            const disabled = d.already_registered;
            return (
              <button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(d)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 11, textAlign: 'left',
                  padding: '12px 13px', border: 'none',
                  borderTop: i === 0 ? 'none' : `1px solid ${t.line2}`,
                  background: selected ? t.goodBg : 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: 999, flexShrink: 0,
                  background: d.online ? t.good : t.ink2,
                  boxShadow: d.online ? `0 0 0 3px ${t.goodBg}` : 'none',
                }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{d.name || 'Unnamed plug'}</span>
                    {meters && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: '0.72rem', fontWeight: 600, color: t.goodInk, background: t.goodBg,
                        borderRadius: 999, padding: '1px 8px',
                      }}>
                        <Zap size={10} /> measures power
                      </span>
                    )}
                    {disabled && <span style={{ fontSize: '0.78rem', color: t.ink2 }}>Already added</span>}
                  </span>
                  <span style={{ display: 'block', marginTop: 1, fontSize: '0.78rem', color: t.ink2 }}>
                    {d.online ? 'On' : 'Offline right now'}
                  </span>
                </span>
                {disabled ? (
                  <Lock size={14} style={{ color: t.ink2, flexShrink: 0 }} />
                ) : selected ? (
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: t.good, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div style={{ padding: '18px 14px', fontSize: '0.83rem', color: t.ink2, textAlign: 'center' }}>
          Press <b>Look for plugs</b> to find the smart plugs connected to this site.
        </div>
      )}
    </div>
  );
}
