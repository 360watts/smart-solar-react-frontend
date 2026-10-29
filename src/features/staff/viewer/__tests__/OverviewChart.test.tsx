import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import OverviewChart from '../OverviewChart';
import { GATEWAY_READINGS, METER_READINGS, type Series } from '../deviceChart';

const T = (m: number) => new Date(Date.UTC(2026, 9, 29, 8, m)).toISOString();
const base = (over: Partial<Series> = {}): Series => ({
  device_id: 47, serial: '00A1', device_type: 'gateway', site_id: null, is_online: true, last_heartbeat: null,
  firmware_version: '2.0.9', last_reading_at: T(60), range_start: T(0), range_end: T(60), detail: '1m', keys: ['pv1_power_w', 'pv2_power_w'],
  latest: {}, median_gap_s: 2, longest_gap_s: 252, longest_gap_at: T(16),
  coverage: [...Array(16).fill('full'), 'partial', 'empty', ...Array(42).fill('full')],
  code_changes: [{ t: T(59), key: 'fault_word_1', value: 4 }],
  series: [0, 1, 2].map(m => ({ t: T(m), pv1_power_w: 1400, pv1_power_w__min: 1300, pv1_power_w__max: 1500, pv2_power_w: 1300, pv2_power_w__min: 1250, pv2_power_w__max: 1350 })),
  ...over,
});

describe('OverviewChart', () => {
  it('C6/C7/C8 draws the spread band, three cell shapes, the codes lane, and a latest readout', () => {
    const { container } = render(<OverviewChart data={base()} reading={GATEWAY_READINGS[0]} />);
    expect(container.querySelectorAll('path[data-band]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[data-cell="full"]').length).toBe(58);
    expect(container.querySelector('rect[data-cell="partial"]')).toBeInTheDocument();
    expect(container.querySelector('rect[data-cell="empty"]')).toBeInTheDocument();
    expect(screen.getByText(/Fault 0x0004 at/)).toBeInTheDocument();
    expect(screen.getByText(/^Latest/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(1,300 to 1,500\)/).length).toBeGreaterThan(0);
  });

  it('draws no band for every reading', () => {
    const { container } = render(<OverviewChart data={base({ detail: 'every', series: [{ t: T(0), pv1_power_w: 1 } as any] })} reading={GATEWAY_READINGS[0]} />);
    expect(container.querySelector('path[data-band]')).toBeNull();
  });

  it('C10 empty series and no gap stats do not crash and draw no gap band', () => {
    const { container } = render(<OverviewChart data={base({ series: [], longest_gap_s: null, longest_gap_at: null, median_gap_s: null })} reading={GATEWAY_READINGS[0]} />);
    expect(container.querySelector('rect[fill="var(--dc-miss)"][opacity]')).toBeNull();
    expect(screen.getByText(/No readings in this range/)).toBeInTheDocument();
  });

  it('C11 draws the gap band only when the longest gap is over 3x the median', () => {
    const big = render(<OverviewChart data={base({ median_gap_s: 2, longest_gap_s: 7 })} reading={GATEWAY_READINGS[0]} />);
    expect(big.container.querySelector('rect[opacity="0.45"]')).toBeInTheDocument();
    big.unmount();
    const small = render(<OverviewChart data={base({ median_gap_s: 2, longest_gap_s: 5 })} reading={GATEWAY_READINGS[0]} />);
    expect(small.container.querySelector('rect[opacity="0.45"]')).toBeNull();
  });

  it('C12 current shows one decimal', () => {
    const cur = METER_READINGS.find(x => x.id === 'current')!;
    render(<OverviewChart data={base({ detail: 'every', series: [{ t: T(0), current_l1: 5.43 } as any] })} reading={cur} />);
    expect(screen.getByText('5.4')).toBeInTheDocument();
  });
});
