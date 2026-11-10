import React, { useState } from 'react';
import { Plug } from 'lucide-react';
import { SetupCard, Item, StatusChip } from '../../../../features/staff/siteHardware/ui';
import { EmptyState } from '../../Feedback';
import NodeDetailModal, { type NodeData } from '../../EnergyFlow/NodeDetailModal';
import { fmtPower } from '../../EnergyFlow/flowModel';
import { Sparkline } from '../../EnergyFlow/FlowRail';
import { applIcon, circuitLoad, createDeviceNodeData, deviceLabel, freshLatest, hourLabels, isPlug, kwOf, lastSeenText, loadOfText, plugGroup, plugRanking, plugState } from '../../EnergyFlow/plugHelpers';
import './plugs.css';
import type { SmartDeviceNode } from '../../EnergyFlow/types';

// The site panel's Smart plugs tab: "what is drawing now", one row of slim tiles per circuit, with Backup and Grid direct
// compared to their inverter/meter reading (docs/test-scenarios/smart-plugs-tab.md). Read-only: the app has no
// plug on/off or schedule API wired, so there is no control here.
// ponytail: add the switch behind useAccess().can('device_control') once a plug control endpoint exists.

const CIRCUIT = { backup: 'Backup', grid: 'Grid direct', ev: 'EV' } as const;
const LOAD_NAME = { backup: 'backup load', grid: 'grid-direct load', ev: '' } as const;
const STATE_LABEL = { running: 'Running', standby: 'Standby', idle: 'Idle', offline: 'Offline' } as const;
// Bar and tile swatches: shades of the accent, neighbours differ in lightness.
const SEGMENT = [100, 50, 75, 30, 88, 62].map(p => `color-mix(in srgb, var(--brand-green) ${p}%, var(--foreground))`);

const CHIP = { offline: ['wait', 'Offline'], running: ['good', 'Running'], standby: ['idle', 'Standby'], idle: ['idle', 'Idle'] } as const;

/** One plug: name, state chip, power. Also used by the energy flow's inline plug list on hosts without this tab. */
export const PlugRow: React.FC<{ device: SmartDeviceNode; color: string; isDark: boolean; onSelect: (n: NodeData) => void }> = ({ device: d, color, isDark, onSelect }) => {
  const state = plugState(d);
  const [tone, label] = CHIP[state];
  const kw = fmtPower((freshLatest(d)?.power_w ?? 0) / 1000);
  return (
    <button
      type="button"
      onClick={() => onSelect(createDeviceNodeData(d, color))}
      style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
    >
      <Item
        isDark={isDark}
        icon={applIcon(d.appliance_label, 'currentColor', 19)}
        iconTone={state === 'running' ? 'good' : 'plain'}
        title={deviceLabel(d)}
        status={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip isDark={isDark} state={tone}>{label}</StatusChip>
            {state !== 'offline' && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{`${kw.valueStr} ${kw.unit}`}</span>}
          </span>
        }
        actions={[]}
      />
    </button>
  );
};

const text = (kw: number) => { const f = fmtPower(kw); return `${f.valueStr} ${f.unit}`; };

