const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

interface Stage {
  count: number;
  value: number;
}

interface PipelineFlowProps {
  draft: Stage;
  sent: Stage;
  accepted: Stage;
  total: Stage;
  loading: boolean;
}

export default function PipelineFlow({ draft, sent, accepted, total, loading }: PipelineFlowProps) {
  return (
    <section className="sq-flow-card" aria-label="Quotation pipeline">
      <div className="sq-flow-card__label">
        <span className="sq-flow-card__eyebrow">Pipeline current — this view</span>
        <span className="sq-flow-card__total">
          {loading ? 'Refreshing…' : (
            <>{total.count} quotes worth <strong>{INR.format(total.value)}</strong></>
          )}
        </span>
      </div>
      <div className="sq-flow">
        <div className="sq-flow-node sq-flow-node--draft">
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : draft.count}</span>
          <span className="sq-flow-node__label">Draft</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(draft.value)}</span>
        </div>
        <div className="sq-flow-conn">
          <span className="sq-flow-conn__meta">awaiting send</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <line x1="0" y1="5" x2="100" y2="5" />
          </svg>
        </div>
        <div className="sq-flow-node sq-flow-node--sent">
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : sent.count}</span>
          <span className="sq-flow-node__label">Sent</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(sent.value)}</span>
        </div>
        <div className="sq-flow-conn sq-flow-conn--live">
          <span className="sq-flow-conn__meta">converting</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <line x1="0" y1="5" x2="100" y2="5" />
          </svg>
        </div>
        <div className="sq-flow-node sq-flow-node--accepted">
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : accepted.count}</span>
          <span className="sq-flow-node__label">Accepted</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(accepted.value)}</span>
        </div>
      </div>
    </section>
  );
}
