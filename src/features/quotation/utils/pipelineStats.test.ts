import { daysSince, computeActionStats } from './pipelineStats';
import type { QuotationListItem } from '../../../services/api';

function item(overrides: Partial<QuotationListItem>): QuotationListItem {
  return {
    id: 1,
    public_id: 'p1',
    quote_number: 'Q-1',
    revision_number: 1,
    status: 'draft',
    customer_name: 'Test',
    customer_phone: '',
    system_type: 'ON-GRID',
    system_kw: '5',
    net_investment: '100000',
    currency: 'INR',
    valid_until: '',
    pdf_status: '',
    is_archived: false,
    created_by_name: '',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('daysSince', () => {
  it('returns 0 for a timestamp from right now', () => {
    const now = new Date('2026-07-14T12:00:00Z');
    expect(daysSince('2026-07-14T12:00:00Z', now)).toBe(0);
  });

  it('returns whole days elapsed, rounding down', () => {
    const now = new Date('2026-07-14T12:00:00Z');
    expect(daysSince('2026-07-09T00:00:00Z', now)).toBe(5);
  });
});

describe('computeActionStats', () => {
  it('counts sent quotes older than 3 days as needing follow-up', () => {
    const now = new Date('2026-07-14T00:00:00Z');
    const items = [
      item({ status: 'sent', updated_at: '2026-07-08T00:00:00Z' }), // 6 days — stale
      item({ status: 'sent', updated_at: '2026-07-13T00:00:00Z' }), // 1 day — fresh
      item({ status: 'draft', updated_at: '2026-07-01T00:00:00Z' }), // not sent, ignored
    ];
    const stats = computeActionStats(items, now);
    expect(stats.needsFollowUp).toBe(1);
  });

  it('returns null avgDaysToAccept and conversionRate when there is no data', () => {
    const stats = computeActionStats([], new Date());
    expect(stats.avgDaysToAccept).toBeNull();
    expect(stats.conversionRate).toBeNull();
  });

  it('computes conversion rate as accepted / (sent + accepted + rejected)', () => {
    const now = new Date('2026-07-14T00:00:00Z');
    const items = [
      item({ status: 'accepted', updated_at: now.toISOString() }),
      item({ status: 'sent', updated_at: now.toISOString() }),
      item({ status: 'rejected', updated_at: now.toISOString() }),
      item({ status: 'draft', updated_at: now.toISOString() }),
    ];
    const stats = computeActionStats(items, now);
    expect(stats.conversionRate).toBeCloseTo(1 / 3);
  });
});
