import type { QuotationListItem } from '../../../services/api';

export function daysSince(dateString: string, now: Date = new Date()): number {
  const then = new Date(dateString).getTime();
  const diffMs = now.getTime() - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const FOLLOW_UP_THRESHOLD_DAYS = 3;

export interface ActionStatsResult {
  needsFollowUp: number;
  avgDaysToAccept: number | null;
  conversionRate: number | null;
}

export function computeActionStats(items: QuotationListItem[], now: Date = new Date()): ActionStatsResult {
  const sent = items.filter(i => i.status === 'sent');
  const accepted = items.filter(i => i.status === 'accepted');
  const rejected = items.filter(i => i.status === 'rejected');

  const needsFollowUp = sent.filter(i => daysSince(i.updated_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

  const avgDaysToAccept = accepted.length > 0
    ? accepted.reduce((sum, i) => sum + daysSince(i.created_at, new Date(i.updated_at)), 0) / accepted.length
    : null;

  const decided = accepted.length + rejected.length + sent.length;
  const conversionRate = decided > 0 ? accepted.length / decided : null;

  return { needsFollowUp, avgDaysToAccept, conversionRate };
}
