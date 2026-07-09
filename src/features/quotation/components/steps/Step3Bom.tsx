import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { calcBomBaseCost, calcBomRow, calcBomTotals, calcEbBill, calcSubsidy, formatINR } from '../../utils/roiCalculator';
import { apiService } from '../../../../services/api';
import type { ProductCatalogItem } from '../../../../services/api';
import type { QuotationData, BomRow } from '../../types/quotation';

interface Props { form: UseFormReturn<QuotationData> }

const DEFAULT_ROWS: Omit<BomRow, 'id'>[] = [
  { item: 'Panels',             brand: '',          description: '615Wp TOPCon',                qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 5,  priceSource: 'manual', priceUnit: 'Wp' },
  { item: 'Inverter',           brand: '',          description: '12kW 3-ph String',             qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 5  },
  { item: 'DCDB',               brand: '',          description: '',                              qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'ACDB',               brand: '',          description: '',                              qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Mounting structure', brand: '',          description: 'GI Steel',                     qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18, priceSource: 'manual', priceUnit: 'rate_per_kw' },
  { item: 'Earthing rod',       brand: '',          description: '2m',                           qty: 3,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Lightning arrestor', brand: '',          description: '1m',                           qty: 1,  unitPrice: 0, marginPct: 0,   gstPct: 18 },
  { item: 'MC4 connectors',     brand: '',          description: '',                              qty: 12, unitPrice: 0, marginPct: 20,  gstPct: 18 },
  { item: 'Accessories',        brand: '',          description: 'Pins & misc',                  qty: 1,  unitPrice: 0, marginPct: 25,  gstPct: 18 },
  { item: 'Installation',       brand: '',          description: 'Design / install / logistics', qty: 1,  unitPrice: 0, marginPct: 25,  gstPct: 18, priceSource: 'manual', priceUnit: 'rate_per_kw' },
  { item: 'IoT hub',            brand: '360Watts',  description: 'Energy automation',            qty: 1,  unitPrice: 0, marginPct: 100, gstPct: 18 },
  { item: 'Wiring',             brand: '',          description: 'DC + AC cables',               qty: 1,  unitPrice: 0, marginPct: 20,  gstPct: 18 },
];

export function newRows(): BomRow[] {
  return DEFAULT_ROWS.map(r => ({ ...r, id: uuid() }));
}

// ── Row item name → catalog category mapping ──────────────────────────────

type CatalogCategory =
  | 'panels' | 'inverters' | 'batteries'
  | 'dcdb' | 'acdb' | 'mounting' | 'earthing'
  | 'lightning' | 'mc4' | 'wiring' | 'accessories'
  | 'installation' | 'iot';

const ITEM_TO_CATEGORY: Record<string, CatalogCategory> = {
  'panels':             'panels',
  'inverter':           'inverters',
  'dcdb':               'dcdb',
  'acdb':               'acdb',
  'mounting structure': 'mounting',
  'earthing rod':       'earthing',
  'lightning arrestor': 'lightning',
  'mc4 connectors':     'mc4',
  'wiring':             'wiring',
  'accessories':        'accessories',
  'installation':       'installation',
  'iot hub':            'iot',
};

const CATEGORY_LABEL: Record<CatalogCategory, string> = {
  panels:       'Panel',
  inverters:    'Inverter',
  batteries:    'Battery',
  dcdb:         'DCDB',
  acdb:         'ACDB',
  mounting:     'Mounting',
  earthing:     'Earthing',
  lightning:    'Lightning',
  mc4:          'MC4',
  wiring:       'Wiring',
  accessories:  'Accessories',
  installation: 'Installation',
  iot:          'IoT Hub',
};

// ── Generic catalog selector ──────────────────────────────────────────────

interface CatalogSelectorProps {
  category: CatalogCategory;
  onSelect: (item: ProductCatalogItem) => void;
  autoPickFn?: (items: ProductCatalogItem[]) => ProductCatalogItem | undefined;
  currentRow?: BomRow | null;
}

function isRowUntouched(row?: BomRow | null) {
  if (!row) return true;
  return !row.brand.trim() && Number(row.unitPrice || 0) <= 0;
}

function matchesCatalogItem(category: CatalogCategory, row: BomRow | null | undefined, item: ProductCatalogItem) {
  if (!row) return false;
  const rowBrand = row.brand.trim().toLowerCase();
  const itemBrand = item.brand.trim().toLowerCase();
  if (rowBrand && rowBrand !== itemBrand) return false;

  const rowDescription = row.description.trim().toLowerCase();
  const modelName = (item.model_name ?? '').trim().toLowerCase();

  if (category === 'panels') {
    const rowWp = rowDescription.match(/(\d+)\s*[Ww]p/)?.[1];
    const itemWp = String((item.specs.wp as number) ?? '');
    return (!rowWp || rowWp === itemWp) && (!!rowBrand || rowDescription.includes(modelName));
  }

  if (category === 'inverters') {
    const rowKw = rowDescription.match(/(\d+(?:\.\d+)?)\s*[Kk][Ww]/)?.[1];
    const itemKw = String((item.specs.kw as number) ?? '');
    return (!rowKw || rowKw === itemKw) && (!!rowBrand || rowDescription.includes(modelName));
  }

  return rowDescription ? rowDescription.includes(modelName) || modelName.includes(rowDescription) : rowBrand === itemBrand;
}

function CatalogSelector({ category, onSelect, autoPickFn, currentRow }: CatalogSelectorProps) {
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');
  const autoSelected = useRef(false);

  useEffect(() => {
    apiService.getProductCatalog(category)
      .then(fetched => {
        setItems(fetched);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    if (!items.length) return;
    const matched = items.find(item => matchesCatalogItem(category, currentRow, item));
    if (matched) {
      autoSelected.current = true;
      setSelectedId(String(matched.id));
      return;
    }
    if (!autoSelected.current && autoPickFn && isRowUntouched(currentRow)) {
      autoSelected.current = true;
      const best = autoPickFn(items);
      if (best) {
        setSelectedId(String(best.id));
        onSelect(best);
      }
      return;
    }
    if (!currentRow || isRowUntouched(currentRow)) setSelectedId('');
  }, [items, category, currentRow, autoPickFn, onSelect]);

  const label = CATEGORY_LABEL[category];
  const filtered = query.trim()
    ? items.filter(i =>
        (i.display_label || i.model_name).toLowerCase().includes(query.toLowerCase()) ||
        i.brand.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  return (
    <div className="sq-catalog-selector">
      {/* Header row: label + search */}
      <div className="sq-catalog-header">
        <span className="sq-catalog-label">{label}</span>
        <input
          className="sq-catalog-search"
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading || items.length === 0}
        />
      </div>
      {/* Dropdown */}
      <select
        className="sq-catalog-select"
        value={selectedId}
        disabled={loading || items.length === 0}
        onChange={e => {
          const id = e.target.value;
          setSelectedId(id);
          const item = items.find(i => String(i.id) === id);
          if (item) { onSelect(item); setQuery(''); }
        }}
      >
        <option value="" disabled>
          {loading ? 'Loading…' : items.length === 0 ? 'No items' : filtered.length === 0 ? 'No match' : 'Pick…'}
        </option>
        {filtered.map(item => (
          <option key={item.id} value={String(item.id)}>
            {(item.display_label || item.model_name).toUpperCase()}
            {item.in_stock ? '' : ' ✗'}
            {'  '}
            {item.price_unit === 'Wp'
              ? `₹${item.price_per_unit}/Wp`
              : `₹${Number(item.price_per_unit).toLocaleString('en-IN')}`}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── BomTable ───────────────────────────────────────────────────────────────

function BomTable({ prefix, form }: { prefix: 'optionA' | 'optionB'; form: UseFormReturn<QuotationData> }) {
  const { register, watch, control, setValue } = form;
  const ebBill = watch('ebBill');
  const { inverterKw, recommendedSystemKw } = calcEbBill(ebBill);
  const systemKw = recommendedSystemKw;
  const { fields, append, remove } = useFieldArray({ control, name: `${prefix}.rows` as any });
  const liveRows: BomRow[] = watch(`${prefix}.rows`) ?? [];
  const subsidy: number    = watch(`${prefix}.subsidy`) ?? 78000;
  const discount: number   = watch(`${prefix}.discount`) ?? 0;

  // Auto-populate subsidy when system size, customer type, phase, or panel DCR status changes
  const customerType = watch('customer.customerType') ?? 'residential';
  const phase        = watch('ebBill.phase') ?? 'single';
  const panelRow     = liveRows.find(r => r.item.toLowerCase() === 'panels');
  const isDcr        = panelRow ? /\bDCR\b/i.test(panelRow.description) && !/non-DCR/i.test(panelRow.description) : false;
  useEffect(() => {
    if (prefix !== 'optionA') return;
    const computed = calcSubsidy(recommendedSystemKw, customerType as 'residential' | 'commercial', phase as 'single' | 'three', isDcr);
    setValue(`${prefix}.subsidy`, computed);
  }, [recommendedSystemKw, customerType, phase, isDcr]); // eslint-disable-line react-hooks/exhaustive-deps
  const { grossTotal, netInvestment } = calcBomTotals(liveRows, subsidy, discount, systemKw);
  const totalBaseRs   = liveRows.reduce((s, r) => s + calcBomBaseCost(r, systemKw), 0);
  const totalMarginRs = liveRows.reduce((s, r) => s + (calcBomBaseCost(r, systemKw) * r.marginPct / 100), 0);
  const totalGstRs    = liveRows.reduce((s, r) => {
    const withMargin = calcBomBaseCost(r, systemKw) * (1 + r.marginPct / 100);
    return s + withMargin * r.gstPct / 100;
  }, 0);
  const isRecommended: boolean    = watch(`${prefix}.isRecommended`);
  const expansionPossible: boolean = watch(`${prefix}.expansionPossible`);

  // Generic apply: match row by item name (case-insensitive), patch fields from catalog item
  function applyFromCatalog(category: CatalogCategory, item: ProductCatalogItem) {
    const rows: BomRow[] = form.getValues(`${prefix}.rows`);
    const rowKey = Object.entries(ITEM_TO_CATEGORY).find(([, c]) => c === category)?.[0] ?? '';
    const unitPrice = parseFloat(item.price_per_unit);
    const catalogPriceMeta = {
      priceSource: 'catalog' as const,
      priceUnit: item.price_unit,
    };

    let description = item.model_name;
    if (category === 'panels') {
      const wp = item.specs.wp as number ?? 0;
      description = `${wp}Wp ${item.model_name} ${item.specs.dcr ? 'DCR' : 'non-DCR'}`.trim();
      const updated = rows.map(r =>
        r.item.toLowerCase() === rowKey
          ? { ...r, ...catalogPriceMeta, brand: item.brand, description, unitPrice, marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct) }
          : r
      );
      setValue(`${prefix}.rows`, updated);
      return;
    }
    if (category === 'inverters') {
      const kw = item.specs.kw as number ?? '';
      const phases = item.specs.phases as number ?? 1;
      const type = item.specs.type as string ?? 'On-Grid';
      description = `${kw}kW ${phases === 3 ? '3-ph' : '1-ph'} ${type}`;
    }

    const updated = rows.map(r =>
      r.item.toLowerCase() === rowKey
        ? { ...r, ...catalogPriceMeta, brand: item.brand, description, unitPrice, marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct) }
        : r
    );
    setValue(`${prefix}.rows`, updated);
  }

  const systemType = form.getValues('customer.systemType') ?? 'ON-GRID';
  const isThreePhase = (form.getValues('ebBill.phase') ?? 'single') === 'three';

  function inStock(items: ProductCatalogItem[]) {
    const s = items.filter(i => i.in_stock !== false);
    return s.length ? s : items;
  }

  function pickBestPanel(items: ProductCatalogItem[]) {
    return inStock(items).reduce<ProductCatalogItem | undefined>((best, cur) =>
      ((cur.specs.wp as number) ?? 0) > ((best?.specs.wp as number) ?? -1) ? cur : best, undefined);
  }

  function pickBestInverter(items: ProductCatalogItem[]) {
    // Filter by system type (On-Grid / Hybrid) and phase, then pick closest kW ≥ recommended
    const typeStr = systemType === 'HYBRID' ? 'hybrid' : 'on-grid';
    const phaseStr = isThreePhase ? 'three phase' : 'single phase';
    const pool = inStock(items).filter(i => {
      const mn = (i.model_name ?? '').toLowerCase();
      return mn.includes(typeStr) && mn.includes(phaseStr);
    });
    const candidates = pool.length ? pool : inStock(items);
    const sorted = [...candidates].sort((a, b) => ((a.specs.kw as number) ?? 0) - ((b.specs.kw as number) ?? 0));
    return sorted.find(i => ((i.specs.kw as number) ?? 0) >= inverterKw) ?? sorted[sorted.length - 1];
  }

  // Parse kWp range from description text like "5 to 8 kWp, Three Phase" → [5, 8]
  function parseKwRange(text: string): [number, number] {
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*kwp/i);
    if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
    const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*kwp/i);
    if (singleMatch) { const v = parseFloat(singleMatch[1]); return [v, v]; }
    return [0, Infinity];
  }

  function pickBomsBySize(items: ProductCatalogItem[], forHybrid = false) {
    const phaseStr = isThreePhase ? 'three phase' : 'single phase';
    // For ACDB: filter by hybrid/on-grid first
    let pool = inStock(items);
    if (forHybrid) {
      const hybrid = pool.filter(i => (i.specs as any)?.type === 'hybrid' || (i.model_name ?? '').toLowerCase().includes('change over'));
      if (hybrid.length) pool = hybrid;
    } else {
      const ongrid = pool.filter(i => (i.specs as any)?.type !== 'hybrid' && !(i.model_name ?? '').toLowerCase().includes('change over'));
      if (ongrid.length) pool = ongrid;
    }

    const scored = pool.map(item => {
      const mn = (item.model_name ?? '').toLowerCase();
      // Phase match
      const phaseMatch = mn.includes(phaseStr) ? 2 : mn.includes('phase') ? 0 : 1;
      // kWp range
      const [lo, hi] = parseKwRange(mn);
      const hasRange = lo > 0 || hi < Infinity;
      const inRange = hasRange && inverterKw >= lo && inverterKw <= hi ? 3 : 0;
      // Penalise items with no parseable range (generic entries) — prefer specific ones
      const specificBonus = hasRange ? 1 : -2;
      // Proximity of midpoint
      const mid = hi < Infinity ? (lo + hi) / 2 : lo;
      const proximity = 1 / (1 + Math.abs(mid - inverterKw));
      return { item, score: phaseMatch + inRange + specificBonus + proximity };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.item ?? items[0];
  }

  function pickFirstInStock(items: ProductCatalogItem[]) {
    return inStock(items)[0] ?? items[0];
  }

  // Categories that have catalog entries — drives which selectors to show
  const CATALOG_CATEGORIES: CatalogCategory[] = [
    'panels', 'inverters', 'dcdb', 'acdb', 'mounting',
    'earthing', 'lightning', 'mc4', 'wiring', 'accessories', 'installation', 'iot',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Catalog selectors — 2-column grid */}
      <div className="sq-catalog-grid">
        {CATALOG_CATEGORIES.map(cat => (
          <CatalogSelector
            key={cat}
            category={cat}
            onSelect={item => applyFromCatalog(cat, item)}
            currentRow={liveRows.find(row => ITEM_TO_CATEGORY[row.item.toLowerCase()] === cat) ?? null}
            autoPickFn={
              cat === 'panels'    ? pickBestPanel    :
              cat === 'inverters' ? pickBestInverter  :
              cat === 'dcdb'      ? (items) => pickBomsBySize(items, false) :
              cat === 'acdb'      ? (items) => pickBomsBySize(items, systemType === 'HYBRID') :
              pickFirstInStock
            }
          />
        ))}
      </div>

      <div className="sq-table-wrap">
        <table className="sq-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Item</th>
              <th style={{ width: 90 }}>Brand</th>
              <th style={{ width: 140 }}>Description</th>
              <th className="right" style={{ width: 52 }}>Qty</th>
              <th className="right" style={{ width: 96 }}>Rate ₹</th>
              <th className="right" style={{ width: 96 }}>Base ₹</th>
              <th className="right" style={{ width: 62 }}>Mgn%</th>
              <th className="right" style={{ width: 52 }}>GST%</th>
              <th className="right" style={{ width: 100 }}>Final ₹</th>
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {(fields as unknown as BomRow[]).map((field, idx) => {
              const liveRow: BomRow = liveRows[idx] ?? field;
              const baseCost = calcBomBaseCost(liveRow, systemKw);
              const finalCost = calcBomRow(liveRow, systemKw);
              return (
                <tr key={field.id}>
                  <td><input className="sq-bom-input" style={{ minWidth: 80 }} {...register(`${prefix}.rows.${idx}.item`)} /></td>
                  <td><input className="sq-bom-input" style={{ minWidth: 60 }} {...register(`${prefix}.rows.${idx}.brand`)} /></td>
                  <td><input className="sq-bom-input" style={{ minWidth: 100 }} {...register(`${prefix}.rows.${idx}.description`)} /></td>
	                  <td><input type="number" min={0} className="sq-bom-input mono" style={{ minWidth: 40 }} {...register(`${prefix}.rows.${idx}.qty`, { valueAsNumber: true })} /></td>
	                  <td><input type="number" min={0} className="sq-bom-input mono" style={{ minWidth: 72 }} {...register(`${prefix}.rows.${idx}.unitPrice`, { valueAsNumber: true })} /></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: baseCost > 0 ? 'var(--fg, #0f172a)' : 'var(--muted-foreground)', paddingRight: 8 }}>
                    {baseCost > 0 ? formatINR(baseCost) : '—'}
                  </td>
	                  <td><input type="number" min={0} max={500} className="sq-bom-input mono" style={{ minWidth: 46 }} {...register(`${prefix}.rows.${idx}.marginPct`, { valueAsNumber: true })} /></td>
                  <td><input type="number" min={0} max={28} className="sq-bom-input mono" style={{ minWidth: 40 }} {...register(`${prefix}.rows.${idx}.gstPct`, { valueAsNumber: true })} /></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: finalCost > 0 ? 'var(--fg, #0f172a)' : 'var(--muted-foreground)', paddingRight: 8 }}>
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
            {/* Column-aligned totals row */}
            <tr style={{ borderTop: '1px solid var(--line-2, rgba(0,0,0,0.1))' }}>
              <td colSpan={3} style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: 4 }}>Totals</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fg-muted)', paddingRight: 4 }}>
                {liveRows.reduce((s, r) => s + (r.qty || 0), 0)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fg-muted)', paddingRight: 4 }}>
                —
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fg-muted)', paddingRight: 4 }}>
                {formatINR(totalBaseRs)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 4 }}>
                {formatINR(totalMarginRs)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fg-muted)', paddingRight: 4 }}>
                {formatINR(totalGstRs)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--fg)', fontWeight: 600, paddingRight: 8 }}>
                {formatINR(grossTotal)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>PM Surya Ghar Subsidy</td>
              <td colSpan={2} style={{ textAlign: 'right', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 8 }}>
                − {formatINR(subsidy)}
              </td>
              <td />
            </tr>
            {discount > 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>Discount</td>
                <td colSpan={2} style={{ textAlign: 'right', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 8 }}>
                  − {formatINR(discount)}
                </td>
                <td />
              </tr>
            )}
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
        <div className="sq-field">
          <label className="sq-label">Subsidy (₹)</label>
          <input
            type="number" min={0}
            className="sq-input sq-input-mono"
            style={{ width: 130 }}
            {...register(`${prefix}.subsidy`, { valueAsNumber: true })}
          />
        </div>
        <div className="sq-field">
          <label className="sq-label">Discount (₹)</label>
          <input
            type="number" min={0}
            className="sq-input sq-input-mono"
            style={{ width: 130 }}
            placeholder="0"
            {...register(`${prefix}.discount`, { valueAsNumber: true })}
          />
        </div>

        <button
          type="button"
          style={{ marginTop: 20 }}
          onClick={() => form.setValue(`${prefix}.isRecommended`, !isRecommended)}
          className={`sq-toggle ${isRecommended ? 'on-yellow' : ''}`}
        >
          {isRecommended ? <ToggleRight style={{ width: 15, height: 15 }} /> : <ToggleLeft style={{ width: 15, height: 15 }} />}
          Recommended
        </button>

        <button
          type="button"
          style={{ marginTop: 20 }}
          onClick={() => form.setValue(`${prefix}.expansionPossible`, !expansionPossible)}
          className={`sq-toggle ${expansionPossible ? 'on-green' : ''}`}
        >
          {expansionPossible ? <ToggleRight style={{ width: 15, height: 15 }} /> : <ToggleLeft style={{ width: 15, height: 15 }} />}
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
        discount: 0,
        isRecommended: false,
        expansionPossible: false,
        notIncluded: 'Civil works\nTANGEDCO payment for sanctioned load extension + solar net meter\nReflective paints',
        factorsNote: '',
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      <div>
        <div className="sq-section-title">
          Option A
          <span className="sq-badge sq-badge-green">Primary</span>
        </div>
        <BomTable prefix="optionA" form={form} />
      </div>

      <div style={{ borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', paddingTop: 16 }}>
        <button
          type="button"
          onClick={toggleOptionB}
          className={`sq-toggle ${hasOptionB ? 'on-blue' : ''}`}
          style={hasOptionB ? { borderColor: 'rgba(91,155,213,0.3)', background: 'rgba(91,155,213,0.06)', color: 'var(--blue, #3b82f6)' } : {}}
        >
          {hasOptionB ? <ToggleRight style={{ width: 15, height: 15 }} /> : <ToggleLeft style={{ width: 15, height: 15 }} />}
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
