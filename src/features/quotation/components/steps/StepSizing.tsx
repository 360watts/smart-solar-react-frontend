import { useState, useEffect, useRef } from 'react';
import { useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { Plus, Trash2, Activity, TrendingUp, Zap, Sun, CarFront, X } from 'lucide-react';
import { calcEbBill, calcEvSizing, formatINR } from '../../utils/roiCalculator';
import type { QuotationData } from '../../types/quotation';

interface Props {
  form: UseFormReturn<QuotationData>;
  autofillBomQuantities: () => void;
}

export function StepSizing({ form, autofillBomQuantities }: Props) {
  const { register, watch, control, setValue } = form;
  const [showEvModal, setShowEvModal] = useState(false);
  const { fields, append, remove } = useFieldArray({ control, name: 'ebBill.readings' });
  const psh       = useWatch({ control, name: 'ebBill.peakSunHours' });
  const pf        = useWatch({ control, name: 'ebBill.powerFactor' });
  const dcAcRatio = useWatch({ control, name: 'ebBill.dcAcRatio' });
  const phase     = useWatch({ control, name: 'ebBill.phase' });
  const readings  = useWatch({ control, name: 'ebBill.readings' });
  const evSizing  = useWatch({ control, name: 'ebBill.evSizing' });
  const ebBillData = { peakSunHours: psh, powerFactor: pf, dcAcRatio, phase, readings: readings ?? [], evSizing };
  const calc = calcEbBill(ebBillData);
  const evCalc = calcEvSizing(ebBillData);

  // Debounced live autofill — fires 600ms after any sizing-relevant field settles,
  // so the BoM step (visited next) already has sensible quantities without the rep
  // needing to revisit Sizing. Skips the initial mount so opening this step doesn't
  // itself trigger a fill.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { autofillBomQuantities(); }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings, psh, pf, dcAcRatio, phase]);

  const METRICS = [
    { key: 'avgBimonthlyKwh',       label: 'Avg Bi-monthly', sub: `${calc.avgDailyKwh.toFixed(1)} kWh/day`, unit: 'kWh', val: Math.round(calc.avgBimonthlyKwh), Icon: Activity,  color: 'var(--blue, #3b82f6)'    },
    { key: 'tangedcoBill',           label: 'TANGEDCO Bill',  sub: 'bi-monthly avg',                          unit: '',    val: formatINR(calc.tangedcoBill),       Icon: TrendingUp, color: 'var(--amber, #f59e0b)'  },
    { key: 'annualSaving',           label: 'Annual Saving',  sub: 'estimated / year',                        unit: '',    val: formatINR(calc.annualSaving),        Icon: Zap,        color: 'var(--green, #00a63e)'   },
    { key: 'recommendedSystemKw',    label: 'System Size',    sub: `${isNaN(calc.exactDcKw) ? 0 : calc.exactDcKw} kWp DC raw · ${isNaN(calc.exactAcKw) ? 0 : calc.exactAcKw} kW AC raw`,  unit: 'kWp', val: isNaN(calc.recommendedSystemKw) ? 0 : calc.recommendedSystemKw, Icon: Sun, color: 'var(--green, #00a63e)' },
    {
      key: 'evSystemKw',
      label: evCalc ? 'EV System Size' : 'Future Expansion',
      sub: evCalc
        ? `+${evCalc.extraDailyKwh} kWh/day EV · ${evCalc.exactDcKw} kWp DC total`
        : 'Add EV load when expansion is needed',
      unit: evCalc ? 'kWp' : '',
      val: evCalc ? evCalc.recommendedSystemKw : '',
      Icon: evCalc ? CarFront : Plus,
      color: 'var(--green, #00a63e)',
      interactive: true,
    },
  ] as const;

  function clearEvSizing() {
    setValue('ebBill.evSizing', {
      modelName: '',
      batteryCapacityKwh: 0,
      fullChargesPerWeek: 0,
      halfChargesPerWeek: 0,
    });
  }

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
        {METRICS.map(m => {
          const content = (
            <>
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
            </>
          );

          if ('interactive' in m && m.interactive) {
            return (
              <button
                key={m.key}
                type="button"
                className="sq-metric sq-metric--interactive sq-metric--ev"
                style={{ '--c': m.color } as React.CSSProperties}
                onClick={() => setShowEvModal(true)}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={m.key} className="sq-metric" style={{ '--c': m.color } as React.CSSProperties}>
              {content}
            </div>
          );
        })}
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
                color: watch('ebBill.phase') === p ? 'var(--green, #00a63e)' : 'var(--muted-foreground)',
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

      {showEvModal && (
        <div className="sq-modal-backdrop" onClick={() => setShowEvModal(false)}>
          <div className="sq-modal sq-ev-modal" onClick={e => e.stopPropagation()}>
            <div className="sq-ev-modal__header">
              <div>
                <h3 className="sq-modal-title" style={{ marginBottom: 6 }}>EV Load Sizing</h3>
                <p className="sq-modal-body" style={{ marginBottom: 0 }}>
                  Add charging demand from the workbook inputs to preview a separate EV-inclusive system size.
                </p>
              </div>
              <button type="button" className="sq-ev-modal__close" onClick={() => setShowEvModal(false)}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div className="sq-ev-grid">
              <div className="sq-field">
                <label className="sq-label">EV Model</label>
                <input
                  className="sq-input"
                  placeholder="TATA Nexon"
                  {...register('ebBill.evSizing.modelName')}
                />
              </div>
              <div className="sq-field">
                <label className="sq-label">Battery Capacity (kWh)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="sq-input sq-input-mono"
                  {...register('ebBill.evSizing.batteryCapacityKwh', { valueAsNumber: true })}
                />
              </div>
              <div className="sq-field">
                <label className="sq-label">Full Charges / Week</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="sq-input sq-input-mono"
                  {...register('ebBill.evSizing.fullChargesPerWeek', { valueAsNumber: true })}
                />
              </div>
              <div className="sq-field">
                <label className="sq-label">Half Charges / Week</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="sq-input sq-input-mono"
                  {...register('ebBill.evSizing.halfChargesPerWeek', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="sq-ev-preview">
              <div className="sq-ev-preview__row">
                <span>Extra EV load</span>
                <strong>{evCalc ? `${evCalc.extraDailyKwh} kWh/day` : 'Enter EV details'}</strong>
              </div>
              <div className="sq-ev-preview__row">
                <span>EV system size</span>
                <strong>{evCalc ? `${evCalc.recommendedSystemKw} kWp` : 'Optional add-on'}</strong>
              </div>
              {evCalc && (
                <div className="sq-ev-preview__row">
                  <span>Raw DC / AC total</span>
                  <strong>{`${evCalc.exactDcKw} kWp · ${evCalc.exactAcKw} kW`}</strong>
                </div>
              )}
            </div>

            <div className="sq-modal-actions">
              <button type="button" className="sq-btn-secondary" onClick={clearEvSizing}>
                Clear
              </button>
              <button type="button" className="sq-btn-primary" onClick={() => setShowEvModal(false)}>
                Use EV Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
