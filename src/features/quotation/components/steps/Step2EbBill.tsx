import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Plus, Trash2, Activity, TrendingUp, Zap, Sun } from 'lucide-react';
import { calcEbBill, formatINR } from '../../utils/roiCalculator';
import type { QuotationData } from '../../types/quotation';

interface Props { form: UseFormReturn<QuotationData> }

export function Step2EbBill({ form }: Props) {
  const { register, watch, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'ebBill.readings' });
  const ebBillData = watch('ebBill');
  const calc = calcEbBill(ebBillData);

  const METRICS = [
    { key: 'avgBimonthlyKwh',       label: 'Avg Bi-monthly', sub: `${calc.avgDailyKwh.toFixed(1)} kWh/day`, unit: 'kWh', val: Math.round(calc.avgBimonthlyKwh), Icon: Activity,  color: 'var(--blue, #3b82f6)'    },
    { key: 'tangedcoBill',           label: 'TANGEDCO Bill',  sub: 'bi-monthly avg',                          unit: '',    val: formatINR(calc.tangedcoBill),       Icon: TrendingUp, color: 'var(--amber, #f59e0b)'  },
    { key: 'annualSaving',           label: 'Annual Saving',  sub: 'estimated / year',                        unit: '',    val: formatINR(calc.annualSaving),        Icon: Zap,        color: 'var(--green, #00a63e)'   },
    { key: 'recommendedSystemKw',    label: 'System Size',    sub: `${isNaN(calc.recommendedSystemKw) ? 0 : calc.recommendedSystemKw} kWp DC`,  unit: 'kW', val: isNaN(calc.inverterKw) ? 0 : calc.inverterKw, Icon: Sun, color: 'var(--green, #00a63e)' },
  ] as const;

  return (
    <div className="sq-stack">

      {/* Readings table */}
      <div className="sq-field">
        <label className="sq-label" style={{ marginBottom: 10 }}>EB Bill Readings — Bi-monthly</label>
        <div className="sq-table-wrap">
          <table className="sq-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="right">Units (kWh)</th>
                <th className="right">Bill Amount (₹)</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <tr key={field.id}>
                  <td style={{ padding: '5px 8px' }}>
                    <input
                      className="sq-bom-input"
                      style={{ fontFamily: 'var(--sq-sans)', fontSize: '0.82rem' }}
                      placeholder="May 2026"
                      {...register(`ebBill.readings.${idx}.period`)}
                    />
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <input
                      type="number" min={0}
                      className="sq-bom-input mono"
                      placeholder="0"
                      {...register(`ebBill.readings.${idx}.units`, { valueAsNumber: true })}
                    />
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <input
                      type="number" min={0}
                      className="sq-bom-input mono"
                      placeholder="0"
                      {...register(`ebBill.readings.${idx}.billAmount`, { valueAsNumber: true })}
                    />
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="sq-icon-btn"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      style={{ opacity: fields.length <= 1 ? 0.3 : 1 }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fields.length < 6 && (
          <button
            type="button"
            className="sq-add-btn"
            onClick={() => append({ period: '', units: 0, billAmount: 0 })}
          >
            <Plus style={{ width: 11, height: 11 }} />
            Add Reading
          </button>
        )}
      </div>

      {/* Live metric cards */}
      <div className="sq-metrics">
        {METRICS.map(m => (
          <div key={m.key} className="sq-metric" style={{ '--c': m.color } as React.CSSProperties}>
            <div className="sq-metric-icon">
              <m.Icon style={{ width: 13, height: 13 }} />
            </div>
            <div className="sq-metric-label">{m.label}</div>
            <div className="sq-metric-value">
              {m.val}
              {m.unit && (
                <span style={{ fontSize: '0.62rem', fontWeight: 400, marginLeft: 4, color: 'var(--sq-muted)' }}>
                  {m.unit}
                </span>
              )}
            </div>
            <div className="sq-metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Phase selection */}
      <div className="sq-field" style={{ marginBottom: 4 }}>
        <label className="sq-label">Supply Phase</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {(['single', 'three'] as const).map(p => (
            <label
              key={p}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${watch('ebBill.phase') === p ? 'var(--green, #00a63e)' : 'var(--line-2, rgba(0,0,0,0.14))'}`,
                background: watch('ebBill.phase') === p ? 'var(--green-soft, rgba(0,166,62,0.08))' : 'var(--card, #ffffff)',
                fontSize: '0.75rem',
                fontFamily: 'var(--mono)',
                color: watch('ebBill.phase') === p ? 'var(--green, #00a63e)' : 'var(--fg-muted, #64748b)',
                transition: 'all 0.15s',
              }}
            >
              <input type="radio" value={p} {...register('ebBill.phase')} style={{ display: 'none' }} />
              {p === 'single' ? 'Single Phase' : 'Three Phase'}
            </label>
          ))}
        </div>
        <p className="sq-hint">Determines inverter type and DCDB/ACDB selection</p>
      </div>

      {/* PSH + DC/AC ratio */}
      <div className="sq-grid-3">
        <div className="sq-field">
          <label className="sq-label">Peak Sun Hours (h/day)</label>
          <input
            type="number" step="0.1" min={1} max={8}
            className="sq-input sq-input-mono"
            {...register('ebBill.peakSunHours', { valueAsNumber: true })}
          />
          <p className="sq-hint">Default 4.5 h — Coimbatore avg</p>
        </div>
        <div className="sq-field">
          <label className="sq-label">DC/AC Ratio</label>
          <input
            type="number" step="0.05" min={0.8} max={2}
            className="sq-input sq-input-mono"
            {...register('ebBill.dcAcRatio', { valueAsNumber: true })}
          />
          <p className="sq-hint">1.1 normal · 1.25 with EV</p>
        </div>
        <div className="sq-field">
          <label className="sq-label">Power Factor (PF)</label>
          <input
            type="number" step="0.01" min={0.5} max={1}
            className="sq-input sq-input-mono"
            {...register('ebBill.powerFactor', { valueAsNumber: true })}
          />
          <p className="sq-hint">1.0 for resistive loads (default)</p>
        </div>
      </div>

    </div>
  );
}
