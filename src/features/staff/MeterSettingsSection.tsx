/**
 * Meter settings inside the Edit Device modal (EM26 energy meters only).
 *
 * - Telemetry interval: a plain form value; the modal sends it with Save Changes.
 * - Calibration: a one-shot action with its own button and confirm dialog, never part of Save.
 *   The meter samples the live load against the references, so a known load must be on.
 *   Status (pending / confirmed / failed) comes from the backend; while pending we poll.
 * Scenarios: docs/test-scenarios/meter-controls.md
 */
import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../../services/api';
import { ConfirmDialog, useTokens } from './siteHardware/ui';

// Keep in sync with smart-solar-django-backend api/services/em26.py.
export const CAL_V = [100, 300] as const;
export const CAL_I = [0.1, 100] as const;
export const INTERVAL_S = [1, 3600] as const;
const POLL_MS = 10_000;
const POLL_MAX = 30; // 5 minutes, same as the backend's confirmation timeout

export interface MeterFields {
  id: number;
  is_online?: boolean;
  meter_publish_interval_ms?: number | null;
  meter_interval_confirmed_at?: string | null;
  meter_calibration?: { mode?: string; v1?: number; v2?: number; v3?: number; i1?: number; i2?: number; i3?: number;
    requested_at?: string; requested_by?: string } | null;
  meter_calibration_status?: 'pending' | 'confirmed' | 'failed' | null;
  meter_calibration_confirmed_at?: string | null;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const inRange = (x: number, [lo, hi]: readonly [number, number]) => Number.isFinite(x) && x >= lo && x <= hi;

export default function MeterSettingsSection({ device, isDark, intervalMs, onIntervalChange, canCalibrate }: {
  device: MeterFields;
  isDark: boolean;
  intervalMs: number | null | undefined;
  onIntervalChange: (ms: number | null) => void;
  canCalibrate: boolean;
}) {
  const t = useTokens(isDark);
  const [mode, setMode] = useState<'single' | 'three'>('single');
  const [v, setV] = useState(['230', '230', '230']);
  const [i, setI] = useState(['5', '5', '5']);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<MeterFields>(device);
  const polls = useRef(0);

  useEffect(() => { setLive(device); }, [device]);

  // While a calibration is waiting for the meter, re-read the device until it settles.
  useEffect(() => {
    if (live.meter_calibration_status !== 'pending') return;
    polls.current = 0;
    const id = setInterval(async () => {
      polls.current += 1;
      try {
        const d = await apiService.getDevice(live.id);
        if (d && d.meter_calibration_status !== 'pending') setLive(d);
      } catch { /* keep polling; a blip shouldn't end the wait */ }
      if (polls.current >= POLL_MAX) clearInterval(id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live.id, live.meter_calibration_status]);

  const phases = mode === 'single' ? 1 : 3;
  const vNums = v.slice(0, phases).map(Number);
  const iNums = i.slice(0, phases).map(s => (s.trim() === '' ? NaN : Number(s)));  // empty must not count as 0 A
  const calError = !vNums.every(x => inRange(x, CAL_V)) ? `Voltage must be ${CAL_V[0]}–${CAL_V[1]} V`
    : !iNums.every(x => x === 0 || inRange(x, CAL_I)) ? `Current must be 0 (no load) or ${CAL_I[0]}–${CAL_I[1]} A` : null;

  const sendCalibration = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await apiService.calibrateMeter(live.id, { mode, v: vNums, i: iNums });
      if (d) setLive(d);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the calibration');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontFamily: t.head, color: t.ink2, marginBottom: 6 };
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
    border: `1px solid ${t.line}`, background: t.card, color: t.ink, fontFamily: '"Fira Code", monospace', fontSize: 13,
  };
  const chip = (bg: string, ink: string): React.CSSProperties => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: bg, color: ink, fontSize: 12,
  });
  const pick = (on: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12,
    border: `1px solid ${on ? 'var(--brand-green)' : t.line}`,
    background: on ? t.goodBg : 'transparent', color: on ? t.goodInk : t.ink2,
  });

  const seconds = intervalMs == null ? '' : String(intervalMs / 1000);
  const confirmedMs = live.meter_interval_confirmed_at ? live.meter_publish_interval_ms : null;
  const intervalWaiting = intervalMs != null && (intervalMs !== live.meter_publish_interval_ms || !live.meter_interval_confirmed_at);

  const cal = live.meter_calibration;
  const status = live.meter_calibration_status;

