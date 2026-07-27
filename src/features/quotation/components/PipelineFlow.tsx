const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

interface Stage {
  count: number;
  value: number;
}

type StageKey = 'draft' | 'sent' | 'accepted';

interface PipelineFlowProps {
  draft: Stage;
  sent: Stage;
  accepted: Stage;
  total: Stage;
  lostCount: number;
  loading: boolean;
  activeStage: StageKey | null;
  onSelectStage: (stage: StageKey) => void;
}

export default function PipelineFlow({ draft, sent, accepted, total, lostCount, loading, activeStage, onSelectStage }: PipelineFlowProps) {
  const sentOrLater = sent.count + accepted.count;
  const winRate = sentOrLater > 0 ? Math.round((accepted.count / sentOrLater) * 100) : null;

  return (
    <section className="sq-flow-card" aria-label="Quotation pipeline">
      <div className="sq-flow-card__label">
        <span className="sq-flow-card__eyebrow">Pipeline</span>
        <span className="sq-flow-card__total">
          {loading ? 'Refreshing…' : (
            <>
              {total.count} quotes worth <strong>{INR.format(total.value)}</strong>
              {lostCount > 0 && <span className="sq-flow-card__lost">· {lostCount} rejected/expired</span>}
            </>
          )}
        </span>
      </div>
      <div className="sq-flow">
        <button
          type="button"
          className={`sq-flow-node sq-flow-node--draft ${activeStage === 'draft' ? 'active' : ''}`}
          onClick={() => onSelectStage('draft')}
        >
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : draft.count}</span>
          <span className="sq-flow-node__label">Draft</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(draft.value)}</span>
        </button>
        <div className="sq-flow-conn">
          <span className="sq-flow-conn__meta">awaiting send</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <line x1="0" y1="5" x2="100" y2="5" />
          </svg>
        </div>
        <button
          type="button"
          className={`sq-flow-node sq-flow-node--sent ${activeStage === 'sent' ? 'active' : ''}`}
          onClick={() => onSelectStage('sent')}
        >
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : sent.count}</span>
          <span className="sq-flow-node__label">Sent</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(sent.value)}</span>
        </button>
        <div className="sq-flow-conn sq-flow-conn--live">
          <span className="sq-flow-conn__meta">{winRate === null ? 'converting' : `${winRate}% win rate`}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <line x1="0" y1="5" x2="100" y2="5" />
          </svg>
        </div>
        <button
          type="button"
          className={`sq-flow-node sq-flow-node--accepted ${activeStage === 'accepted' ? 'active' : ''}`}
          onClick={() => onSelectStage('accepted')}
        >
          <span className="sq-flow-node__dot" />
          <span className="sq-flow-node__count">{loading ? '—' : accepted.count}</span>
          <span className="sq-flow-node__label">Accepted</span>
          <span className="sq-flow-node__value">{loading ? '' : INR.format(accepted.value)}</span>
        </button>
      </div>
    </section>
  );
}
