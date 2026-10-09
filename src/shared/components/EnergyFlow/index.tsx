import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Zap, Activity, Car } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { NodeCard, FlatCard, FlatValue } from './DeviceCard';
import AnomalyBanner from './AnomalyBanner';
import './energyFlow.css';
import NodeDetailModal, { NodeData } from './NodeDetailModal';
import { fmtPower, mixShares, wholeHomeKw } from './flowModel';
import FlowRing from './FlowRing';
import FlowLines, { FLOW_COLORS } from './FlowLines';
import { RailStack, RailTile, Sparkline, LedgerRow, MixBar } from './FlowRail';
import { EnergyFlowBlockProps, SmartDeviceNode } from './types';
import { isDeviceOffline, anomalousDevices, freshLatest, isPlug, plugGroup, createDeviceNodeData } from './plugHelpers';
import { apiService, CtMeterReading } from '../../../services/api';
import { PlugRow } from '../SiteDataPanel/tabs/PlugsTab';

function ctActivePowerW(reading: CtMeterReading | null): number {
  if (!reading) return 0;
  const reported = reading.active_power_total;
  if (reported != null && Math.abs(reported) > 0.05) return reported;
  const phases = [reading.active_power_l1, reading.active_power_l2, reading.active_power_l3]
    .filter((v): v is number => v != null);
  if (!phases.length || phases.every(v => Math.abs(v) <= 0.05)) return reported ?? 0;
  return phases.reduce((sum, v) => sum + v, 0);
}

// Moved to plugHelpers.tsx (shared with the Smart plugs tab); re-exported so existing imports keep working.
export { isDeviceOffline, anomalousDevices };

// ── Load card ─────────────────────────────────────────────────────────────────
// Flat and neutral (no accent colour): label, one value, one muted sub-line, the plugs link.
// The whole card opens the detail modal when a payload exists.

interface LoadCardProps {
  title: string;
  /** kW shown on one line: 0 -> "Idle", null -> "—". Signed (grid-direct meter may read negative). */
  kw: number | null;
  sub: string;
  /** The plugs on this circuit: counted for the "N smart plugs ›" link. */
  devices: SmartDeviceNode[];
  /** Colour handed to the plug detail modal only; the card itself is neutral. */
  plugColor: string;
  isDark: boolean;
  onOpenPlugs?: () => void;
  /** Opens a plug's detail from the inline list shown when there is no Smart plugs tab (no onOpenPlugs). */
  onPlugClick?: (n: NodeData) => void;
  onClick?: () => void;
}

function loadValue(kw: number | null): { valueStr: string; unit?: string } {
  if (kw == null) return { valueStr: '—' };
  if (Math.abs(kw) < 0.0005) return { valueStr: 'Idle' };
  const f = fmtPower(kw);
  return { valueStr: `${kw < 0 ? '-' : ''}${f.valueStr}`, unit: f.unit };
}

