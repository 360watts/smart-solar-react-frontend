import React from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../ui/sheet';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { SmartDeviceNode } from './types';

interface ReadingPoint {
  timestamp: string;
  power_w: number | null;
}

interface DeviceDetailPanelProps {
  device: SmartDeviceNode | null;
  onClose: () => void;
  isDark: boolean;
  readings: ReadingPoint[];
  readingsLoading: boolean;
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay >= 1) {
    return date.toLocaleString();
  }
  if (diffHr >= 1) return `${diffHr} hr ago`;
  if (diffMin >= 1) return `${diffMin} min ago`;
  return `${diffSec}s ago`;
}

function getOnlineStatus(latest: SmartDeviceNode['latest']): 'online' | 'offline' | 'unknown' {
  if (!latest || !latest.timestamp) return 'unknown';
  const date = new Date(latest.timestamp);
  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < 10) return 'online';
  if (diffMin < 60) return 'offline';
  return 'unknown';
}

const STATUS_COLOR: Record<string, string> = {
  online: '#19AC24',
  offline: '#EF4444',
  unknown: 'var(--muted-foreground)',
};

function StatusBadge({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 12,
        background: `${color}22`,
        color,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {status}
    </span>
  );
}

function SectionLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: isDark ? 'var(--text-dim)' : 'var(--muted-foreground)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  isDark,
}: {
  label: string;
  value: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        background: isDark ? 'rgba(148,163,184,0.06)' : '#f8fafc',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.11)' : '#e2e8f0'}`,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: isDark ? 'var(--text-dim)' : 'var(--muted-foreground)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--foreground)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '—';
  return val.toFixed(decimals);
}

export default function DeviceDetailPanel({
  device,
  onClose,
  isDark,
  readings,
  readingsLoading,
}: DeviceDetailPanelProps) {
  const latest = device?.latest ?? null;
  const status = getOnlineStatus(latest);

  const chartData = readings.map((r) => ({
    t: r.timestamp,
    v: r.power_w ?? 0,
  }));

  const bgColor = 'var(--card)';
  const tooltipBgColor = 'var(--popover)';
  const borderColor = isDark ? 'rgba(148,163,184,0.11)' : '#e2e8f0';
  const textColor = 'var(--foreground)';
  const subTextColor = isDark ? 'var(--text-dim)' : 'var(--muted-foreground)';

  return (
    <Sheet
      open={device !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        style={{
          width: 420,
          background: bgColor,
          borderLeft: `1px solid ${borderColor}`,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflowY: 'auto',
        }}
      >
        {device && (
          <>
            {/* Header */}
            <SheetHeader
              style={{
                padding: '20px 20px 16px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <SheetTitle
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: textColor,
                    margin: 0,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {device.display_name}
                </SheetTitle>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge status={status} />
                </div>
              </div>
              <SheetClose asChild>
                <button
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: subTextColor,
                    fontSize: 18,
                    lineHeight: 1,
                    padding: 4,
                    flexShrink: 0,
                  }}
                  aria-label="Close panel"
                >
                  ✕
                </button>
              </SheetClose>
            </SheetHeader>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Health status row */}
              <div>
                <SectionLabel isDark={isDark}>Health Status</SectionLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <StatusBadge status={status} />
                  <span style={{ fontSize: 12, color: subTextColor }}>
                    Last seen: {formatRelativeTime(latest?.timestamp ?? null)}
                  </span>
                  {latest?.switch_on !== null && latest?.switch_on !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: latest.switch_on ? '#19AC24' : '#EF4444',
                        background: latest.switch_on ? '#19AC2422' : '#EF444422',
                        padding: '2px 8px',
                        borderRadius: 10,
                      }}
                    >
                      Switch {latest.switch_on ? 'ON' : 'OFF'}
                    </span>
                  )}
                </div>
              </div>

              {/* Real-time metrics grid */}
              <div>
                <SectionLabel isDark={isDark}>Real-time Metrics</SectionLabel>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <MetricCard
                    label="Power"
                    value={`${fmt(latest?.power_w, 1)} W`}
                    isDark={isDark}
                  />
                  <MetricCard
                    label="Current"
                    value={`${fmt(latest?.current_a)} A`}
                    isDark={isDark}
                  />
                  <MetricCard
                    label="Voltage"
                    value={`${fmt(latest?.voltage_v, 1)} V`}
                    isDark={isDark}
                  />
                  <MetricCard
                    label="Energy Today"
                    value={`${fmt(latest?.energy_kwh)} kWh`}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* 24h trend sparkline */}
              <div>
                <SectionLabel isDark={isDark}>24h Power Trend</SectionLabel>
                <div
                  style={{
                    background: isDark ? 'rgba(148,163,184,0.04)' : '#f8fafc',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: '8px 4px 4px',
                    height: 128,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {readingsLoading ? (
                    <span style={{ fontSize: 12, color: subTextColor }}>Loading…</span>
                  ) : chartData.length === 0 ? (
                    <span style={{ fontSize: 12, color: subTextColor }}>No data</span>
                  ) : (
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#20B835" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#20B835" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{
                            background: tooltipBgColor,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 6,
                            fontSize: 11,
                            color: textColor,
                          }}
                          formatter={(value: unknown) => {
                            const displayValue = value != null ? `${value} W` : 'N/A';
                            return [displayValue, 'Power'] as [string, string];
                          }}
                          labelFormatter={(label: unknown) => String(label ?? '')}
                        />
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="#20B835"
                          strokeWidth={1.5}
                          fill="url(#sparkGrad)"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Energy summary */}
              <div>
                <SectionLabel isDark={isDark}>Energy Summary</SectionLabel>
                <div
                  style={{
                    background: isDark ? 'rgba(148,163,184,0.06)' : '#f8fafc',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 12, color: subTextColor }}>Cumulative Energy</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
                    {latest?.energy_kwh !== null && latest?.energy_kwh !== undefined
                      ? `${latest.energy_kwh.toFixed(2)} kWh`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
