import { useState, useEffect, useRef, Fragment } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Plus, Trash2, ToggleLeft, ToggleRight, Search, ChevronDown, ChevronUp, Sun, Boxes, Wrench, PackagePlus, Lock, LockOpen } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { calcBomBaseCost, calcBomRow, calcBomTotals, calcEbBill, calcEvSizing, calcSubsidy, formatINR, getEffectiveSystemKw } from '../../utils/roiCalculator';
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

export function newOptionB(): NonNullable<QuotationData['optionB']> {
  return {
    rows: newRows(),
    subsidy: 78000,
    discount: 0,
    isRecommended: false,
    expansionPossible: false,
    notIncluded: 'Civil works\nTANGEDCO payment for sanctioned load extension + solar net meter\nReflective paints',
    factorsNote: '',
  };
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
  'battery':            'batteries',
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

// ── Row grouping for navigability — items are grouped by what a rep is
//    actually deciding, not by table position, so the BOM reads as three
//    scannable decisions (what generates, what carries it, what's charged
//    for on top) instead of one flat 12-row list. ──
type BomSection = 'generation' | 'bos' | 'services' | 'custom';

const SECTION_ORDER: BomSection[] = ['generation', 'bos', 'services', 'custom'];

const SECTION_LABEL: Record<BomSection, string> = {
  generation: 'Generation',
  bos:        'Balance of System',
  services:   'Services & Add-ons',
  custom:     'Custom Additions',
};

// Plain-language sense of what each group covers, shown under the section
// label so a rep unfamiliar with the standard BOM can still place a row.
const SECTION_HINT: Record<BomSection, string> = {
  generation: 'What makes the power',
  bos:        'What carries and protects it',
  services:   'What gets it installed and running',
  custom:     'Anything else for this quote',
};

const SECTION_ICON: Record<BomSection, typeof Sun> = {
  generation: Sun,
  bos:        Boxes,
  services:   Wrench,
  custom:     PackagePlus,
};

const RATE_PER_KW_CATEGORIES = new Set<CatalogCategory>(['mounting', 'installation']);

const CATEGORY_TO_SECTION: Record<CatalogCategory, BomSection> = {
  panels: 'generation', inverters: 'generation', batteries: 'generation',
  dcdb: 'bos', acdb: 'bos', mounting: 'bos', earthing: 'bos', lightning: 'bos', mc4: 'bos', wiring: 'bos',
  accessories: 'services', installation: 'services', iot: 'services',
};

function sectionForRow(row: BomRow): BomSection {
  const category = ITEM_TO_CATEGORY[row.item.toLowerCase()];
  return category ? CATEGORY_TO_SECTION[category] : 'custom';
}

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

    // Untouched rows always go through auto-pick — never short-circuited by the
    // "does this already match a catalog item" text check below. Some DEFAULT_ROWS
    // placeholder text (e.g. "615Wp TOPCon", "DC + AC cables") coincidentally equals
    // a real seeded product's model name, so that check would otherwise conclude a
    // brand-new row "already matches" and skip applying any price/brand to it at all.
    if (isRowUntouched(currentRow)) {
      if (!autoSelected.current && autoPickFn) {
        autoSelected.current = true;
        const best = autoPickFn(items);
        if (best) { setSelectedId(String(best.id)); onSelect(best); }
      } else if (!currentRow) {
        setSelectedId('');
      }
      return;
    }

    // Row already carries real data (a prior pick, or reloaded from a saved draft) —
    // just reflect which catalog entry it corresponds to, without reapplying pricing.
    const matched = items.find(item => matchesCatalogItem(category, currentRow, item));
    autoSelected.current = true;
    setSelectedId(matched ? String(matched.id) : '');
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
  const [openCatalogId, setOpenCatalogId] = useState<string | null>(null);
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const ebBill = watch('ebBill');
  const calc = calcEbBill(ebBill);
  const { inverterKw } = calc;
  const baseSystemKw = getEffectiveSystemKw(ebBill, calc);
  // When an EV preset is selected, Option B represents the EV-inclusive system
  // (the whole point of having a second option here) — Option A stays the base size.
  const evCalc = calcEvSizing(ebBill);
  const systemKw = prefix === 'optionB' && evCalc ? evCalc.recommendedSystemKw : baseSystemKw;
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
    const computed = calcSubsidy(systemKw, customerType as 'residential' | 'commercial', phase as 'single' | 'three', isDcr);
    setValue(`${prefix}.subsidy`, computed);
  }, [systemKw, customerType, phase, isDcr]); // eslint-disable-line react-hooks/exhaustive-deps
  const { grossTotal, netInvestment } = calcBomTotals(liveRows, subsidy, discount, systemKw);
  const isRecommended: boolean    = watch(`${prefix}.isRecommended`);
  const expansionPossible: boolean = watch(`${prefix}.expansionPossible`);

  // Generic apply: match row by item name (case-insensitive), patch fields from catalog item
  function applyFromCatalog(category: CatalogCategory, item: ProductCatalogItem) {
    const rows: BomRow[] = form.getValues(`${prefix}.rows`);
    const rowKey = Object.entries(ITEM_TO_CATEGORY).find(([, c]) => c === category)?.[0] ?? '';
    const unitPrice = parseFloat(item.price_per_unit);
    // Mounting/Installation are priced per system kW in this app; the catalog model has no
    // concept of that (price_unit always 'nos' backend-side) — keep the row's rate_per_kw
    // unit instead of letting the catalog item silently switch it to a flat per-unit price
    // (which, combined with qty staying at 1, would undercharge by ~systemKw× on any real job).
    const priceUnit = RATE_PER_KW_CATEGORIES.has(category) ? 'rate_per_kw' : item.price_unit;
    const catalogPriceMeta = {
      priceSource: 'catalog' as const,
      priceUnit,
    };

    let description = item.model_name;
    if (category === 'panels') {
      const wp = item.specs.wp as number ?? 0;
      description = `${wp}Wp ${item.model_name} ${item.specs.dcr ? 'DCR' : 'non-DCR'}`.trim();
      const panelQty = wp > 0 ? Math.ceil((systemKw * 1000) / wp) : rows.find(r => r.item.toLowerCase() === rowKey)?.qty ?? 1;
      const panelIdx = rows.findIndex(r => r.item.toLowerCase() === rowKey);
      if (panelIdx >= 0) {
        setValue(`${prefix}.rows.${panelIdx}`, {
          ...rows[panelIdx], ...catalogPriceMeta, brand: item.brand, description, unitPrice, qty: panelQty,
          marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct),
        });
      }
      const mc4Idx = rows.findIndex(r => r.item.toLowerCase() === 'mc4 connectors');
      if (mc4Idx >= 0) {
        setValue(`${prefix}.rows.${mc4Idx}`, { ...rows[mc4Idx], qty: panelQty * 2 });
      }
      return;
    }
    if (category === 'inverters') {
      const kw = item.specs.kw as number ?? '';
      const phases = item.specs.phases as number ?? 1;
      const type = item.specs.type as string ?? 'On-Grid';
      description = `${kw}kW ${phases === 3 ? '3-ph' : '1-ph'} ${type}`;
    }

    const idx = rows.findIndex(r => r.item.toLowerCase() === rowKey);
    if (idx >= 0) {
      setValue(`${prefix}.rows.${idx}`, {
        ...rows[idx], ...catalogPriceMeta, brand: item.brand, description, unitPrice,
        marginPct: parseFloat(item.margin_pct), gstPct: parseFloat(item.gst_pct),
      });
    }
  }

  const systemType = form.getValues('customer.systemType') ?? 'ON-GRID';

  // Hybrid/Off-Grid quotes are the ones a battery is actually relevant to — On-Grid
  // never gets one. Only adds the row if it isn't already there, and never removes
  // it on switching back (a rep may have already priced it; don't destroy that).
  useEffect(() => {
    if (systemType !== 'HYBRID' && systemType !== 'OFF-GRID') return;
    const rows = form.getValues(`${prefix}.rows`);
    if (rows.some(r => r.item.toLowerCase() === 'battery')) return;
    setValue(`${prefix}.rows`, [
      ...rows,
      { id: uuid(), item: 'Battery', brand: '', description: '', qty: 1, unitPrice: 0, marginPct: 20, gstPct: 5 },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemType]);
  const isThreePhase = (form.getValues('ebBill.phase') ?? 'single') === 'three';

  function inStock(items: ProductCatalogItem[]) {
    const s = items.filter(i => i.in_stock !== false);
    return s.length ? s : items;
  }

  function pickBestPanel(items: ProductCatalogItem[]) {
    return inStock(items).reduce<ProductCatalogItem | undefined>((best, cur) =>
      ((cur.specs.wp as number) ?? 0) > ((best?.specs.wp as number) ?? -1) ? cur : best, undefined);
  }

  // No backup-hours sizing exists anywhere in this app yet, so default to the
  // smallest in-stock battery — cheapest, least presumptuous starting point;
  // the rep picks a bigger one from the catalog dropdown if the customer wants more.
  function pickSmallestBattery(items: ProductCatalogItem[]) {
    return inStock(items).reduce<ProductCatalogItem | undefined>((smallest, cur) =>
      ((cur.specs.kwh as number) ?? Infinity) < ((smallest?.specs.kwh as number) ?? Infinity) ? cur : smallest, undefined);
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

  // Group rows by section while preserving each row's real field-array index
  // (register() paths and remove() must reference the row's actual position,
  // not its position within the group).
  type IndexedRow = { idx: number; field: BomRow };
  const sections: Record<BomSection, IndexedRow[]> = { generation: [], bos: [], services: [], custom: [] };
  (fields as unknown as BomRow[]).forEach((field, idx) => {
    const liveRow = liveRows[idx] ?? field;
    sections[sectionForRow(liveRow)].push({ idx, field });
  });

  function autoPickFnFor(category: CatalogCategory) {
    if (category === 'panels') return pickBestPanel;
    if (category === 'inverters') return pickBestInverter;
    if (category === 'batteries') return pickSmallestBattery;
    if (category === 'dcdb') return (items: ProductCatalogItem[]) => pickBomsBySize(items, false);
    if (category === 'acdb') return (items: ProductCatalogItem[]) => pickBomsBySize(items, systemType === 'HYBRID');
    return pickFirstInStock;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="sq-table-wrap">
        <table className="sq-table sq-bom-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Item</th>
              <th style={{ width: 90 }}>Brand</th>
              <th style={{ width: 180 }}>Description</th>
              <th className="right" style={{ width: 52 }} title="How many">Qty</th>
              <th className="right" style={{ width: 120 }} title="What the customer pays for this line">Customer Price</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          {SECTION_ORDER.map(sectionKey => {
            const rows = sections[sectionKey];
            if (!rows.length) return null;
            const sectionTotal = rows.reduce((s, { idx, field }) => s + calcBomRow(liveRows[idx] ?? field, systemKw), 0);
            const SectionIcon = SECTION_ICON[sectionKey];
            return (
              <tbody key={sectionKey} className="sq-bom-section">
                <tr className="sq-bom-section-row">
                  <td colSpan={6}>
                    <div className="sq-bom-section-head">
                      <SectionIcon className="sq-bom-section-icon" style={{ width: 14, height: 14 }} />
                      <div className="sq-bom-section-titles">
                        <span className="sq-bom-section-label">{SECTION_LABEL[sectionKey]}</span>
                        <span className="sq-bom-section-hint">{SECTION_HINT[sectionKey]}</span>
                      </div>
                      <span className="sq-bom-section-count">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
                      <span className="sq-bom-section-subtotal">{formatINR(sectionTotal)}</span>
                    </div>
                  </td>
                </tr>
                {rows.map(({ idx, field }) => {
                  const liveRow: BomRow = liveRows[idx] ?? field;
                  const baseCost = calcBomBaseCost(liveRow, systemKw);
                  const finalCost = calcBomRow(liveRow, systemKw);
                  const category = ITEM_TO_CATEGORY[liveRow.item.toLowerCase()];
                  const isCatalogOpen = openCatalogId === field.id;
                  const isDetailOpen = openDetailId === field.id;
                  return (
                    <Fragment key={field.id}>
                      <tr>
                        <td>
                          <div className="sq-bom-item-cell">
                            <input className="sq-bom-input" style={{ minWidth: 68 }} {...register(`${prefix}.rows.${idx}.item`)} />
                            {category && (
                              <button
                                type="button"
                                className="sq-icon-btn sq-bom-catalog-toggle"
                                title={isCatalogOpen ? 'Hide catalog picker' : 'Choose from catalog'}
                                onClick={() => setOpenCatalogId(isCatalogOpen ? null : field.id)}
                              >
                                <Search style={{ width: 11, height: 11 }} />
                                {isCatalogOpen ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td><input className="sq-bom-input" style={{ minWidth: 60 }} {...register(`${prefix}.rows.${idx}.brand`)} /></td>
                        <td><input className="sq-bom-input" style={{ minWidth: 100 }} {...register(`${prefix}.rows.${idx}.description`)} /></td>
                        <td><input type="number" min={0} className="sq-bom-input mono" style={{ minWidth: 40 }} {...register(`${prefix}.rows.${idx}.qty`, { valueAsNumber: true })} /></td>
                        <td style={{ textAlign: 'right', paddingRight: 8 }}>
                          {finalCost > 0
                            ? <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--fg)' }}>{formatINR(finalCost)}</span>
                            : <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>—</span>}
                        </td>
                        <td style={{ paddingRight: 6, whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className={`sq-icon-btn sq-bom-lock-toggle ${isDetailOpen ? 'on' : ''}`}
                            title={isDetailOpen ? 'Hide pricing detail' : 'Show base cost, margin & GST'}
                            onClick={() => setOpenDetailId(isDetailOpen ? null : field.id)}
                          >
                            {isDetailOpen ? <LockOpen style={{ width: 12, height: 12 }} /> : <Lock style={{ width: 12, height: 12 }} />}
                          </button>
                          <button type="button" className="sq-icon-btn" onClick={() => remove(idx)} title="Remove row">
                            <Trash2 style={{ width: 11, height: 11 }} />
                          </button>
                        </td>
                      </tr>
                      {/* Catalog picker stays mounted whenever a row matches a category — even
                          while hidden — so its auto-pick-best-match effect still runs on load.
                          Only visibility toggles; the component itself never unmounts. */}
                      {category && (
                        <tr className="sq-bom-catalog-row" style={{ display: isCatalogOpen ? 'table-row' : 'none' }}>
                          <td colSpan={6}>
                            <CatalogSelector
                              category={category}
                              onSelect={item => { applyFromCatalog(category, item); setOpenCatalogId(null); }}
                              currentRow={liveRow}
                              autoPickFn={autoPickFnFor(category)}
                            />
                          </td>
                        </tr>
                      )}
                      {/* Base cost / margin / GST — hidden by default so the table reads as a
                          price list, not a spreadsheet; opened per-row via the lock icon. */}
                      {isDetailOpen && (
                        <tr className="sq-bom-detail-row">
                          <td colSpan={6}>
                            <div className="sq-bom-detail">
                              <div>
                                <span className="sq-bom-detail-k">Unit Rate</span>
                                <input type="number" min={0} className="sq-bom-input mono" {...register(`${prefix}.rows.${idx}.unitPrice`, { valueAsNumber: true })} />
                              </div>
                              <div>
                                <span className="sq-bom-detail-k">Margin %</span>
                                <input type="number" min={0} max={500} className="sq-bom-input mono" {...register(`${prefix}.rows.${idx}.marginPct`, { valueAsNumber: true })} />
                              </div>
                              <div>
                                <span className="sq-bom-detail-k">GST %</span>
                                <input type="number" min={0} max={28} className="sq-bom-input mono" {...register(`${prefix}.rows.${idx}.gstPct`, { valueAsNumber: true })} />
                              </div>
                              <div>
                                <span className="sq-bom-detail-k">Base Cost</span>
                                <span className="mono sq-bom-detail-v">{baseCost > 0 ? formatINR(baseCost) : '—'}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            );
          })}
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--line-2, rgba(0,0,0,0.1))' }}>
              <td colSpan={3} style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: 4 }}>Totals</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fg-muted)', paddingRight: 4 }}>
                {liveRows.reduce((s, r) => s + (r.qty || 0), 0)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--fg)', fontWeight: 600, paddingRight: 8 }}>
                {formatINR(grossTotal)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>PM Surya Ghar Subsidy</td>
              <td style={{ textAlign: 'right', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 8 }}>
                − {formatINR(subsidy)}
              </td>
              <td />
            </tr>
            {discount > 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>Discount</td>
                <td style={{ textAlign: 'right', color: 'var(--green, #00a63e)', fontWeight: 600, paddingRight: 8 }}>
                  − {formatINR(discount)}
                </td>
                <td />
              </tr>
            )}
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', color: 'var(--amber, #f59e0b)', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
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
        Add Custom Item
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
          <label className="sq-label">What's Not Included</label>
          <textarea
            className="sq-textarea"
            rows={3}
            placeholder={'Civil works\nTANGEDCO payment\nReflective paints'}
            style={{ fontSize: '0.78rem' }}
            {...register(`${prefix}.notIncluded`)}
          />
          <p className="sq-hint">Printed on the proposal so the customer knows what's out of scope</p>
        </div>
        <div className="sq-field">
          <label className="sq-label">Notes for This Quote</label>
          <textarea
            className="sq-textarea"
            rows={3}
            placeholder="Consumption pattern May 2025 – May 2026"
            style={{ fontSize: '0.78rem' }}
            {...register(`${prefix}.factorsNote`)}
          />
          <p className="sq-hint">Any assumptions or context worth flagging to the customer</p>
        </div>
      </div>

    </div>
  );
}

export function StepBom({ form }: Props) {
  const { watch, setValue } = form;
  const hasOptionB = watch('optionB') !== null;
  const isEvSelected = !!calcEvSizing(watch('ebBill'));

  function toggleOptionB() {
    setValue('optionB', hasOptionB ? null : newOptionB());
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
            <span className="sq-badge sq-badge-blue">{isEvSelected ? 'EV-inclusive' : 'Alternate'}</span>
          </div>
          <BomTable prefix="optionB" form={form} />
        </div>
      )}
    </div>
  );
}
