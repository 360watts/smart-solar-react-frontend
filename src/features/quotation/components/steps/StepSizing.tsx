import { useEffect, useRef } from 'react';
import { useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { Plus, Trash2, Activity, TrendingUp, Zap, Sun, Undo2, Pencil } from 'lucide-react';
import { calcEbBill, calcEvSizing, formatINR, getEffectiveSystemKw } from '../../utils/roiCalculator';
import { newOptionB } from './StepBom';
import type { EvSizingData, QuotationData } from '../../types/quotation';

interface Props {
  form: UseFormReturn<QuotationData>;
  autofillBomQuantities: () => void;
}

const PANEL_WP = 615;
const DIAL_R = 44;
const DIAL_C = 2 * Math.PI * DIAL_R;

const EV_PRESETS: Record<'none' | 'occasional' | 'daily', EvSizingData> = {
  none:       { modelName: '',                      batteryCapacityKwh: 0,  fullChargesPerWeek: 0, halfChargesPerWeek: 0 },
  occasional: { modelName: 'Occasional EV charging', batteryCapacityKwh: 40, fullChargesPerWeek: 0, halfChargesPerWeek: 2 },
  daily:      { modelName: 'Daily EV charging',      batteryCapacityKwh: 40, fullChargesPerWeek: 5, halfChargesPerWeek: 0 },
};

function evPresetKey(ev: EvSizingData | undefined): 'none' | 'occasional' | 'daily' {
  if (!ev) return 'none';
  const match = (Object.keys(EV_PRESETS) as (keyof typeof EV_PRESETS)[]).find(key => {
    const p = EV_PRESETS[key];
    return p.batteryCapacityKwh === ev.batteryCapacityKwh
      && p.fullChargesPerWeek === ev.fullChargesPerWeek
      && p.halfChargesPerWeek === ev.halfChargesPerWeek;
  });
  return match ?? 'none';
}

export function StepSizing({ form, autofillBomQuantities }: Props) {
  const { register, control, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'ebBill.readings' });
  const psh       = useWatch({ control, name: 'ebBill.peakSunHours' });
  const pf        = useWatch({ control, name: 'ebBill.powerFactor' });
  const dcAcRatio = useWatch({ control, name: 'ebBill.dcAcRatio' });
  const phase     = useWatch({ control, name: 'ebBill.phase' });
  const customerType = useWatch({ control, name: 'customer.customerType' });
  const readings  = useWatch({ control, name: 'ebBill.readings' });
  const evSizing  = useWatch({ control, name: 'ebBill.evSizing' });
  const systemSizeOverrideKw = useWatch({ control, name: 'ebBill.systemSizeOverrideKw' });
  const ebBillData = { peakSunHours: psh, powerFactor: pf, dcAcRatio, phase, readings: readings ?? [], evSizing, systemSizeOverrideKw };
  const calc = calcEbBill(ebBillData);
  const evCalc = calcEvSizing(ebBillData);
  const isSystemSizeOverridden = systemSizeOverrideKw != null;
  const effectiveSystemKw = getEffectiveSystemKw(ebBillData, calc);
  const selectedEvPreset = evPresetKey(evSizing);

  const METRICS = [
    { key: 'avgBimonthlyKwh', label: 'Avg Bi-monthly', sub: `${calc.avgDailyKwh.toFixed(1)} kWh/day`, unit: 'kWh', val: Math.round(calc.avgBimonthlyKwh), Icon: Activity,  color: 'var(--blue, #3b82f6)'  },
    { key: 'tangedcoBill',   label: 'TANGEDCO Bill',  sub: 'bi-monthly avg',                          unit: '',    val: formatINR(calc.tangedcoBill),      Icon: TrendingUp, color: 'var(--amber, #f59e0b)' },
    { key: 'annualSaving',   label: 'Annual Saving',  sub: 'rough estimate — refined in Step 4',      unit: '',    val: formatINR(calc.annualSaving),       Icon: Zap,        color: 'var(--green, #00a63e)' },
  ] as const;

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
  }, [readings, psh, pf, dcAcRatio, phase, systemSizeOverrideKw, evSizing]);

  // No separate "home or business" question here — Step 1's Customer Type already
  // asks that. `ebBill.phase` only steers Step 3's catalog auto-suggestion (the rep
  // can still pick a different inverter there), so it's derived, not asked twice.
  useEffect(() => {
    setValue('ebBill.phase', customerType === 'commercial' ? 'three' : 'single');
  }, [customerType, setValue]);

  // The moment EV charging becomes relevant, nudge the two things that make sense of
  // it: flag the base system as "future expansion possible" (it doesn't cover the EV
  // load yet) and stand up Option B as the EV-inclusive alternative — one-shot only,
  // on the none→EV transition, so it never fights a rep who's since turned either off.
  const prevEvPreset = useRef(selectedEvPreset);
  useEffect(() => {
    if (prevEvPreset.current === 'none' && selectedEvPreset !== 'none') {
      setValue('optionA.expansionPossible', true);
      if (form.getValues('optionB') === null) {
        setValue('optionB', newOptionB());
      }
    }
    prevEvPreset.current = selectedEvPreset;
  }, [selectedEvPreset, setValue, form]);

  // Dial scale follows the system itself (rounded up to the next 5 kWp, min 10) so a
  // 40 kWp commercial system doesn't render pinned at "full" the same as a 9 kWp home.
  const dialMaxKw = Math.max(10, Math.ceil(effectiveSystemKw / 5) * 5);
  const dialFrac = Math.min(effectiveSystemKw / dialMaxKw, 1);

  return (
    <div className="sq-stack">

      {/* Readings table */}
      <div className="sq-field">
        <label className="sq-label" style={{ marginBottom: 10 }}>Your last electricity bills</label>
        <div className="sq-table-wrap">
          <table className="sq-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="right">Units used (kWh)</th>
                <th className="right">Amount paid (₹)</th>
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
        <p className="sq-hint">Add as many bills as you have — more history gives a steadier estimate.</p>
      </div>

      {/* EV charging */}
      <div className="sq-field">
        <label className="sq-label">Planning to charge an EV here?</label>
        <div className="sq-ev-pills">
          {(['none', 'occasional', 'daily'] as const).map(key => (
            <button
              key={key}
              type="button"
              className={selectedEvPreset === key ? 'sel' : ''}
              onClick={() => setValue('ebBill.evSizing', EV_PRESETS[key])}
            >
              {key === 'none' ? 'Not right now' : key === 'occasional' ? 'Occasionally' : 'Daily driver'}
            </button>
          ))}
        </div>
        <p className="sq-hint">"Daily driver" sizes in enough extra capacity for a full charge most nights — no battery-kWh math needed.</p>
      </div>

      {/* Recommended system — hero */}
      <div className="sq-hero">
        <div className="sq-hero-label">Recommended solar system</div>
        <div className="sq-hero-dial">
          <svg viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={DIAL_R} fill="none" stroke="var(--line-2, rgba(0,0,0,0.14))" strokeWidth={9} />
            <circle
              cx={50} cy={50} r={DIAL_R} fill="none" stroke="var(--green, #00a63e)" strokeWidth={9}
              strokeLinecap="round" strokeDasharray={DIAL_C} strokeDashoffset={DIAL_C * (1 - dialFrac)}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="sq-hero-dial-value">
            <input
              type="number" step="0.1" min={0} max={100}
              className="sq-hero-dial-input"
              placeholder={String(isNaN(calc.recommendedSystemKw) ? 0 : calc.recommendedSystemKw)}
              {...register('ebBill.systemSizeOverrideKw', { valueAsNumber: true, setValueAs: v => (v === '' || Number.isNaN(v) ? null : v) })}
            />
            <span className="sq-hero-dial-unit">kWp</span>
          </div>
        </div>
        {isSystemSizeOverridden ? (
          <div className="sq-hero-sub">
            auto {isNaN(calc.recommendedSystemKw) ? 0 : calc.recommendedSystemKw} kWp ·{' '}
            <button type="button" className="sq-metric-reset" onClick={() => setValue('ebBill.systemSizeOverrideKw', null)}>
              <Undo2 style={{ width: 10, height: 10 }} /> reset to auto
            </button>
          </div>
        ) : (
          <div className="sq-hero-dial-edit-hint">
            <Pencil style={{ width: 10, height: 10 }} /> tap the number to adjust it
          </div>
        )}
        <div className="sq-hero-stats">
          <div className="sq-hero-stat">
            <div className="k">{Math.ceil((effectiveSystemKw * 1000) / PANEL_WP) || 0}</div>
            <div className="l">Panels ({PANEL_WP} Wp)</div>
          </div>
          {evCalc && (
            <div className="sq-hero-stat">
              <div className="k">{evCalc.recommendedSystemKw} kWp</div>
              <div className="l">With EV charging</div>
            </div>
          )}
        </div>
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

      {/* Advanced sizing inputs */}
      <details className="sq-advanced">
        <summary>Fine-tune the numbers <span className="sq-advanced-tag">Advanced</span></summary>
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
      </details>

    </div>
  );
}
