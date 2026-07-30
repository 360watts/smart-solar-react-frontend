import React, { useEffect, useState } from 'react';
import { DollarSign, Edit3, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { apiService, SiteSavingsData, UpdateSavingsRecordPayload } from '../../services/api';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'due', label: 'Due' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

interface Props {
  siteId: string;
}

export default function SavingsBillingEditor({ siteId }: Props) {
  const [data, setData] = useState<SiteSavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [ebBill, setEbBill] = useState('');
  const [investment, setInvestment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('due');
  const [showDataQuality, setShowDataQuality] = useState(false);

  const syncFields = (d: SiteSavingsData) => {
    setEbBill(d.electricityBill.amount != null ? String(d.electricityBill.amount) : '');
    setInvestment(d.investment.upfrontAmount != null ? String(d.investment.upfrontAmount) : '');
    setPaymentStatus(d.electricityBill.status || 'due');
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getSiteSavings(siteId);
      setData(res);
      syncFields(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load savings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [siteId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: UpdateSavingsRecordPayload = {};
      if (ebBill !== '') payload.eb_bill_amount = parseFloat(ebBill);
      if (investment !== '') payload.upfront_investment = parseFloat(investment);
      payload.payment_status = paymentStatus;
      const res = await apiService.updateSavingsRecord(siteId, payload);
      setData(res);
      syncFields(res);
      setEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (data) syncFields(data);
    setSaveError(null);
    setEditing(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const container: React.CSSProperties = {
    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
    background: '#09111E',
    border: '1px solid rgba(233,185,73,0.18)',
    borderRadius: 4,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  };

  const badge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#E9B949',
    background: 'rgba(233,185,73,0.1)',
    border: '1px solid rgba(233,185,73,0.3)',
    borderRadius: 2,
    padding: '3px 8px',
  };

  const pulse: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#E9B949',
    animation: 'sbe-pulse 1.8s ease-in-out infinite',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  };

  const valueAmt: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 400,
    color: '#E9B949',
    letterSpacing: '-0.01em',
  };

  const valueMuted: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
  };

  const divider: React.CSSProperties = {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '16px 0',
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(233,185,73,0.35)',
    borderRadius: 2,
    color: '#E9B949',
    fontSize: '0.95rem',
    padding: '6px 10px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer',
    appearance: 'none' as const,
  };

  const btnPrimary: React.CSSProperties = {
    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: '#E9B949',
    color: '#09111E',
    border: 'none',
    borderRadius: 2,
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  };

  const btnGhost: React.CSSProperties = {
    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 2,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const statusColor = (s: string) => s === 'paid' ? '#2FBF71' : s === 'overdue' ? '#E55A5A' : '#E9B949';

  const confidencePill = (dq: SiteSavingsData['data_quality']): { label: string; color: string } | null => {
    if (!dq) return null;
    if (dq.coverage_pct < 80) return { label: 'Low data coverage', color: '#E55A5A' };
    if (dq.estimate_status === 'reconciled') return { label: 'Reconciled', color: '#2FBF71' };
    if (dq.estimate_status === 'estimated') return { label: 'Estimated', color: '#E9B949' };
    return null;
  };

  const pillStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color,
    background: `${color}1A`,
    border: `1px solid ${color}4D`,
    borderRadius: 2,
    padding: '3px 8px',
    textTransform: 'uppercase' as const,
  });

  const variancePercent = (estimate: number, actual: number) => ((actual - estimate) / estimate) * 100;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes sbe-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <div style={container}>
        {/* Subtle corner accent */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 60, height: 60,
          background: 'radial-gradient(circle at top right, rgba(233,185,73,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign size={14} color="#E9B949" strokeWidth={2.5} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' as const }}>
              Savings &amp; Billing
            </span>
            <span style={badge}>
              <span style={pulse} />
              MANUAL ENTRY
            </span>
          </div>
          {!editing && !loading && !error && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnGhost} onClick={load} title="Refresh" disabled={loading}>
                <RefreshCw size={13} />
              </button>
              <button style={btnGhost} onClick={() => setEditing(true)}>
                <Edit3 size={13} /> Edit
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', padding: '12px 0' }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E55A5A', fontSize: '0.82rem', padding: '8px 0' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Billing period */}
            <div style={{ marginBottom: 14 }}>
              <div style={sectionLabel}>Billing Period</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                <div style={{ ...valueMuted, fontSize: '0.82rem' }}>{data.electricityBill.period}</div>
                {data.data_quality && confidencePill(data.data_quality) && (
                  <span style={pillStyle(confidencePill(data.data_quality)!.color)}>
                    {confidencePill(data.data_quality)!.label}
                  </span>
                )}
                {data.data_quality && (
                  <button
                    type="button"
                    style={{ ...btnGhost, padding: '2px 8px', fontSize: '0.62rem' }}
                    onClick={() => setShowDataQuality(v => !v)}
                  >
                    {showDataQuality ? 'Hide details' : 'Data quality'}
                  </button>
                )}
              </div>

              {showDataQuality && data.data_quality && (
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  <div>Coverage: {fmt(data.data_quality.coverage_pct, 1)}%</div>
                  <div>{data.data_quality.days_with_data} / {data.data_quality.days_in_period} days with data</div>
                  <div>Source: {data.data_quality.source}</div>
                  <div>Bill is {data.data_quality.estimate_status}. Lower coverage means the estimate is less reliable.</div>
                </div>
              )}

              {data.electricityBill.estimateAmount != null && data.electricityBill.actualAmount != null && (
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                  Est. was ₹{fmt(data.electricityBill.estimateAmount)} · actual ₹{fmt(data.electricityBill.actualAmount)} (
                  {(() => {
                    const v = variancePercent(data.electricityBill.estimateAmount!, data.electricityBill.actualAmount!);
                    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
                  })()}
                  )
                </div>
              )}
            </div>

            <div style={divider} />

            {/* Energy snapshot */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Solar Gen', val: `${fmt(data.consumption.solarUnits, 1)} kWh` },
                { label: 'EB Import', val: `${fmt(data.consumption.ebImportUnits, 1)} kWh` },
                { label: 'EB Export', val: `${fmt(data.consumption.ebExportUnits, 1)} kWh` },
                { label: 'EV Units', val: `${fmt(data.consumption.evUnits, 1)} kWh` },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={sectionLabel}>{label}</div>
                  <div style={{ ...valueMuted, fontSize: '0.8rem' }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={divider} />

            {/* Financial figures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={sectionLabel}>Bill Without Solar</div>
                <div style={valueAmt}>₹{fmt(data.savings.billWithoutSolar)}</div>
              </div>
              <div>
                <div style={sectionLabel}>Calculated Savings</div>
                <div style={{ ...valueAmt, color: '#2FBF71' }}>₹{fmt(data.savings.savingsAmount)}</div>
              </div>
              <div>
                <div style={sectionLabel}>Savings %</div>
                <div style={valueMuted}>{fmt(data.savings.savingsPercentage, 1)}%</div>
              </div>
              <div>
                <div style={sectionLabel}>Break-even</div>
                <div style={valueMuted}>
                  {data.investment.monthsToBreakEven > 0
                    ? `${data.investment.monthsToBreakEven} months`
                    : data.investment.breakEvenDate || '—'}
                </div>
              </div>
            </div>

            <div style={divider} />

            {/* Editable fields */}
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={sectionLabel}>EB Bill Amount (₹)</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inputStyle}
                    value={ebBill}
                    onChange={e => setEbBill(e.target.value)}
                    placeholder="Actual EB bill from TANGEDCO"
                  />
                </div>
                <div>
                  <div style={sectionLabel}>Upfront Investment (₹)</div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={inputStyle}
                    value={investment}
                    onChange={e => setInvestment(e.target.value)}
                    placeholder="System installation cost"
                  />
                </div>
                <div>
                  <div style={sectionLabel}>Payment Status</div>
                  <select style={selectStyle} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                    {PAYMENT_STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {saveError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E55A5A', fontSize: '0.8rem' }}>
                    <AlertCircle size={13} /> {saveError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                    <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button style={btnGhost} onClick={handleCancel} disabled={saving}>
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={sectionLabel}>EB Bill Amount</div>
                  <div style={valueMuted}>
                    {data.electricityBill.amount > 0 ? `₹${fmt(data.electricityBill.amount)}` : '— (not entered)'}
                  </div>
                </div>
                <div>
                  <div style={sectionLabel}>Upfront Investment</div>
                  <div style={valueAmt}>₹{fmt(data.investment.upfrontAmount)}</div>
                </div>
                <div>
                  <div style={sectionLabel}>Cumulative Savings</div>
                  <div style={{ ...valueAmt, color: '#2FBF71' }}>₹{fmt(data.investment.savedAmount)}</div>
                </div>
                <div>
                  <div style={sectionLabel}>Payment Status</div>
                  <div style={{ ...valueMuted, color: statusColor(data.electricityBill.status), fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                    {data.electricityBill.status}
                  </div>
                </div>
              </div>
            )}

            {/* Tariff footnote */}
            <div style={{ marginTop: 16, fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>
              Pending Setu BBPS integration for EB bill auto-fetch
            </div>
          </>
        )}
      </div>
    </>
  );
}
