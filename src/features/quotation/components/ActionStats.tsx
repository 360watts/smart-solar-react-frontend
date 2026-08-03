import { computeActionStats } from '../utils/pipelineStats';
import type { QuotationListItem } from '../../../services/api';

export default function ActionStats({ items }: { items: QuotationListItem[] }) {
  const stats = computeActionStats(items);
  return (
    <div className="sq-action-stats" aria-label="Quotation follow-up stats">
      <div className="sq-action-stat sq-action-stat--followup">
        <span className="sq-action-stat__dot" />
        <div className="sq-action-stat__top">
          <span className="sq-action-stat__label">Needs follow-up</span>
          {stats.needsFollowUp > 0 && <span className="sq-action-stat__badge">3+ days</span>}
        </div>
        <span className="sq-action-stat__value">{stats.needsFollowUp} quote{stats.needsFollowUp === 1 ? '' : 's'}</span>
      </div>
      <div className="sq-action-stat sq-action-stat--accept">
        <span className="sq-action-stat__dot" />
        <span className="sq-action-stat__label">Avg. time to accept</span>
        <span className="sq-action-stat__value">
          {stats.avgDaysToAccept === null ? '—' : `${stats.avgDaysToAccept.toFixed(1)} days`}
        </span>
      </div>
      <div className="sq-action-stat sq-action-stat--rate">
        <span className="sq-action-stat__dot" />
        <span className="sq-action-stat__label">Win rate</span>
        <span className="sq-action-stat__value">
          {stats.conversionRate === null ? '—' : `${Math.round(stats.conversionRate * 100)}%`}
        </span>
      </div>
    </div>
  );
}