/** `circuitKw`: the live inverter (backup) and meter (grid direct) readings; null when missing or not live. */
const PlugsTab: React.FC<{ smartDevices: SmartDeviceNode[]; isDark: boolean; siteId: string; circuitKw?: { backup: number | null; grid: number | null } }> = ({ smartDevices, isDark, siteId, circuitKw }) => {
  const [selected, setSelected] = useState<NodeData | null>(null);
  const plugs = smartDevices.filter(isPlug);
  if (plugs.length === 0) {
    return (
      <SetupCard isDark={isDark} icon={<Plug size={20} />} title="Smart plugs">
        <EmptyState icon={Plug} title="No smart plugs at this site yet" />
      </SetupCard>
    );
  }
  const r = plugRanking(plugs);
  const labels = hourLabels(Date.now());
  const now = fmtPower(r.nowKw);
  // The popup appends alpha digits to this colour, so it has to be a hex value, not a CSS variable.
  const accent = isDark ? '#2EF0CC' : '#0F9F8F';
  // Backup first (it answers "what is the inverter carrying"), then by installed plugs so a plug dropping out cannot reorder rows.
  const circuits = (['backup', 'ev', 'grid'] as const)
    .map(g => ({ g, rows: r.live.filter(d => plugGroup(d) === g), offline: r.offline.filter(d => plugGroup(d) === g).length }))
    .sort((a, b) => (a.g === 'backup' ? -1 : b.g === 'backup' ? 1 : (b.rows.length + b.offline) - (a.rows.length + a.offline)));
  return (
    <div className="pt-block">
      <section aria-label="Plugs summary" className="pt-summary">
        <div className="pt-big" data-testid="sum-now">{now.valueStr}<small>{now.unit} on plugs now</small></div>
        {r.todayKwh != null && (
          <div className="pt-stat" data-testid="sum-today">{r.todayKwh.toFixed(1)} kWh today{r.todayPartial && <span className="pt-note" data-testid="sum-today-note"> · partly counted</span>}</div>
        )}
        <div className="pt-stat" data-testid="sum-running">{r.running} of {plugs.length} running</div>
      </section>

      <div className="pt-rows">
      {circuits.map(({ g, rows, offline }) => {
        if (rows.length === 0) return null;
        const load = g === 'ev' ? null : circuitLoad(rows, circuitKw?.[g]);
        const plugsKw = rows.reduce((s, d) => s + kwOf(d), 0);
        return (
      <section key={g} aria-label={`${CIRCUIT[g]} plugs`} className="pt-row">
        <div className="pt-head">
          <div className="pt-label" data-testid={`circuit-${g}`}>{CIRCUIT[g]} · {rows.length}</div>
          {load && load.gapKw > 0 ? (
            <div className="pt-load" data-testid={`load-${g}`}>
              <b>{loadOfText(load.plugsKw, load.totalKw)}</b> {LOAD_NAME[g]} · {text(load.gapKw)} not on a plug
              {offline > 0 && ` · includes ${offline} plug${offline > 1 ? 's' : ''} not reporting`}
            </div>
          ) : (load || rows.length > 1) && (
            <div className="pt-load" data-testid={`load-${g}`}><b>{text(plugsKw)}</b> on plugs</div>
          )}
        </div>
        {load && (
          <div className="pt-bar" role="img" data-testid={`bar-${g}`} aria-label={`${loadOfText(load.plugsKw, load.totalKw)} of the ${LOAD_NAME[g]} is on plugs`}>
            {rows.map((d, i) => kwOf(d) > 0 && <i key={d.id} style={{ flexGrow: kwOf(d), background: SEGMENT[i % SEGMENT.length] }} />)}
            {load.gapKw > 0 && <i data-testid={`gap-${g}`} style={{ flexGrow: load.gapKw, background: 'var(--border)' }} />}
          </div>
        )}
        <div className="pt-tiles">
        {rows.map((d, i) => {
          const name = deviceLabel(d);
          const state = plugState(d);
          const today = d.today?.kwh_today;
          const curve = d.today?.curve_24h;
          const hasCurve = !!curve && curve.filter(v => v != null).length >= 2;
          return (
            <button key={d.id} type="button" data-testid="plug-row" className="pt-tile" onClick={() => setSelected(createDeviceNodeData(d, accent))}>
              <div className="pt-top">
                {load && kwOf(d) > 0 && <i className="pt-swatch" data-testid={`swatch-${name}`} style={{ background: SEGMENT[i % SEGMENT.length] }} />}
                <span className="pt-icon">{applIcon(d.appliance_label, 'currentColor', 18)}</span>
                <div className="pt-name" data-testid="plug-name">{name}</div>
                <span className={`pt-state ${state}`} data-testid={`plug-state-${name}`}><i />{STATE_LABEL[state]}</span>
              </div>
              <div className="pt-now">
                <div className="pt-watts">{text(kwOf(d))}</div>
                {/* Each curve scales to its own peak, so it shows the shape of the day, not size against other plugs. */}
                {hasCurve && <div className="pt-curve" role="img" aria-label="Shape of the last 24 hours of draw"><Sparkline points={curve!.map(v => (v == null ? null : v * 1000))} labels={labels} color="var(--brand-green)" unit="W" /></div>}
              </div>
              {today != null && <div className="pt-today" data-testid={`plug-today-${name}`}><span>Today</span><b>{today.toFixed(1)} kWh</b></div>}
            </button>
          );
        })}
        </div>
      </section>
        );
      })}
      </div>

      {r.offline.length > 0 && (
        <section aria-label="Plugs not reporting" className="pt-offline">
          <div className="pt-label">Not reporting · {r.offline.length}</div>
          <div className="pt-chips">
            {r.offline.map(d => (
              <button key={d.id} type="button" className="pt-chip" data-testid={`plug-offline-${deviceLabel(d)}`} onClick={() => setSelected(createDeviceNodeData(d, accent))}>
                <span>{deviceLabel(d)}</span><span>{lastSeenText(d)}{d.today?.kwh_today != null && ` · Today ${d.today.kwh_today.toFixed(1)} kWh`}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <NodeDetailModal node={selected} onClose={() => setSelected(null)} isDark={isDark} siteId={siteId} />
    </div>
  );
};

export default PlugsTab;
