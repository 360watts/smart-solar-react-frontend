import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { calcBomRow, calcBomTotals, calcEbBill, formatINR } from '../../utils/roiCalculator';
import { apiService } from '../../../../services/api';
import type { ProductCatalogItem } from '../../../../services/api';
import type { QuotationData, BomRow } from '../../types/quotation';

interface Props { form: UseFormReturn<QuotationData> }

const DEFAULT_ROWS: Omit<BomRow, 'id'>[] = [
  { item: 'Panels',             brand: '',          description: '615Wp TOPCon',                qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 5  },
  { item: 'Inverter',           brand: '',          description: '12kW 3-ph String',             qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 5  },
  { item: 'DCDB',               brand: '',          description: '',                              qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'ACDB',               brand: '',          description: '',                              qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Mounting structure', brand: '',          description: 'GI Steel',                     qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Earthing rod',       brand: '',          description: '2m',                           qty: 3,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Lightning arrestor', brand: '',          description: '1m',                           qty: 1,  unitPrice: 0, marginPct: 0,   gstPct: 18 },
  { item: 'MC4 connectors',     brand: '',          description: '',                              qty: 12, unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Accessories',        brand: '',          description: 'Pins & misc',                  qty: 1,  unitPrice: 0, marginPct: 25,  gstPct: 18 },
  { item: 'Installation',       brand: '',          description: 'Design / install / logistics', qty: 1,  unitPrice: 0, marginPct: 25,  gstPct: 18 },
  { item: 'IoT hub',            brand: '360Watts',  description: 'Energy automation',            qty: 1,  unitPrice: 0, marginPct: 100, gstPct: 18 },
  { item: 'Wiring',             brand: '',          description: 'DC + AC cables',               qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
];

export function newRows(): BomRow[] {
  return DEFAULT_ROWS.map(r => ({ ...r, id: uuid() }));
}

// ── Catalog selector ──────────────────────────────────────────────────────

interface CatalogSelectorProps {
  category: 'panels' | 'inverters';
  onSelect: (item: ProductCatalogItem) => void;
  recommendedKw?: number;
}

function pickBestPanel(items: ProductCatalogItem[]): ProductCatalogItem | undefined {
  const inStock = items.filter(i => i.in_stock !== false);
  const pool = inStock.length ? inStock : items;
  return pool.reduce<ProductCatalogItem | undefined>((best, cur) => {
    const curWp = (cur.specs.wp as number) ?? 0;
    const bestWp = best ? ((best.specs.wp as number) ?? 0) : -1;
    return curWp > bestWp ? cur : best;
  }, undefined);
}

function pickBestInverter(items: ProductCatalogItem[], recommendedKw: number): ProductCatalogItem | undefined {
  const inStock = items.filter(i => i.in_stock !== false);
  const pool = inStock.length ? inStock : items;
  // Prefer exact match, then next size up
  const sorted = [...pool].sort((a, b) => ((a.specs.kw as number) ?? 0) - ((b.specs.kw as number) ?? 0));
  return sorted.find(i => ((i.specs.kw as number) ?? 0) >= recommendedKw) ?? sorted[sorted.length - 1];
}

function CatalogSelector({ category, onSelect, recommendedKw = 0 }: CatalogSelectorProps) {
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const autoSelected = useRef(false);

  useEffect(() => {
    apiService.getProductCatalog(category)
      .then(fetched => {
        setItems(fetched);
        if (!autoSelected.current && fetched.length > 0) {
          autoSelected.current = true;
          const best = category === 'panels'
            ? pickBestPanel(fetched)
            : pickBestInverter(fetched, recommendedKw);
          if (best) {
            setSelectedId(String(best.id));
            onSelect(best);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = category === 'panels' ? 'Panel' : 'Inverter';
  const placeholder = loading ? 'Loading…' : items.length === 0 ? 'No catalog items' : `Pick ${label.toLowerCase()}…`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <select
        className="sq-bom-input"
        style={{ fontSize: '0.7rem', minWidth: 260 }}
        value={selectedId}
        disabled={loading || items.length === 0}
        onChange={e => {
          const id = e.target.value;
          setSelectedId(id);
          const item = items.find(i => String(i.id) === id);
          if (item) onSelect(item);
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {items.map(item => (
          <option key={item.id} value={String(item.id)}>
            {item.display_label}
            {item.in_stock ? '' : ' ✗ OOS'}
            {' — '}
            {item.price_unit === 'Wp'
              ? `₹${item.price_per_unit}/Wp`
              : `₹${Number(item.price_per_unit).toLocaleString('en-IN')}`}
            {item.dealer_name ? ` (${item.dealer_name})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── BomTable ───────────────────────────────────────────────────────────────

function BomTable({ prefix, form }: { prefix: 'optionA' | 'optionB'; form: UseFormReturn<QuotationData> }) {
  const { register, watch, control, setValue } = form;
  const ebBill = form.getValues('ebBill');
  const { inverterKw } = calcEbBill(ebBill);
  const { fields, append, remove } = useFieldArray({ control, name: `${prefix}.rows` as any });
  const liveRows: BomRow[] = watch(`${prefix}.rows`) ?? [];
  const subsidy: number    = watch(`${prefix}.subsidy`) ?? 78000;
  const { grossTotal, netInvestment } = calcBomTotals(liveRows, subsidy);
  const isRecommended: boolean   = watch(`${prefix}.isRecommended`);
  const expansionPossible: boolean = watch(`${prefix}.expansionPossible`);

  function applyPanelFromCatalog(item: ProductCatalogItem) {
    const rows: BomRow[] = form.getValues(`${prefix}.rows`);
    const wp = item.specs.wp as number ?? 0;
    // price per panel = Wp × price_per_Wp
    const unitPrice = item.price_unit === 'Wp' ? wp * parseFloat(item.price_per_unit) : parseFloat(item.price_per_unit);
    const description = `${wp}Wp ${item.model_name} ${item.specs.dcr ? 'DCR' : 'non-DCR'}`.trim();
    const updated = rows.map(r =>
      r.item.toLowerCase() === 'panels'
        ? { ...r, brand: item.brand, description, unitPrice, marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct) }
        : r
    );
    setValue(`${prefix}.rows`, updated);
  }

  function applyInverterFromCatalog(item: ProductCatalogItem) {
    const rows: BomRow[] = form.getValues(`${prefix}.rows`);
    const kw = item.specs.kw as number ?? '';
    const phases = item.specs.phases as number ?? 1;
    const type = item.specs.type as string ?? 'On-Grid';
    const description = `${kw}kW ${phases === 3 ? '3-ph' : '1-ph'} ${type}`;
    const unitPrice = parseFloat(item.price_per_unit);
    const updated = rows.map(r =>
      r.item.toLowerCase() === 'inverter'
        ? { ...r, brand: item.brand, description, unitPrice, marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct) }
        : r
    );
    setValue(`${prefix}.rows`, updated);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Catalog selectors */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CatalogSelector category="panels"    onSelect={applyPanelFromCatalog} />
        <CatalogSelector category="inverters" onSelect={applyInverterFromCatalog} recommendedKw={inverterKw} />
      </div>

      <div className="sq-table-wrap">
        <table className="sq-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Item</th>
              <th style={{ width: 90 }}>Brand</th>
              <th style={{ width: 140 }}>Description</th>
              <th className="right" style={{ width: 52 }}>Qty</th>
              <th className="right" style={{ width: 96 }}>Unit ₹</th>
              <th className="right" style={{ width: 62 }}>Mgn%</th>
              <th className="right" style={{ width: 52 }}>GST%</th>
              <th className="right" style={{ width: 100 }}>Final ₹</th>
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {(fields as unknown as BomRow[]).map((field, idx) => {
              const liveRow: BomRow = liveRows[idx] ?? field;
              const finalCost = calcBomRow(liveRow);
              return (
                <tr key={field.id}>
                  <td><input className="sq-bom-input" style={{ minWidth: 80 }} {...register(`${prefix}.rows.${idx}.item`)} /></td>
                  <td><input className="sq-bom-input" style={{ minWidth: 60 }} {...register(`${prefix}.rows.${idx}.brand`)} /></td>
                  <td><input className="sq-bom-input" style={{ minWidth: 100 }} {...register(`${prefix}.rows.${idx}.description`)} /></td>
                  <td><input type="number" min={0} className="sq-bom-input mono" style={{ minWidth: 40 }} {...register(`${prefix}.rows.${idx}.qty`, { valueAsNumber: true })} /></td>
                  <td><input type="number" min={0} className="sq-bom-input mono" style={{ minWidth: 72 }} {...register(`${prefix}.rows.${idx}.unitPrice`, { valueAsNumber: true })} /></td>
                  <td><input type="number" min={0} max={500} className="sq-bom-input mono" style={{ minWidth: 46 }} {...register(`${prefix}.rows.${idx}.marginPct`, { valueAsNumber: true })} /></td>
                  <td><input type="number" min={0} max={28} className="sq-bom-input mono" style={{ minWidth: 40 }} {...register(`${prefix}.rows.${idx}.gstPct`, { valueAsNumber: true })} /></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: finalCost > 0 ? 'var(--fg, #0f172a)' : 'var(--fg-muted, #64748b)', paddingRight: 8 }}>
                    {finalCost > 0 ? formatINR(finalCost) : '—'}
                  </td>
                  <td style={{ paddingRight: 6 }}>
                    <button type="button" className="sq-icon-btn" onClick={() => remove(idx)}>
                      <Trash2 style={{ width: 11, height: 11 }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ textAlign: 'right', color: 'var(--fg-muted, #64748b)', fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Gross Total
              </td>
              <td style={{ textAlign: 'right', color: 'var(--fg, #0f172a)', fontWeight: 600, paddingRight: 8 }}>
                {formatINR(grossTotal)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} style={{ color: 'var(--fg-muted, #64748b)', fontSize: '0.65rem' }}>PM Surya Ghar Subsidy</td>
              <td colSpan={2} style={{ textAlign: 'right', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 8 }}>
                − {formatINR(subsidy)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={7} style={{ textAlign: 'right', color: 'var(--amber, #f59e0b)', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                Net Investment
              </td>
              <td style={{ textAlign: 'right', color: 'var(--amber, #f59e0b)', fontSize: '1rem', fontWeight: 700, paddingRight: 8 }}>
                {formatINR(Math.max(0, netInvestment))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        className="sq-add-btn"
        onClick={() => append({ id: uuid(), item: '', brand: '', description: '', qty: 1, unitPrice: 0, marginPct: 20, gstPct: 18 })}
      >
        <Plus style={{ width: 11, height: 11 }} />
        Add Row
      </button>

      {/* Options row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', paddingTop: 4 }}>
        {/* Subsidy */}
        <div className="sq-field">
          <label className="sq-label">Subsidy (₹)</label>
          <input
            type="number" min={0}
            className="sq-input sq-input-mono"
            style={{ width: 130 }}
            {...register(`${prefix}.subsidy`, { valueAsNumber: true })}
          />
        </div>

        {/* Recommended toggle */}
        <button
          type="button"
          style={{ marginTop: 20 }}
          onClick={() => form.setValue(`${prefix}.isRecommended`, !isRecommended)}
          className={`sq-toggle ${isRecommended ? 'on-yellow' : ''}`}
        >
          {isRecommended
            ? <ToggleRight style={{ width: 15, height: 15 }} />
            : <ToggleLeft  style={{ width: 15, height: 15 }} />
          }
          Recommended
        </button>

        {/* Expansion toggle */}
        <button
          type="button"
          style={{ marginTop: 20 }}
          onClick={() => form.setValue(`${prefix}.expansionPossible`, !expansionPossible)}
          className={`sq-toggle ${expansionPossible ? 'on-green' : ''}`}
        >
          {expansionPossible
            ? <ToggleRight style={{ width: 15, height: 15 }} />
            : <ToggleLeft  style={{ width: 15, height: 15 }} />
          }
          Expansion Possible
        </button>
      </div>

      {/* Notes row */}
      <div className="sq-grid-2">
        <div className="sq-field">
          <label className="sq-label">Not Included</label>
          <textarea
            className="sq-textarea"
            rows={3}
            placeholder={'Civil works\nTANGEDCO payment\nReflective paints'}
            style={{ fontSize: '0.78rem' }}
            {...register(`${prefix}.notIncluded`)}
          />
        </div>
        <div className="sq-field">
          <label className="sq-label">Factors Note</label>
          <textarea
            className="sq-textarea"
            rows={3}
            placeholder="Consumption pattern May 2025 – May 2026"
            style={{ fontSize: '0.78rem' }}
            {...register(`${prefix}.factorsNote`)}
          />
        </div>
      </div>

    </div>
  );
}

export function Step3Bom({ form }: Props) {
  const { watch, setValue } = form;
  const hasOptionB = watch('optionB') !== null;

  function toggleOptionB() {
    if (hasOptionB) {
      setValue('optionB', null);
    } else {
      setValue('optionB', {
        rows: newRows(),
        subsidy: 78000,
        isRecommended: false,
        expansionPossible: false,
        notIncluded: 'Civil works\nTANGEDCO payment for sanctioned load extension + solar net meter\nReflective paints',
        factorsNote: '',
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Option A */}
      <div>
        <div className="sq-section-title">
          Option A
          <span className="sq-badge sq-badge-green">Primary</span>
        </div>
        <BomTable prefix="optionA" form={form} />
      </div>

      {/* Option B toggle */}
      <div style={{ borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', paddingTop: 16 }}>
        <button
          type="button"
          onClick={toggleOptionB}
          className={`sq-toggle ${hasOptionB ? 'on-blue' : ''}`}
          style={hasOptionB ? { borderColor: 'rgba(91,155,213,0.3)', background: 'rgba(91,155,213,0.06)', color: 'var(--blue, #3b82f6)' } : {}}
        >
          {hasOptionB
            ? <ToggleRight style={{ width: 15, height: 15 }} />
            : <ToggleLeft  style={{ width: 15, height: 15 }} />
          }
          {hasOptionB ? 'Option B Enabled' : 'Add Option B'}
        </button>
      </div>

      {hasOptionB && (
        <div>
          <div className="sq-section-title">
            Option B
            <span className="sq-badge sq-badge-blue">Alternate</span>
          </div>
          <BomTable prefix="optionB" form={form} />
        </div>
      )}

    </div>
  );
}
