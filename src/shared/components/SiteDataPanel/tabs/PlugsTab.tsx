import React, { useState } from 'react';
import { Home, Grid, Car, Plug } from 'lucide-react';
import { SetupCard, Item, StatusChip, EmptyState } from '../../../../features/staff/siteHardware/ui';
import NodeDetailModal, { type NodeData } from '../../EnergyFlow/NodeDetailModal';
import { fmtPower } from '../../EnergyFlow/flowModel';
import { applIcon, createDeviceNodeData, deviceLabel, freshLatest, isPlug, plugGroup, plugState } from '../../EnergyFlow/plugHelpers';
import type { SmartDeviceNode } from '../../EnergyFlow/types';

// The site panel's Smart plugs tab (docs/test-scenarios/smart-plugs-tab.md). Read-only: the app has no
// plug on/off or schedule API wired, so there is no control here.
// ponytail: add the switch behind useAccess().can('device_control') once a plug control endpoint exists.

const GROUPS = [
  { id: 'backup', title: 'Backup (via inverter)', purpose: 'Runs on the inverter, so it keeps going in a power cut.', icon: <Home size={20} />, color: '#f87171' },
  { id: 'grid', title: 'Grid direct', purpose: 'Wired straight to the grid, not backed up.', icon: <Grid size={20} />, color: '#f472b6' },
  { id: 'ev', title: 'EV charging', purpose: 'The car charger line.', icon: <Car size={20} />, color: '#0F9F8F' },
] as const;

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

const PlugsTab: React.FC<{ smartDevices: SmartDeviceNode[]; isDark: boolean; siteId: string }> = ({ smartDevices, isDark, siteId }) => {
  const [selected, setSelected] = useState<NodeData | null>(null);
  const plugs = smartDevices.filter(isPlug);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {plugs.length === 0 ? (
        <SetupCard isDark={isDark} icon={<Plug size={20} />} title="Smart plugs">
          <EmptyState isDark={isDark} headline="No smart plugs at this site yet" />
        </SetupCard>
      ) : GROUPS.map((g, i) => {
        const rows = plugs.filter(d => plugGroup(d) === g.id);
        if (rows.length === 0) return null;
        return (
          <SetupCard key={g.id} index={i} isDark={isDark} icon={g.icon} title={g.title} purpose={g.purpose}>
            {rows.map(d => <PlugRow key={d.id} device={d} color={g.color} isDark={isDark} onSelect={setSelected} />)}
          </SetupCard>
        );
      })}
      <NodeDetailModal node={selected} onClose={() => setSelected(null)} isDark={isDark} siteId={siteId} />
    </div>
  );
};

export default PlugsTab;
