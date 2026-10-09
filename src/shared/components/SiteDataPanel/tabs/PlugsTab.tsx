import React, { useState } from 'react';
import { Plug } from 'lucide-react';
import { SetupCard, Item, StatusChip, EmptyState } from '../../../../features/staff/siteHardware/ui';
import NodeDetailModal, { type NodeData } from '../../EnergyFlow/NodeDetailModal';
import { fmtPower } from '../../EnergyFlow/flowModel';
import { Sparkline } from '../../EnergyFlow/FlowRail';
import { applIcon, createDeviceNodeData, deviceLabel, freshLatest, hourLabels, isPlug, lastSeenText, plugGroup, plugRanking, plugState } from '../../EnergyFlow/plugHelpers';
import './plugs.css';
import type { SmartDeviceNode } from '../../EnergyFlow/types';

// The site panel's Smart plugs tab: one table ranked by live draw (docs/test-scenarios/smart-plugs-tab.md). Read-only: the app has no
// plug on/off or schedule API wired, so there is no control here.
// ponytail: add the switch behind useAccess().can('device_control') once a plug control endpoint exists.

const CIRCUIT = { backup: 'Backup', grid: 'Grid direct', ev: 'EV' } as const;
const COLOR = '#3fb98a';

const CHIP = { offline: ['wait', 'Offline'], running: ['good', 'Running'], idle: ['idle', 'Idle'] } as const;

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

const kw = (d: SmartDeviceNode) => fmtPower((freshLatest(d)?.power_w ?? 0) / 1000);

const PlugsTab: React.FC<{ smartDevices: SmartDeviceNode[]; isDark: boolean; siteId: string }> = ({ smartDevices, isDark, siteId }) => {
  const [selected, setSelected] = useState<NodeData | null>(null);
  const plugs = smartDevices.filter(isPlug);
  if (plugs.length === 0) {
    return (
      <SetupCard isDark={isDark} icon={<Plug size={20} />} title="Smart plugs">
        <EmptyState isDark={isDark} headline="No smart plugs at this site yet" />
      </SetupCard>
    );
  }
  const r = plugRanking(plugs);
  const labels = hourLabels(Date.now());
  const now = fmtPower(r.nowKw);
  return (
    <div className="pt-block">
      <section aria-label="Plugs summary" className="pt-summary">
        <div className="pt-big" data-testid="sum-now">{now.valueStr}<small>{now.unit} on plugs now</small></div>
        {r.todayKwh != null && (
          <div className="pt-stat" data-testid="sum-today">{r.todayKwh.toFixed(1)} kWh today{r.todayPartial && <span className="pt-note" data-testid="sum-today-note"> · partly counted</span>}</div>
        )}
        <div className="pt-stat" data-testid="sum-running">{r.running} of {plugs.length} running</div>
      </section>

      <section aria-label="Plugs by current draw" className="pt-tiles">
        {r.live.map(d => {
          const f = kw(d);
          const name = deviceLabel(d);
          const running = plugState(d) === 'running';
          const today = d.today?.kwh_today;
          const curve = d.today?.curve_24h;
          const hasCurve = !!curve && curve.filter(v => v != null).length >= 2;
          return (
            <button key={d.id} type="button" data-testid="plug-row" className="pt-tile" onClick={() => setSelected(createDeviceNodeData(d, COLOR))}>
              <div className="pt-top">
                <div><div className="pt-name" data-testid="plug-name">{name}</div>
                  <div className="pt-sub" data-testid={`plug-circuit-${name}`}>{CIRCUIT[plugGroup(d)]}</div></div>
                <span className={`pt-state${running ? ' on' : ''}`}><i />{running ? 'Running' : 'Idle'}</span>
              </div>
              <div className={`pt-watts${running ? '' : ' idle'}`}>{f.valueStr}<small>{f.unit}</small></div>
              {hasCurve && <div role="img" aria-label="Last 24 hours of draw"><Sparkline points={curve!} labels={labels} color={COLOR} /></div>}
              {today != null && <div className="pt-today" data-testid={`plug-today-${name}`}><span>Today</span><b>{today.toFixed(1)} kWh</b></div>}
            </button>
          );
        })}
      </section>

      {r.offline.length > 0 && (
        <section aria-label="Plugs not reporting" className="pt-offline">
          <div className="pt-label">Not reporting · {r.offline.length}</div>
          <div className="pt-chips">
            {r.offline.map(d => (
              <button key={d.id} type="button" className="pt-chip" data-testid={`plug-offline-${deviceLabel(d)}`} onClick={() => setSelected(createDeviceNodeData(d, COLOR))}>
                <span>{deviceLabel(d)}</span><span>{lastSeenText(d)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="pt-note">Plugs measure only what is plugged into them. They are not the whole home. Tap a plug for its detail.</div>
      <NodeDetailModal node={selected} onClose={() => setSelected(null)} isDark={isDark} siteId={siteId} />
    </div>
  );
};

export default PlugsTab;