  return (
    <section aria-label="Meter settings" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13, fontFamily: t.head, color: t.ink, margin: '0 0 12px', fontWeight: 600 }}>Meter settings</h3>

      {/* Telemetry interval: saved with the rest of the form */}
      <label style={label} htmlFor="meter-interval">How often the meter sends readings (seconds)</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <input id="meter-interval" type="number" min={INTERVAL_S[0]} max={INTERVAL_S[1]} placeholder="5 (meter default)"
          value={seconds} style={{ ...input, width: 140 }}
          onChange={e => onIntervalChange(e.target.value === '' ? null : Math.round(Number(e.target.value) * 1000))} />
        {[5, 10, 60].map(s => (
          <button key={s} type="button" style={pick(intervalMs === s * 1000)} onClick={() => onIntervalChange(s * 1000)}>{s} s</button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: t.ink2, marginBottom: 18 }}>
        {intervalWaiting
          ? <span style={chip(t.waitBg, t.waitInk)}>Waiting for meter after you save</span>
          : confirmedMs != null
            ? <>Meter confirmed {confirmedMs / 1000} s at {fmt(live.meter_interval_confirmed_at)}</>
            : 'Not changed from here yet'}
      </div>

      {/* Calibration: its own action, never part of Save */}
      {canCalibrate && (
        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${t.line}`, background: t.card2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginBottom: 4 }}>Calibration</div>
          <div style={{ fontSize: 12, color: t.ink2, marginBottom: 12 }}>
            Put a known reference load on first. The meter recalibrates as soon as it receives this.
          </div>

          <div role="radiogroup" aria-label="Phases" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['single', 'three'] as const).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} style={pick(mode === m)} onClick={() => setMode(m)}>
                {m === 'single' ? 'Single-phase' : 'Three-phase'}
              </button>
            ))}
          </div>

          {[0, 1, 2].slice(0, phases).map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={label} htmlFor={`cal-v${n + 1}`}>{phases === 1 ? 'Voltage (V)' : `Phase ${'ABC'[n]} voltage (V)`}</label>
                <input id={`cal-v${n + 1}`} type="number" style={input} value={v[n]}
                  onChange={e => setV(prev => prev.map((x, k) => (k === n ? e.target.value : x)))} />
              </div>
              <div>
                <label style={label} htmlFor={`cal-i${n + 1}`}>{phases === 1 ? 'Current (A)' : `Phase ${'ABC'[n]} current (A)`}</label>
                <input id={`cal-i${n + 1}`} type="number" style={input} value={i[n]}
                  onChange={e => setI(prev => prev.map((x, k) => (k === n ? e.target.value : x)))} />
              </div>
            </div>
          ))}

          {calError && <div role="alert" style={{ fontSize: 12, color: t.waitInk, marginBottom: 8 }}>{calError}</div>}
          {error && <div role="alert" style={{ fontSize: 12, color: t.waitInk, marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {live.is_online ? (
              <button type="button" disabled={!!calError || busy || status === 'pending'} onClick={() => setConfirming(true)}
                style={{ padding: '7px 16px', borderRadius: 999, border: 'none', cursor: calError ? 'not-allowed' : 'pointer',
                  background: 'var(--brand-green)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: calError || status === 'pending' ? 0.5 : 1 }}>
                Calibrate meter
              </button>
            ) : (
              <span style={chip(t.idleBg, t.ink2)}>Meter offline: calibration needs it online</span>
            )}
            {status === 'pending' && <span style={chip(t.waitBg, t.waitInk)}>Waiting for meter</span>}
            {status === 'confirmed' && <span style={chip(t.goodBg, t.goodInk)}>Calibrated at {fmt(live.meter_calibration_confirmed_at)}</span>}
            {status === 'failed' && <span style={chip(t.waitBg, t.waitInk)}>Not confirmed: check the meter</span>}
          </div>

          {cal?.requested_at && (
            <div style={{ fontSize: 12, color: t.ink2, marginTop: 10, fontFamily: '"Fira Code", monospace' }}>
              Last: {cal.mode === 'three' ? 'three-phase' : 'single-phase'} · {cal.v1}/{cal.v2}/{cal.v3} V · {cal.i1}/{cal.i2}/{cal.i3} A
              {' '}· {cal.requested_by || 'unknown'} · {fmt(cal.requested_at)}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isDark={isDark}
        open={confirming}
        tone="primary"
        title="Calibrate this meter?"
        body={`The meter will recalibrate straight away against ${mode === 'single' ? 'one phase' : 'all three phases'}. Make sure the reference load is on now.`}
        confirmLabel="Calibrate"
        cancelLabel="Not yet"
        busy={busy}
        onConfirm={sendCalibration}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