function LoadCard({ title, kw, sub, devices, plugColor, isDark, onOpenPlugs, onPlugClick, onClick }: LoadCardProps) {
  // The plug controls sit inside the clickable card: keep their clicks/keys from opening the card's modal.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const linkStyle: React.CSSProperties = { alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: 'var(--foreground)', padding: '4px 0', minHeight: 28 };
  const text = `${devices.length} smart plug${devices.length === 1 ? '' : 's'}`;
  return (
    <FlatCard label={title} isDark={isDark} onClick={onClick} ariaLabel={`${title} details`}>
      <FlatValue {...loadValue(kw)} />
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{sub}</div>
      {devices.length > 0 && (onOpenPlugs
        ? <button type="button" onClick={e => { stop(e); onOpenPlugs?.(); }} onKeyDown={stop}
            style={{ ...linkStyle, border: 'none', background: 'transparent', cursor: 'pointer', marginTop: 'auto' }}>{`${text} ›`}</button>
        // Hosts without the Smart plugs tab (mobile staff dashboard, Analytics snapshot): list the plugs here, collapsed.
        : (
          <details onClick={stop} onKeyDown={stop} style={{ marginTop: 'auto' }}>
            <summary style={{ ...linkStyle, cursor: 'pointer' }}>{`Smart plugs (${devices.length})`}</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {devices.map(d => <PlugRow key={d.id} device={d} color={plugColor} isDark={isDark} onSelect={n => onPlugClick?.(n)} />)}
            </div>
          </details>
        ))}
    </FlatCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EnergyFlowBlock({ pvKw, loadKw, gridKw, battKw, battSoc, smartDevices = [], siteId, inverterPhases, ctReading: externalCtReading, today, onOpenPlugs }: EnergyFlowBlockProps) {
  const { isDark } = useTheme();

  // Measured by FlowLines so the lines meet the real card edges and ring.
  const panelRef = useRef<HTMLDivElement>(null);
  const solarRef = useRef<HTMLDivElement>(null);
  const battRef  = useRef<HTMLDivElement>(null);
  const gridRef  = useRef<HTMLDivElement>(null);
  const ringRef  = useRef<HTMLDivElement>(null);
  const load0Ref = useRef<HTMLDivElement>(null);
  const load1Ref = useRef<HTMLDivElement>(null);
  const load2Ref = useRef<HTMLDivElement>(null);
  const loadRefs: [React.RefObject<HTMLDivElement>, React.RefObject<HTMLDivElement>, React.RefObject<HTMLDivElement>] =
    [load0Ref, load1Ref, load2Ref];

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Discard readings older than 15 minutes — device is offline. Applied to both
  // the self-fetch path below and any externally-provided ctReading, so a stale
  // reading never displays regardless of who fetched it.
  const freshOrNull = (data: CtMeterReading | null | undefined): CtMeterReading | null => {
    if (!data) return null;
    if (data.timestamp) {
      const ageMs = Date.now() - new Date(data.timestamp).getTime();
      if (ageMs > 15 * 60 * 1000) return null;
    }
    return data;
  };

  const [ctReading, setCtReading] = useState<CtMeterReading | null>(freshOrNull(externalCtReading) ?? null);

  useEffect(() => {
    // If ctReading provided by parent (e.g., from SiteDataPanel), skip independent polling
    if (externalCtReading !== undefined) {
      setCtReading(freshOrNull(externalCtReading));
      return;
    }
    if (!siteId) return;
    let cancelled = false;
    const fetch = async () => {
      if (document.hidden) return;
      const data = await apiService.getLatestEnergyMeter(siteId);
      if (cancelled) return;
      setCtReading(freshOrNull(data));
    };
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId, externalCtReading]);

  const ctGridKw  = Math.abs(ctActivePowerW(ctReading)) / 1000;
  const ctReversed = (ctReading?.active_power_total ?? 0) < 0;

  const nonGridDevices  = smartDevices.filter(isPlug);
  const evLoads         = nonGridDevices.filter(d => plugGroup(d) === 'ev');
  const solarLoads      = nonGridDevices.filter(d => plugGroup(d) === 'backup');
  const gridLoads       = nonGridDevices.filter(d => plugGroup(d) === 'grid');
  const evLoadPowerKw  = evLoads.reduce((s, d) => s + ((freshLatest(d)?.power_w ?? 0) / 1000), 0);
  const evLoadActive   = evLoadPowerKw  > 0;

  const pv   = pvKw   ?? 0;
  const load = loadKw ?? 0;
  const grid = gridKw ?? 0;
  const batt = battKw ?? 0;

  const isExporting   = grid < 0;
  // Whole home = backup + grid-direct (CT, 0 when reversed) + EV; the ring segments stay the inverter supply mix.
  const homeTotalKw = wholeHomeKw(load, ctGridKw, evLoadPowerKw, ctReversed);
  const isImporting   = grid > 0;
  const isCharging    = batt < 0;
  const isDischarging = batt > 0;
  const pvActive      = pv   > 0;
  const loadActive    = load > 0;
  const gridActive    = Math.abs(grid) > 0;
  const battActive    = Math.abs(batt) > 0;
  const battPresent   = battActive || (battSoc ?? 0) > 0;
  const gridColor     = isExporting ? '#0F9F8F' : '#60a5fa';

  const pvFmt   = fmtPower(pv);
  const battFmt = fmtPower(batt);

  const gridFmt = fmtPower(grid);

  const anomalous = anomalousDevices(nonGridDevices);

  const handleNodeClick = (nodeData: NodeData) => {
    setSelectedNode(nodeData);
  };

  let statusText = 'System idle';
  if (pvActive && isExporting)       statusText = 'Solar surplus — exporting to grid';
  else if (pvActive && isImporting)  statusText = 'Solar + grid powering loads';
  else if (pvActive)                 statusText = 'Running on solar';
  else if (isImporting)              statusText = 'Grid supplying load';
  else if (isDischarging)            statusText = 'Battery discharging';

  // Node-detail payloads, unchanged from the old diamond diagram.
  const node = {
    solar: {
      type: 'solar',
      id: 'solar',
      title: 'Solar PV',
      power_kw: pv,
      status: pvActive ? 'active' : 'inactive',
      color: '#f59e0b',
      icon: <Sun size={24} color="#f59e0b" />,
      details: {
        'Generation': `${pvFmt.valueStr} ${pvFmt.unit}`,
        'Status': pvActive ? 'Active' : 'Idle',
      },
    },
    battery: {
      type: 'battery',
      id: 'battery',
      title: 'Battery',
      subtitle: isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle',
      power_kw: Math.abs(batt),
      status: battPresent ? 'active' : 'inactive',
      color: '#0ea5e9',
      icon: <Battery size={24} color="#0ea5e9" />,
      details: {
        'Power Flow': `${battFmt.valueStr} ${battFmt.unit}`,
        'Mode': isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle',
        'State of Charge': `${Math.round(battSoc ?? 0)}%`,
      },
    },
    grid: {
      type: 'grid',
      id: 'grid',
      title: 'Grid Tie (Inverter)',
      subtitle: isExporting ? 'Exporting' : isImporting ? 'Importing' : 'Idle',
      power_kw: Math.abs(grid),
      status: gridActive ? 'active' : 'inactive',
      color: gridColor,
      icon: <Zap size={24} color={gridColor} />,
      details: {
        'Power Flow': `${gridFmt.valueStr} ${gridFmt.unit}`,
        'Direction': isExporting ? 'Export ↑' : isImporting ? 'Import ↓' : 'Idle',
        'Mode': isExporting ? 'Selling' : isImporting ? 'Buying' : 'Idle',
        'Meter': "Inverter's own built-in grid CT",
      },
    },
    load: {
      type: 'load',
      id: 'load',
      title: 'Backup Load',
      subtitle: 'via inverter',
      power_kw: load,
      status: loadActive ? 'active' : 'inactive',
      color: '#f87171',
      icon: <Home size={24} color="#f87171" />,
      loadSplit: {
        solarKw: load,
        gridKw: ctGridKw,
        evKw: evLoadPowerKw > 0 ? evLoadPowerKw : undefined,
      },
      evDevice: evLoads[0] ?? undefined,
      ctReading: ctReading ?? undefined,
      inverterPhases: inverterPhases ?? undefined,
    },
  } satisfies Record<string, NodeData>;

  const shares = mixShares(pvKw, battKw, gridKw);
  const hasEv = evLoads.length > 0;
  const flowKw = {
    solar: pv,
    gridIn: isImporting ? Math.abs(grid) : 0,
    gridOut: isExporting ? Math.abs(grid) : 0,
    battIn: isDischarging ? Math.abs(batt) : 0,
    battOut: isCharging ? Math.abs(batt) : 0,
    loads: hasEv ? [load, evLoadPowerKw, ctGridKw] : [load, ctGridKw],
  };
  // EV and grid-direct loads are on their own circuits: not part of the ledger.
  const ledgerIn = pv + flowKw.gridIn + flowKw.battIn;
  const losses = shares ? Math.max(0, ledgerIn - (load + flowKw.battOut + flowKw.gridOut)) : null;
  // "Solar made today" chart: the solar day from 6 AM up to the latest slot that has a reading. Slots after it
  // (hours still to come) are dropped, not drawn empty; needs two known points.
  const solarChart = (() => {
    const curve = today?.solarCurve ?? [];
    let last = -1;
    curve.forEach((v, i) => { if (v != null) last = i; });
    if (curve.filter(v => v != null).length < 2) return null;
    return { points: curve.slice(0, last + 1), labels: (today?.solarCurveLabels ?? []).slice(0, last + 1) };
  })();
  const kwStr = (kw: number) => { const f = fmtPower(kw); return `${f.valueStr} ${f.unit}`; };
  const soc = battSoc != null ? Math.max(0, Math.min(100, battSoc)) : null;
  const plugsKw = (ds: SmartDeviceNode[]) => ds.reduce((s, d) => s + (freshLatest(d)?.power_w ?? 0), 0) / 1000;
  // Load card numbers: the meter/inverter/EV figure when there is one, else the plugs' total (sub-line says so).
  const backupPlugsKw = plugsKw(solarLoads);
  const backupKw = load > 0 ? load : backupPlugsKw > 0 ? backupPlugsKw : 0;
  const backupSub = load <= 0 && backupPlugsKw > 0 ? 'Plugs total' : 'Through the inverter';
  const ctKw = ctReading ? ctActivePowerW(ctReading) / 1000 : null;
  const gridPlugsKw = plugsKw(gridLoads);
  const gridDirectKw = ctKw ?? (gridPlugsKw > 0 ? gridPlugsKw : gridLoads.length > 0 ? 0 : null);
  const gridDirectSub = ctKw == null && gridPlugsKw > 0 ? 'Plugs total'
    : gridDirectKw == null ? 'No meter or plugs reporting' : 'Not through the inverter';
  const evStatus = !evLoads[0] ? 'Idle' : isDeviceOffline(evLoads[0]) ? 'Offline' : evLoadActive ? 'Charging' : evLoads[0].latest?.switch_on ? 'Plugged in' : 'Idle';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      // No outer card (mockup): the rails and centre panel are the cards. .ef-block is the size container
      // the layout and the clamp(..cqw..) sizes below are measured against (energyFlow.css).
      className="ef-block"
      style={{ width: '100%', maxWidth: 1400, marginLeft: 'auto', marginRight: 'auto', overflow: 'visible' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 12px' }}>
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
          Energy Flow
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F9F8F' }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0F9F8F' }}>Live</span>
        </div>
      </div>

      {/* Anomaly banner */}
      {!bannerDismissed && anomalous.length > 0 && (
        <div style={{ paddingBottom: 12 }}>
          <AnomalyBanner
            anomalousDevices={anomalous}
            onDeviceClick={name => {
              const d = nonGridDevices.find(x => x.display_name === name);
              if (d) handleNodeClick(createDeviceNodeData(d, '#a78bfa'));
            }}
            onDismiss={() => setBannerDismissed(true)}
            isDark={isDark}
          />
        </div>
      )}

      {/* Rails + centre ring: left rail (today), centre panel (live flow), right rail (ledger + mix).
          Columns and the wide / medium / narrow switch live in energyFlow.css (container queries on .ef-block). */}
      <div>
        <div className="ef-grid">
          {/* left rail: one card, stretched to the centre panel's height (grid default align-items: stretch) */}
          <RailStack area="left">
            <RailTile isDark={isDark} title="Solar made today" color={FLOW_COLORS.solar}
              value={today?.solarKwh != null ? today.solarKwh.toFixed(1) : null} unit="kWh"
              sub={solarChart ? (
                <div data-solar-chart>
                  <Sparkline points={solarChart.points} labels={solarChart.labels} color={FLOW_COLORS.solar} />
                  {/* Solar day: starts at 6 AM IST and ends at the latest reading (hours to come are not drawn) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}><span>6 AM</span><span>{solarChart.labels[solarChart.labels.length - 1]}</span></div>
                </div>
              ) : `Now ${kwStr(pv)}`} />
            <RailTile isDark={isDark} title="Home used"
              value={today?.usedKwh != null ? today.usedKwh.toFixed(1) : null} unit="kWh"
              sub={today?.usedPartial ? (
                <span title={`Partly counted: only ${today.usedPartial} so far; a circuit has no reading today`}>
                  Partly counted · {today.usedPartial}
                </span>
              ) : undefined} />
            <RailTile isDark={isDark} title="From your own power" color={FLOW_COLORS.batt}
              value={today?.ownPct != null ? `${Math.round(today.ownPct)}%` : null}
              sub={today?.ownPct != null ? `${100 - Math.round(today.ownPct)}% bought from the grid` : undefined} />
          </RailStack>

          {/* centre */}
          <div ref={panelRef} style={{ gridArea: 'center', minWidth: 0, position: 'relative', borderRadius: 22, padding: 'clamp(14px, 2cqw, 22px)', border: '1px solid var(--border)', background: 'var(--card)', display: 'grid', gridTemplateRows: 'auto 1fr auto', rowGap: 28 }}>
            <FlowLines container={panelRef} solar={solarRef} batt={battRef} grid={gridRef} ring={ringRef} loads={hasEv ? loadRefs : [loadRefs[0], loadRefs[2]]} kw={flowKw} />
            <div className="ef-row3">
              <div ref={solarRef} onClick={() => handleNodeClick(node.solar)} style={{ cursor: 'pointer', minWidth: 0, display: 'flex' }}>
                <NodeCard variant="flat" label="Solar PV" icon={null}
                  valueStr={pvFmt.valueStr} unit={pvFmt.unit}
                  color={FLOW_COLORS.solar} active={pvActive} isDark={isDark} fill
                  subLabel={pvActive ? 'Generating' : 'Not generating'} />
              </div>
              <div ref={battRef} onClick={() => handleNodeClick(node.battery)} style={{ cursor: 'pointer', minWidth: 0, display: 'flex' }}>
                <NodeCard variant="flat" label="Battery" icon={null}
                  valueStr={battFmt.valueStr} unit={battFmt.unit}
                  color={FLOW_COLORS.batt} active={battPresent} isDark={isDark} fill
                  subLabel={battPresent
                    ? `${isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle'}${soc != null ? ` · ${Math.round(soc)}%` : ''}`
                    : 'No battery'}
                  barPct={battPresent && soc != null ? soc / 100 : undefined} />
              </div>
              <div ref={gridRef} onClick={() => handleNodeClick(node.grid)} style={{ cursor: 'pointer', minWidth: 0, display: 'flex' }}>
                <NodeCard variant="flat" label="Grid Tie" icon={null}
                  valueStr={gridFmt.valueStr} unit={gridFmt.unit}
                  color={FLOW_COLORS.grid} active={gridActive} isDark={isDark} fill
                  subLabel={isExporting ? 'Selling' : isImporting ? 'Buying' : 'Idle'} />
              </div>
            </div>
            {/* The ring stands in for the old Backup Load node: clicking it opens the same load detail. */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
              <div onClick={() => handleNodeClick(node.load)} role="button" style={{ cursor: 'pointer' }}>
                <FlowRing ref={ringRef} shares={shares} homeKw={homeTotalKw} isDark={isDark} />
              </div>
              {ctReversed && <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>CT reversed?</span>}
            </div>
            <div className={hasEv ? 'ef-row3' : 'ef-row3 ef-row2'}>
              <div ref={loadRefs[0]} style={{ display: 'flex' }}>
                <LoadCard title="Backup Load" kw={backupKw} sub={backupSub}
                  devices={solarLoads} plugColor="#f87171" isDark={isDark} onOpenPlugs={onOpenPlugs} onPlugClick={handleNodeClick}
                  onClick={load > 0 ? () => handleNodeClick({
                    type: 'solar',
                    id: 'inverter-load',
                    title: 'Backup Load',
                    subtitle: 'Inverter AC Output — same reading as above',
                    power_kw: load,
                    status: load > 0 ? 'active' : 'inactive',
                    color: '#f87171',
                    icon: <Home size={24} color="#f87171" />,
                    details: {
                      'Backup Load': `${fmtPower(load).valueStr} ${fmtPower(load).unit}`,
                      'PV Generation': `${fmtPower(pv).valueStr} ${fmtPower(pv).unit}`,
                      'Self-consumption': pv > 0 ? `${Math.min(100, Math.round((load / pv) * 100))}%` : '—',
                      'Status': load > 0 ? 'Active' : 'Idle',
                    },
                    inverterPhases: inverterPhases ?? undefined,
                  }) : undefined}
                />
              </div>
              {/* Only when the site has an EV plug; otherwise the row is two columns and no EV line is drawn. */}
              {hasEv && <div ref={loadRefs[1]} style={{ display: 'flex' }}>
                {(
                  <LoadCard title="EV Charging" kw={evLoadPowerKw} sub={evStatus === 'Idle' ? 'Not charging' : evStatus}
                    devices={evLoads} plugColor="#0F9F8F" isDark={isDark} onOpenPlugs={onOpenPlugs} onPlugClick={handleNodeClick}
                    onClick={() => evLoads[0] && handleNodeClick({
                      type: 'device',
                      id: String(evLoads[0].id),
                      title: evLoads[0].display_name ?? 'EV Charger',
                      subtitle: evStatus,
                      power_kw: evLoadPowerKw,
                      status: isDeviceOffline(evLoads[0]) ? 'offline' : evLoadActive ? 'active' : 'inactive',
                      color: '#0F9F8F',
                      icon: <Car size={24} color="#0F9F8F" />,
                      details: {
                        'Charging Power': `${fmtPower(evLoadPowerKw).valueStr} ${fmtPower(evLoadPowerKw).unit}`,
                        'Voltage': evLoads[0].latest?.voltage_v != null ? `${evLoads[0].latest.voltage_v.toFixed(0)} V` : '—',
                        'Status': evStatus,
                      },
                      device: evLoads[0],
                    })}
                  />
                )}
              </div>}
              <div ref={loadRefs[2]} style={{ display: 'flex' }}>
                <LoadCard title="Grid Direct" kw={gridDirectKw} sub={gridDirectSub}
                  devices={gridLoads} plugColor="#f472b6" isDark={isDark} onOpenPlugs={onOpenPlugs} onPlugClick={handleNodeClick}
                  onClick={ctReading ? () => handleNodeClick({
                    type: 'ctmeter',
                    id: 'ctmeter',
                    title: 'Grid Direct · Energy Meter',
                    subtitle: '3-Phase Measurement',
                    // Signed, unlike every other node type's power_kw here — this is
                    // the meter's own headline number and should show its real
                    // direction (see F-051), not just feed a magnitude/active check.
                    power_kw: ctActivePowerW(ctReading) / 1000,
                    status: (Math.abs(ctActivePowerW(ctReading)) / 1000) > 0 ? 'active' : 'inactive',
                    color: '#f472b6',
                    icon: <Activity size={24} color="#f472b6" />,
                    details: {
                      'Active Power': `${ctActivePowerW(ctReading).toFixed(1)} W`,
                      'Apparent Power': `${Math.abs(ctReading.apparent_power_total ?? 0).toFixed(1)} VA`,
                      'Power Factor': (ctReading.power_factor_total ?? 0).toFixed(3),
                      'Meter': 'Separate submeter on the grid-direct circuit',
                    },
                    ctReading,
                  }) : undefined}
                />
              </div>
            </div>
          </div>

          {/* right rail: one card, ledger rows then the mix bar */}
          <RailStack area="right">
            <RailTile isDark={isDark} title="Live ledger">
              <div>
                <LedgerRow compact first label="In" value={kwStr(ledgerIn)} />
                <LedgerRow compact label="To battery" value={kwStr(flowKw.battOut)} />
                <LedgerRow compact label="To backup loads" value={kwStr(load)} />
                <LedgerRow compact label="Losses" muted value={losses == null ? '—' : kwStr(losses)} />
              </div>
            </RailTile>
            <RailTile isDark={isDark} title="Inverter supply mix">
              <MixBar shares={shares} isDark={isDark} hideTitle />
            </RailTile>
            <RailTile isDark={isDark} title="Battery" color={FLOW_COLORS.batt}
              value={battPresent && soc != null ? `${Math.round(soc)}%` : null}
              sub={battPresent ? `${isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle'}${Math.abs(batt) > 0 ? ` · ${kwStr(Math.abs(batt))}` : ''}` : 'No battery'} />
          </RailStack>
        </div>
      </div>

      {/* Status row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, padding: '12px 4px 0',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 0 }}>{statusText}</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <NodeDetailModal
        node={selectedNode} onClose={() => setSelectedNode(null)}
        isDark={isDark} siteId={siteId}
      />
    </motion.div>
  );
}
