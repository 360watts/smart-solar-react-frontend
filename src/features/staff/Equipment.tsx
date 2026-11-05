import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Package, Search, Upload, Download,
  AlertCircle, CheckCircle2, Tag, Store, ListOrdered, Zap,
} from 'lucide-react';
import { apiService, ProductCatalogItem, ProductCatalogCategory } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileEquipment from '../mobile/staff/MobileEquipment';
import { EmptyState } from '../../shared/components/Feedback';
import PageHeader from '../../shared/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Input } from '../../shared/ui/input';
import { Switch } from '../../shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table';
import { ConfirmDialog } from './siteHardware/ui';

// ── Theme ──────────────────────────────────────────────────────────────────────

const mkT = (isDark: boolean) => ({
  bg:             'var(--background)',
  surface:        'var(--card)',
  surfaceRaised:  'var(--card)',
  border:         isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,21,26,0.09)',
  borderStrong:   isDark ? 'rgba(255,255,255,0.13)' : 'rgba(18,21,26,0.16)',
  text:           'var(--foreground)',
  textM:          'var(--muted-foreground)',
  accent:         'var(--brand-green)',
  amber:          '#E9B949',
  overlay:        isDark ? 'rgba(8,12,20,0.82)' : 'rgba(0,0,0,0.50)',
  glass:          isDark ? 'rgba(13,19,32,0.97)' : 'rgba(255,255,255,0.98)',
  glassHL:        isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
  inputBg:        'var(--card)',
  inputBorder:    isDark ? 'rgba(255,255,255,0.12)' : 'var(--border-strong)',
});

const inputStyle = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 11px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border-strong)',
  backgroundColor: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 140ms',
});

// Shared shadcn Select dressed to match this page's inputStyle look
const StyledSelect: React.FC<{
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isDark: boolean; placeholder?: string; className?: string;
}> = ({ value, onChange, options, isDark, placeholder, className }) => {
  const { width: _width, padding: _padding, ...triggerStyle } = inputStyle(isDark); // width comes from className, not inline — inline would beat w-auto
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-full'} style={{ ...triggerStyle, padding: '9px 14px' }}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
};

const labelStyle = (isDark: boolean): React.CSSProperties => ({
  fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 5,
  fontFamily: 'Rubik, sans-serif', letterSpacing: '0.01em',
});

// ── Motion constants ───────────────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, stiffness: 320, damping: 30 };
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};
const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.14 } },
};

// ── Types & constants ──────────────────────────────────────────────────────────

type CategoryFilter = 'all' | ProductCatalogCategory;

const CATEGORY_TABS: { id: CategoryFilter; label: string; emoji: string }[] = [
  { id: 'all',          label: 'All',          emoji: '📦' },
  { id: 'panels',       label: 'Panels',       emoji: '☀️' },
  { id: 'inverters',    label: 'Inverters',    emoji: '⚡' },
  { id: 'batteries',    label: 'Batteries',    emoji: '🔋' },
  { id: 'dcdb',         label: 'DCDB',         emoji: '🔌' },
  { id: 'acdb',         label: 'ACDB',         emoji: '🔌' },
  { id: 'mounting',     label: 'Mounting',     emoji: '🏗️' },
  { id: 'earthing',     label: 'Earthing',     emoji: '🌍' },
  { id: 'lightning',    label: 'Lightning',    emoji: '⚡' },
  { id: 'mc4',          label: 'MC4',          emoji: '🔩' },
  { id: 'wiring',       label: 'Wiring',       emoji: '🔗' },
  { id: 'accessories',  label: 'Accessories',  emoji: '🛠️' },
  { id: 'installation', label: 'Installation', emoji: '🔧' },
  { id: 'iot',          label: 'IoT',          emoji: '📡' },
];

const ALL_CATEGORY_OPTIONS: { value: ProductCatalogCategory; label: string }[] = [
  { value: 'panels',       label: 'Solar Panels' },
  { value: 'inverters',    label: 'Inverters' },
  { value: 'batteries',    label: 'Batteries' },
  { value: 'dcdb',         label: 'DCDB' },
  { value: 'acdb',         label: 'ACDB' },
  { value: 'mounting',     label: 'Mounting Structure' },
  { value: 'earthing',     label: 'Earthing Rod' },
  { value: 'lightning',    label: 'Lightning Arrestor' },
  { value: 'mc4',          label: 'MC4 Connectors' },
  { value: 'wiring',       label: 'Wiring' },
  { value: 'accessories',  label: 'Accessories' },
  { value: 'installation', label: 'Installation' },
  { value: 'iot',          label: 'IoT Hub' },
];

const CATEGORY_COLORS: Record<string, string> = {
  panels:       '#10ffcb',
  inverters:    '#60a5fa',
  batteries:    '#fbbf24',
  dcdb:         '#f472b6',
  acdb:         '#e879f9',
  mounting:     '#a8b4c8',
  earthing:     '#fb923c',
  lightning:    '#facc15',
  mc4:          '#a3e635',
  wiring:       '#38bdf8',
  accessories:  '#c084fc',
  installation: '#0F9F8F',
  iot:          '#f87171',
};

const PAGE_SIZE = 10;

// ── KV spec editor ─────────────────────────────────────────────────────────────

type KVType = 'text' | 'number' | 'boolean';
type KVRow = { id: number; key: string; value: string; type: KVType };

let _kvId = 0;
const mkKvRow = (key = '', value = '', type: KVType = 'text'): KVRow => ({ id: ++_kvId, key, value, type });

function jsonToRows(json: string): KVRow[] {
  try {
    const obj = JSON.parse(json || '{}');
    if (typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.entries(obj).map(([k, v]) => {
      if (typeof v === 'boolean') return mkKvRow(k, v ? 'true' : 'false', 'boolean');
      if (typeof v === 'number') return mkKvRow(k, String(v), 'number');
      return mkKvRow(k, String(v ?? ''), 'text');
    });
  } catch { return []; }
}

function rowsToJson(rows: KVRow[]): string {
  const obj: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.key.trim()) continue;
    if (r.type === 'number') obj[r.key] = r.value === '' ? null : Number(r.value);
    else if (r.type === 'boolean') obj[r.key] = r.value === 'true';
    else obj[r.key] = r.value;
  }
  return JSON.stringify(obj);
}

const SUGGESTED_KEYS: Record<string, { key: string; type: KVType }[]> = {
  panels:    [{ key: 'dimensions_mm', type: 'text' }, { key: 'weight_kg', type: 'number' }, { key: 'warranty_years', type: 'number' }, { key: 'temperature_coeff', type: 'text' }],
  inverters: [{ key: 'dimensions_mm', type: 'text' }, { key: 'weight_kg', type: 'number' }, { key: 'mppt_count', type: 'number' }, { key: 'max_input_v', type: 'number' }, { key: 'efficiency_pct', type: 'number' }],
  batteries: [{ key: 'dimensions_mm', type: 'text' }, { key: 'weight_kg', type: 'number' }, { key: 'cycles', type: 'number' }, { key: 'dod_pct', type: 'number' }, { key: 'warranty_years', type: 'number' }],
  mounting:  [{ key: 'material', type: 'text' }, { key: 'load_capacity_kg', type: 'number' }, { key: 'finish', type: 'text' }],
  dcdb:      [{ key: 'input_strings', type: 'number' }, { key: 'fuse_rating_a', type: 'number' }, { key: 'enclosure', type: 'text' }],
  acdb:      [{ key: 'poles', type: 'number' }, { key: 'mccb_rating_a', type: 'number' }, { key: 'enclosure', type: 'text' }],
  wiring:    [{ key: 'cross_section_sqmm', type: 'number' }, { key: 'insulation', type: 'text' }, { key: 'length_m', type: 'number' }],
  mc4:       [{ key: 'current_rating_a', type: 'number' }, { key: 'voltage_rating_v', type: 'number' }, { key: 'ip_rating', type: 'text' }],
  earthing:  [{ key: 'length_m', type: 'number' }, { key: 'diameter_mm', type: 'number' }, { key: 'material', type: 'text' }],
  lightning: [{ key: 'height_m', type: 'number' }, { key: 'protection_radius_m', type: 'number' }],
  iot:       [{ key: 'protocol', type: 'text' }, { key: 'connectivity', type: 'text' }, { key: 'ports', type: 'number' }],
  accessories: [], installation: [],
};

const TYPE_COLORS: Record<KVType, string> = { text: '#94bfdc', number: '#60a5fa', boolean: '#0F9F8F' };

const KVEditor: React.FC<{
  value: string; onChange: (json: string) => void;
  category: string; isDark: boolean; label?: string; hint?: string;
}> = ({ value, onChange, category, isDark, label, hint }) => {
  const T = mkT(isDark);
  const catColor = CATEGORY_COLORS[category] || T.accent;
  const [rows, setRows] = useState<KVRow[]>(() => jsonToRows(value));
  const suggestions = (SUGGESTED_KEYS[category] ?? []).filter(s => !rows.some(r => r.key === s.key));

  const update = (next: KVRow[]) => { setRows(next); onChange(rowsToJson(next)); };
  const setRow = (id: number, patch: Partial<KVRow>) => update(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRow = (id: number) => update(rows.filter(r => r.id !== id));
  const addRow = (key = '', value = '', type: KVType = 'text') => update([...rows, mkKvRow(key, value, type)]);

  const rowBorder = `1px solid ${T.border}`;
  const inputBase: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: T.text, fontSize: '0.82rem', fontFamily: 'inherit', width: '100%', padding: '6px 8px',
  };

  return (
    <div>
      {label && (
        <label style={{ ...labelStyle(isDark), marginBottom: 7 }}>
          {label}
          {hint && <span style={{ fontWeight: 400, marginLeft: 6, fontSize: '0.75rem', color: T.textM }}>{hint}</span>}
        </label>
      )}

      {rows.length > 0 && (
        <div style={{ border: rowBorder, borderRadius: 9, overflow: 'hidden', marginBottom: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 76px 30px', background: T.surfaceRaised, borderBottom: rowBorder }}>
            {['Field', 'Value', 'Type', ''].map((h, i) => (
              <div key={i} style={{ padding: '5px 8px', fontSize: '0.75rem', fontWeight: 700, color: T.textM, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Rubik, sans-serif' }}>{h}</div>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {rows.map((row, idx) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 76px 30px', borderBottom: idx < rows.length - 1 ? rowBorder : undefined }}
              >
                <div style={{ borderRight: rowBorder, background: `${catColor}08` }}>
                  <input value={row.key} onChange={e => setRow(row.id, { key: e.target.value })} style={{ ...inputBase, fontFamily: 'Fira Code, monospace', fontSize: '0.75rem', color: catColor }} placeholder="field_name" />
                </div>
                <div style={{ borderRight: rowBorder }}>
                  {row.type === 'boolean' ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px' }}>
                      {['true', 'false'].map(v => (
                        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: T.text, cursor: 'pointer' }}>
                          <input type="radio" name={`kv-${row.id}`} checked={row.value === v} onChange={() => setRow(row.id, { value: v })} style={{ accentColor: '#0F9F8F' }} />
                          {v === 'true' ? 'Yes' : 'No'}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input type={row.type === 'number' ? 'number' : 'text'} value={row.value} onChange={e => setRow(row.id, { value: e.target.value })} style={inputBase} placeholder="value" />
                  )}
                </div>
                <div style={{ borderRight: rowBorder, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                  <Select value={row.type} onValueChange={v => setRow(row.id, { type: v as KVType, value: '' })}>
                    <SelectTrigger
                      size="sm"
                      className="h-auto w-full rounded-[5px] border px-2.5 py-1 text-[0.7rem] font-bold"
                      style={{ color: TYPE_COLORS[row.type], background: `${TYPE_COLORS[row.type]}14`, borderColor: `${TYPE_COLORS[row.type]}30` }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Num</SelectItem>
                      <SelectItem value="boolean">Y/N</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textM, padding: 4, lineHeight: 1, fontSize: 16, opacity: 0.6 }} title="Remove">×</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          <span style={{ fontSize: '0.75rem', color: T.textM, alignSelf: 'center', fontWeight: 600 }}>Quick add:</span>
          {suggestions.map(s => (
            <button key={s.key} onClick={() => addRow(s.key, '', s.type)}
              style={{ padding: '2px 9px', borderRadius: 99, border: `1px solid ${catColor}35`, background: `${catColor}0d`, cursor: 'pointer', fontSize: '0.75rem', color: catColor, fontFamily: 'Fira Code, monospace', transition: 'all 130ms' }}>
              + {s.key}
            </button>
          ))}
        </div>
      )}

      <button onClick={() => addRow()}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px dashed ${T.borderStrong}`, background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', color: T.textM, transition: 'all 130ms' }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add field
      </button>
    </div>
  );
};

// ── Form shape ─────────────────────────────────────────────────────────────────

type FormShape = Partial<ProductCatalogItem> & {
  specs_panels_wp: string; specs_panels_dcr: boolean;
  specs_panels_technology: string; specs_panels_efficiency: string;
  specs_inv_kw: string; specs_inv_phases: string; specs_inv_type: string;
  specs_bat_kwh: string; specs_bat_chemistry: string; specs_bat_voltage: string;
  specs_generic: string;
  specs_extra: string;
};

const blankForm = (): FormShape => ({
  category: 'panels', brand: '', model_name: '',
  price_per_unit: '', price_unit: 'Wp', margin_pct: '', gst_pct: '18',
  sort_order: 0, in_stock: true, stock_notes: '', retail_or_pallet: 'retail',
  dealer_name: '', dealer_location: '', price_updated_on: null, is_active: true,
  specs_panels_wp: '', specs_panels_dcr: false, specs_panels_technology: '', specs_panels_efficiency: '',
  specs_inv_kw: '', specs_inv_phases: '3', specs_inv_type: 'on-grid',
  specs_bat_kwh: '', specs_bat_chemistry: 'LiFePO4', specs_bat_voltage: '',
  specs_generic: '{}', specs_extra: '{}',
});

const STRUCTURED_CATS = new Set(['panels', 'inverters', 'batteries']);

const parseExtra = (json: string): Record<string, unknown> => {
  try { const v = JSON.parse(json || '{}'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch { return {}; }
};

const buildSpecs = (form: FormShape, category: string): Record<string, unknown> => {
  const extra = parseExtra(form.specs_extra);
  if (category === 'panels') return { wp: form.specs_panels_wp ? Number(form.specs_panels_wp) : undefined, dcr: form.specs_panels_dcr, technology: form.specs_panels_technology || undefined, efficiency: form.specs_panels_efficiency ? Number(form.specs_panels_efficiency) : undefined, ...extra };
  if (category === 'inverters') return { kw: form.specs_inv_kw ? Number(form.specs_inv_kw) : undefined, phases: form.specs_inv_phases ? Number(form.specs_inv_phases) : undefined, type: form.specs_inv_type || undefined, ...extra };
  if (category === 'batteries') return { kwh: form.specs_bat_kwh ? Number(form.specs_bat_kwh) : undefined, chemistry: form.specs_bat_chemistry || undefined, voltage: form.specs_bat_voltage ? Number(form.specs_bat_voltage) : undefined, ...extra };
  try { return JSON.parse(form.specs_generic || '{}'); } catch { return {}; }
};

const itemToForm = (item: ProductCatalogItem): FormShape => {
  const s = item.specs as any;
  const isStructured = STRUCTURED_CATS.has(item.category);
  const knownKeys: Record<string, string[]> = { panels: ['wp','dcr','technology','efficiency'], inverters: ['kw','phases','type'], batteries: ['kwh','chemistry','voltage'] };
  const known = new Set(knownKeys[item.category] ?? []);
  return {
    category: item.category, brand: item.brand, model_name: item.model_name,
    price_per_unit: item.price_per_unit, price_unit: item.price_unit,
    margin_pct: item.margin_pct ?? '', gst_pct: item.gst_pct ?? '18',
    sort_order: item.sort_order ?? 0, in_stock: item.in_stock,
    stock_notes: item.stock_notes ?? '', retail_or_pallet: item.retail_or_pallet ?? 'retail',
    dealer_name: item.dealer_name ?? '', dealer_location: item.dealer_location ?? '',
    price_updated_on: item.price_updated_on ?? null, is_active: item.is_active,
    specs_panels_wp: String(s.wp ?? ''), specs_panels_dcr: Boolean(s.dcr),
    specs_panels_technology: String(s.technology ?? ''), specs_panels_efficiency: String(s.efficiency ?? ''),
    specs_inv_kw: String(s.kw ?? ''), specs_inv_phases: String(s.phases ?? '3'), specs_inv_type: String(s.type ?? 'on-grid'),
    specs_bat_kwh: String(s.kwh ?? ''), specs_bat_chemistry: String(s.chemistry ?? 'LiFePO4'), specs_bat_voltage: String(s.voltage ?? ''),
    specs_generic: isStructured ? '{}' : JSON.stringify(item.specs ?? {}, null, 2),
    specs_extra: (() => {
      if (!isStructured) return '{}';
      const extra = Object.fromEntries(Object.entries(item.specs ?? {}).filter(([k]) => !known.has(k)));
      return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '{}';
    })(),
  };
};

// ── Bulk import ────────────────────────────────────────────────────────────────

// Flexible CSV format matching Component List structure
const CSV_COLUMNS = ['category','brand','model_name','price_per_unit','price_unit','wp','kwh','kw','dcr','technology','efficiency','type','phases','chemistry','voltage','stock_availability','updated_on','retail_or_pallet','dealer_name','dealer_location','margin_pct','gst_pct','sort_order','is_active'] as const;
type CsvRow = { [K in typeof CSV_COLUMNS[number]]?: string } & { _row: number; _errors: string[] };

const EXAMPLE_ROWS: Record<string, string>[] = [
  { category:'panels', brand:'Emmvee', model_name:'TOPCon N-type Bifacial', price_per_unit:'24.50', price_unit:'Wp', wp:'565', dcr:'true', technology:'TOPCon', efficiency:'21.5', stock_availability:'Yes', updated_on:'2026-06-10', retail_or_pallet:'Retail', dealer_name:'Sunbridger', dealer_location:'Coimbatore', margin_pct:'12', gst_pct:'12', sort_order:'1', is_active:'true' },
  { category:'inverters', brand:'Deye', model_name:'SUN-5K-SG05', price_per_unit:'64000', price_unit:'nos', kw:'3', type:'On-Grid', phases:'1', stock_availability:'Yes', updated_on:'2026-06-10', retail_or_pallet:'Retail', dealer_name:'Festa Solar', dealer_location:'Coimbatore', margin_pct:'15', gst_pct:'18', sort_order:'2', is_active:'true' },
  { category:'batteries', brand:'Deye', model_name:'LiFePO4 5.12kWh', price_per_unit:'69000', price_unit:'nos', kwh:'5.12', chemistry:'LiFePO4', voltage:'51.2', stock_availability:'Yes', updated_on:'2026-06-10', retail_or_pallet:'Retail', dealer_name:'Festa Solar', dealer_location:'Coimbatore', margin_pct:'10', gst_pct:'5', sort_order:'3', is_active:'true' },
];

function downloadTemplate() {
  const header = CSV_COLUMNS.join(',');
  const rows = EXAMPLE_ROWS.map(r => CSV_COLUMNS.map(c => { const v=(r as any)[c]??''; return (v.includes(',')||v.includes('"'))?`"${v.replace(/"/g,'""')}"`:v; }).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'product_catalog_import_template.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function parseRow(raw: Record<string, string>, rowNum: number): CsvRow {
  const errors: string[] = [];
  const cat = raw.category?.trim().toLowerCase();
  if (!cat || !ALL_CATEGORY_OPTIONS.find(o => o.value === cat)) errors.push(`Unknown category "${raw.category}"`);
  if (!raw.brand?.trim()) errors.push('brand required');
  if (!raw.model_name?.trim()) errors.push('model_name required');
  if (!raw.price_per_unit || isNaN(Number(raw.price_per_unit))) errors.push('price_per_unit must be a number');
  if (!raw.price_unit?.trim()) errors.push('price_unit required (Wp, nos, kWh, etc.)');
  return { ...raw, category: cat, _row: rowNum, _errors: errors } as CsvRow;
}

async function parseFile(file: File): Promise<CsvRow[]> {
  const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  let rawRows: Record<string, string>[] = [];
  if (isXlsx) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    rawRows = data.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k.trim(), String(v??'')])));
  } else {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    rawRows = lines.slice(1).map(line => {
      const vals = line.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g,'').replace(/""/g,'"')) ?? [];
      return Object.fromEntries(headers.map((h,i) => [h, vals[i]??'']));
    });
  }
  return rawRows.map((r,i) => parseRow(r, i+2));
}

function rowToPayload(row: CsvRow): Partial<ProductCatalogItem> {
  const cat = (row.category || '').trim().toLowerCase() as ProductCatalogCategory;
  const specs: Record<string, any> = {};

  // Extract category-specific specs
  if (cat === 'panels') {
    if (row.wp) specs.wp = Number(row.wp);
    if (row.dcr) specs.dcr = row.dcr.toLowerCase() === 'true' || row.dcr === 'yes' || row.dcr === '1';
    if (row.technology) specs.technology = row.technology;
    if (row.efficiency) specs.efficiency = Number(row.efficiency);
  } else if (cat === 'inverters') {
    if (row.kw) specs.kw = Number(row.kw);
    if (row.type) specs.type = row.type;
    if (row.phases) specs.phases = Number(row.phases);
    if (row.efficiency) specs.efficiency = Number(row.efficiency);
  } else if (cat === 'batteries') {
    if (row.kwh) specs.kwh = Number(row.kwh);
    if (row.chemistry) specs.chemistry = row.chemistry;
    if (row.voltage) specs.voltage = Number(row.voltage);
  }

  const inStock = row.stock_availability ? row.stock_availability.toLowerCase() === 'yes' || row.stock_availability === 'true' || row.stock_availability === '1' : true;

  return {
    category: cat,
    brand: (row.brand || '').trim(), model_name: (row.model_name || '').trim(),
    price_per_unit: row.price_per_unit || '0', price_unit: (row.price_unit || 'nos').trim(),
    retail_or_pallet: (row.retail_or_pallet?.toLowerCase() === 'pallet' ? 'pallet' : 'retail') as 'retail'|'pallet',
    margin_pct: row.margin_pct || '20', gst_pct: row.gst_pct || '5',
    sort_order: Number(row.sort_order) || 0,
    in_stock: inStock,
    stock_notes: row.stock_notes ?? '', dealer_name: (row.dealer_name || '').trim(),
    dealer_location: (row.dealer_location || '').trim(),
    price_updated_on: row.updated_on?.trim() || null,
    is_active: row.is_active?.toLowerCase() !== 'false',
    specs,
  };
}

const BulkImportModal: React.FC<{ open: boolean; isDark: boolean; onClose: () => void; onImported: () => void }> = ({ open, isDark, onClose, onImported }) => {
  const T = mkT(isDark);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ ok: number; failed: { row: number; err: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => { setRows([]); setResults(null); setProgress(null); };
  useEffect(() => { if (!open) reset(); }, [open]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try { setRows(await parseFile(file)); }
    catch (e) { console.error(e); }
    finally { setParsing(false); }
  };

  const validRows = rows.filter(r => r._errors.length === 0);
  const errorRows = rows.filter(r => r._errors.length > 0);

  const handleImport = async () => {
    setImporting(true); setProgress({ done: 0, total: validRows.length });
    const failed: { row: number; err: string }[] = []; let ok = 0;
    for (let i = 0; i < validRows.length; i++) {
      try { await apiService.createProductCatalogItem(rowToPayload(validRows[i])); ok++; }
      catch (e) { failed.push({ row: validRows[i]._row, err: e instanceof Error ? e.message : 'Failed' }); }
      setProgress({ done: i+1, total: validRows.length });
    }
    setResults({ ok, failed }); setImporting(false);
    if (ok > 0) onImported();
  };

  const cellS: React.CSSProperties = { padding: '6px 10px', fontSize: '0.75rem', color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 };
  const pct = progress ? (progress.done / progress.total) * 100 : 0;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: T.overlay, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <motion.div variants={panelVariants} initial="hidden" animate="visible" exit="exit"
            style={{ background: T.glass, border: `1px solid ${T.glassHL}`, borderRadius: 16, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, rgba(233,185,73,0.12) 0%, transparent 55%), ${T.surfaceRaised}`, padding: '18px 22px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: T.text, fontFamily: 'Rubik, sans-serif' }}>Bulk Import Products</h3>
                <div style={{ fontSize: '0.75rem', color: T.textM, marginTop: 3 }}>Upload CSV or Excel · up to thousands of rows at once</div>
              </div>
              <button onClick={onClose} style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: T.textM, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Template */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 10, background: `rgba(233,185,73,0.08)`, border: `1px solid rgba(233,185,73,0.25)` }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, fontFamily: 'Rubik, sans-serif' }}>Download Template</div>
                  <div style={{ fontSize: '0.75rem', color: T.textM, marginTop: 2 }}>CSV with all 16 columns + 2 example rows</div>
                </div>
                <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid rgba(233,185,73,0.4)`, background: 'transparent', color: '#E9B949', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Download size={13} /> Template
                </button>
              </div>

              {/* Drop zone */}
              {rows.length === 0 && !parsing && (
                <div
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.csv,.xlsx,.xls'; inp.onchange=e=>{ const f=(e.target as HTMLInputElement).files?.[0]; if(f) handleFile(f); }; inp.click(); }}
                  style={{ border: `2px dashed ${dragOver ? 'var(--brand-green)' : T.borderStrong}`, borderRadius: 12, padding: '44px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 180ms', background: dragOver ? 'rgba(15,159,143,0.05)' : 'transparent', boxShadow: dragOver ? '0 0 0 4px rgba(15,159,143,0.1)' : 'none' }}
                >
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                    <Upload size={34} color={dragOver ? 'var(--brand-green)' : T.textM} style={{ marginBottom: 12 }} />
                  </motion.div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: T.text, fontFamily: 'Rubik, sans-serif' }}>Drop file here to import</div>
                  <div style={{ fontSize: '0.75rem', color: T.textM, marginTop: 6 }}>or click to browse · CSV, XLSX, XLS</div>
                </div>
              )}

              {parsing && <div style={{ textAlign: 'center', color: T.textM, fontSize: '0.875rem', padding: 28 }}>Parsing file…</div>}

              {/* Preview */}
              {rows.length > 0 && !results && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text }}>
                      Preview — {rows.length} row{rows.length !== 1 ? 's' : ''}
                      {errorRows.length > 0 && <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 600 }}>· {errorRows.length} with errors (skipped)</span>}
                    </div>
                    <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: T.textM, textDecoration: 'underline' }}>Different file</button>
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: 'auto', maxHeight: 260 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: T.surfaceRaised }}>
                          {['#','category','brand','model','price','unit','stock','dealer','status'].map(h => (
                            <th key={h} style={{ ...cellS, fontWeight: 700, color: T.textM, fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => {
                          const hasErr = row._errors.length > 0;
                          return (
                            <tr key={row._row} style={{ background: hasErr ? (isDark ? 'rgba(239,68,68,0.07)' : '#fff5f5') : ri%2===1 ? T.surfaceRaised : 'transparent' }}>
                              <td style={{ ...cellS, color: T.textM }}>{row._row}</td>
                              <td style={cellS}><span style={{ padding: '1px 7px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, background: `${CATEGORY_COLORS[row.category]||'#888'}20`, color: CATEGORY_COLORS[row.category]||T.textM }}>{row.category}</span></td>
                              <td style={{ ...cellS, fontWeight: 600 }}>{row.brand}</td>
                              <td style={cellS}>{row.model_name}</td>
                              <td style={{ ...cellS, fontFamily: 'Fira Code, monospace', color: '#E9B949' }}>{row.price_per_unit}</td>
                              <td style={cellS}>{row.price_unit}</td>
                              <td style={{ ...cellS, color: row.in_stock?.toLowerCase() !== 'false' ? '#0F9F8F' : '#ef4444' }}>{row.in_stock}</td>
                              <td style={cellS}>{row.dealer_name}</td>
                              <td style={{ ...cellS, maxWidth: 200 }}>
                                {hasErr
                                  ? <span style={{ color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}><AlertCircle size={11} />{row._errors.join('; ')}</span>
                                  : <span style={{ color: 'var(--brand-green)', fontSize: '0.75rem', fontWeight: 700 }}>✓ OK</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {importing && progress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: T.textM }}>
                        <span>Importing…</span><span style={{ fontFamily: 'Fira Code, monospace' }}>{progress.done} / {progress.total}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: T.border, overflow: 'hidden' }}>
                        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.2 }}
                          style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #0F9F8F 0%, #26D9BC 100%)', boxShadow: '0 0 8px rgba(15,159,143,0.5)' }} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Results */}
              {results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 10, background: results.ok > 0 ? 'rgba(15,159,143,0.1)' : T.surfaceRaised, border: `1px solid ${results.ok > 0 ? 'rgba(15,159,143,0.3)' : T.border}` }}>
                    <CheckCircle2 size={20} color="var(--brand-green)" />
                    <div style={{ fontSize: '0.9rem', color: T.text }}><strong style={{ fontFamily: 'Fira Code, monospace' }}>{results.ok}</strong> product{results.ok !== 1 ? 's' : ''} imported successfully</div>
                  </div>
                  {results.failed.length > 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: 9, background: isDark ? 'rgba(239,68,68,0.07)' : '#fff5f5', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>{results.failed.length} failed:</div>
                      {results.failed.map(f => <div key={f.row} style={{ fontSize: '0.75rem', color: '#ef4444' }}>Row {f.row}: {f.err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="btn btn-secondary">{results ? 'Close' : 'Cancel'}</button>
              {rows.length > 0 && !results && (
                <button onClick={handleImport} disabled={importing || validRows.length === 0}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #0F9F8F 0%, #1A9E96 100%)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(15,159,143,0.35)', opacity: (importing || validRows.length === 0) ? 0.5 : 1 }}>
                  {importing ? 'Importing…' : `Import ${validRows.length} product${validRows.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// ── Add / Edit modal ───────────────────────────────────────────────────────────

const CatalogFormModal: React.FC<{ open: boolean; item: ProductCatalogItem | null; isDark: boolean; onClose: () => void; onSaved: () => void }> = ({ open, item, isDark, onClose, onSaved }) => {
  const T = mkT(isDark);
  const [form, setForm] = useState<FormShape>(blankForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setForm(item ? itemToForm(item) : blankForm()); setErr(null); }, [item, open]);

  const f = (k: keyof FormShape, v: any) => setForm(p => ({ ...p, [k]: v }));
  const cat = form.category ?? 'panels';
  const isStructured = STRUCTURED_CATS.has(cat);
  const catColor = CATEGORY_COLORS[cat] || T.accent;
  const catLabel = ALL_CATEGORY_OPTIONS.find(o => o.value === cat)?.label ?? cat;

  const handleSave = async () => {
    setErr(null);
    if (!form.brand?.trim()) { setErr('Add a brand to save this product.'); return; }
    if (!form.model_name?.trim()) { setErr('Add a model name to save this product.'); return; }
    if (!form.price_per_unit) { setErr('Add a price to save this product.'); return; }
    setSaving(true);
    try {
      const payload: Partial<ProductCatalogItem> = {
        category: cat as ProductCatalogCategory, brand: form.brand!, model_name: form.model_name!,
        price_per_unit: form.price_per_unit!, price_unit: form.price_unit!,
        margin_pct: form.margin_pct || '0', gst_pct: form.gst_pct || '18',
        sort_order: form.sort_order ?? 0, in_stock: form.in_stock ?? true,
        stock_notes: form.stock_notes ?? '', retail_or_pallet: form.retail_or_pallet ?? 'retail',
        dealer_name: form.dealer_name ?? '', dealer_location: form.dealer_location ?? '',
        price_updated_on: form.price_updated_on || null, is_active: form.is_active ?? true,
        specs: buildSpecs(form, cat),
      };
      if (item) await apiService.updateProductCatalogItem(item.id, payload);
      else await apiService.createProductCatalogItem(payload);
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save the product. Check the fields and try again.'); }
    finally { setSaving(false); }
  };

  const secLabel = (label: string) => (
    <h4 style={{ margin: '10px 0 0', paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: '0.9375rem', fontWeight: 600, color: T.text, fontFamily: 'Rubik, sans-serif' }}>{label}</h4>
  );

  const productTitle = [form.brand, form.model_name].filter(Boolean).join(' ') || (item ? `${item.brand} ${item.model_name}` : 'New product');

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: T.overlay, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <motion.div variants={panelVariants} initial="hidden" animate="visible" exit="exit"
            style={{ background: 'var(--card)', border: `1px solid ${T.border}`, borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>

            {/* Header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: T.textM }}>{item ? 'Edit product' : 'Add product'}</div>
                  <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 600, color: T.text, fontFamily: 'Rubik, sans-serif', lineHeight: 1.25 }}>{productTitle}</h3>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textM, width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {secLabel('Product')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div>
                  <label style={labelStyle(isDark)}>Category</label>
                  <StyledSelect value={cat} onChange={v => f('category', v as ProductCatalogCategory)} isDark={isDark} options={ALL_CATEGORY_OPTIONS} />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Brand</label>
                  <input value={form.brand ?? ''} onChange={e => f('brand', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., Waaree" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle(isDark)}>Model name</label>
                  <input value={form.model_name ?? ''} onChange={e => f('model_name', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., TOPCon 700Wp" />
                </div>
              </div>

              {secLabel(cat === 'panels' ? 'Panel specs' : cat === 'inverters' ? 'Inverter specs' : cat === 'batteries' ? 'Battery specs' : 'Specs')}
              {cat === 'panels' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Wattage (Wp)</label><input type="number" value={form.specs_panels_wp} onChange={e => f('specs_panels_wp', e.target.value)} style={inputStyle(isDark)} placeholder="700" /></div>
                  <div><label style={labelStyle(isDark)}>Efficiency (%)</label><input type="number" value={form.specs_panels_efficiency} onChange={e => f('specs_panels_efficiency', e.target.value)} style={inputStyle(isDark)} placeholder="21.3" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Technology</label>
                    <StyledSelect
                      value={form.specs_panels_technology} onChange={v => f('specs_panels_technology', v)} isDark={isDark}
                      placeholder="Choose one"
                      options={['Mono PERC','TOPCon','Bifacial TOPCon','HJT','Bifacial PERC','Polycrystalline'].map(t => ({ value: t, label: t }))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                    <input type="checkbox" checked={form.specs_panels_dcr} onChange={e => f('specs_panels_dcr', e.target.checked)} style={{ width: 16, height: 16, accentColor: catColor, cursor: 'pointer' }} />
                    <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>DCR (domestic content)</label>
                  </div>
                </div>
              )}
              {cat === 'inverters' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Power (kW)</label><input type="number" value={form.specs_inv_kw} onChange={e => f('specs_inv_kw', e.target.value)} style={inputStyle(isDark)} placeholder="10" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Type</label>
                    <StyledSelect
                      value={form.specs_inv_type} onChange={v => f('specs_inv_type', v)} isDark={isDark}
                      options={['on-grid','hybrid','off-grid','micro','string'].map(t => ({ value: t, label: t }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle(isDark)}>Phases</label>
                    <StyledSelect
                      value={form.specs_inv_phases} onChange={v => f('specs_inv_phases', v)} isDark={isDark}
                      options={[{ value: '1', label: 'Single phase' }, { value: '3', label: 'Three phase' }]}
                    />
                  </div>
                </div>
              )}
              {cat === 'batteries' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Capacity (kWh)</label><input type="number" value={form.specs_bat_kwh} onChange={e => f('specs_bat_kwh', e.target.value)} style={inputStyle(isDark)} placeholder="5.12" /></div>
                  <div><label style={labelStyle(isDark)}>Nominal voltage (V)</label><input type="number" value={form.specs_bat_voltage} onChange={e => f('specs_bat_voltage', e.target.value)} style={inputStyle(isDark)} placeholder="51.2" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Chemistry</label>
                    <StyledSelect
                      value={form.specs_bat_chemistry} onChange={v => f('specs_bat_chemistry', v)} isDark={isDark}
                      options={['LiFePO4','NMC','Lead Acid','NCA'].map(t => ({ value: t, label: t }))}
                    />
                  </div>
                </div>
              )}
              {!isStructured && <KVEditor key={`kv-g-${cat}`} value={form.specs_generic} onChange={v => f('specs_generic', v)} category={cat} isDark={isDark} label="Specs" hint="fields that describe this product" />}
              {isStructured && <KVEditor key={`kv-e-${cat}`} value={form.specs_extra} onChange={v => f('specs_extra', v)} category={cat} isDark={isDark} label="More specs" hint="optional, added to the fields above" />}

              {secLabel('Pricing')}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 11 }}>
                <div>
                  <label style={labelStyle(isDark)}>Price</label>
                  <input type="number" value={form.price_per_unit ?? ''} onChange={e => f('price_per_unit', e.target.value)} style={inputStyle(isDark)} placeholder="23.5" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Unit</label>
                  <StyledSelect
                    value={form.price_unit ?? 'nos'} onChange={v => f('price_unit', v)} isDark={isDark}
                    options={['Wp','nos','kWh','kW','set','m','kg'].map(u => ({ value: u, label: `₹/${u}` }))}
                  />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Margin (%)</label>
                  <input type="number" value={form.margin_pct ?? ''} onChange={e => f('margin_pct', e.target.value)} style={inputStyle(isDark)} placeholder="12" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>GST (%)</label>
                  <input type="number" value={form.gst_pct ?? ''} onChange={e => f('gst_pct', e.target.value)} style={inputStyle(isDark)} placeholder="18" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Sold as</label>
                  <StyledSelect
                    value={form.retail_or_pallet ?? 'retail'} onChange={v => f('retail_or_pallet', v)} isDark={isDark}
                    options={[{ value: 'retail', label: 'Retail' }, { value: 'pallet', label: 'Pallet' }]}
                  />
                </div>
                <div style={{ gridColumn: '2 / -1' }}>
                  <label style={labelStyle(isDark)}>Price last updated</label>
                  <input type="date" value={form.price_updated_on ?? ''} onChange={e => f('price_updated_on', e.target.value || null)} style={inputStyle(isDark)} />
                </div>
              </div>

              {secLabel('Dealer and stock')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div><label style={labelStyle(isDark)}>Dealer name</label><input value={form.dealer_name ?? ''} onChange={e => f('dealer_name', e.target.value)} style={inputStyle(isDark)} placeholder="SolarXL Distributors" /></div>
                <div><label style={labelStyle(isDark)}>Dealer location</label><input value={form.dealer_location ?? ''} onChange={e => f('dealer_location', e.target.value)} style={inputStyle(isDark)} placeholder="Coimbatore" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle(isDark)}>Stock note</label><input value={form.stock_notes ?? ''} onChange={e => f('stock_notes', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., Pallet of 36" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.in_stock ?? true} onChange={e => f('in_stock', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0F9F8F', cursor: 'pointer' }} />
                  <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>In stock</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_active ?? true} onChange={e => f('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: catColor, cursor: 'pointer' }} />
                  <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>Active in quotes</label>
                </div>
              </div>

              {secLabel('Order in lists')}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 11, alignItems: 'start' }}>
                <div><label style={labelStyle(isDark)}>Order</label><input type="number" value={form.sort_order ?? 0} onChange={e => f('sort_order', Number(e.target.value))} style={inputStyle(isDark)} placeholder="0" /></div>
                <p style={{ margin: '22px 0 0', fontSize: '0.75rem', color: T.textM, lineHeight: 1.55 }}>Lower numbers show first. Products with the same number are listed by brand.</p>
              </div>

              {err && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', color: '#ef4444', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.28)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} />{err}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: T.surfaceRaised }}>
              <button type="button" onClick={onClose} className="ui-btn ui-btn--link">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="ui-btn ui-btn--main">
                {saving ? 'Saving…' : item ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const UNITS: Record<string, string> = { pct: '%', years: 'years', mm: 'mm', kg: 'kg', v: 'V', a: 'A', w: 'W', wp: 'Wp', kw: 'kW', kwh: 'kWh', m: 'm', sqmm: 'mm²' };
const prettyKey = (k: string) => {
  const parts = k.split('_');
  const unit = parts.length > 1 ? UNITS[parts[parts.length - 1]] : undefined;
  const s = (unit ? parts.slice(0, -1) : parts).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + (unit ? ` (${unit})` : '');
};
const prettyVal = (v: unknown) => v === true ? 'Yes' : v === false ? 'No' : String(v ?? '–');
const money = (v: string | number) => `₹${Number(v).toLocaleString('en-IN')}`;
const catLabel = (id: string) => ALL_CATEGORY_OPTIONS.find(o => o.value === id)?.label ?? id;

type SortKey = 'product' | 'price' | 'stock';

const DetailList: React.FC<{ title: string; rows: [string, string][]; empty?: string }> = ({ title, rows, empty }) => (
  <div className="border-b border-border px-5 py-3">
    <h3 className="m-0 mb-1 text-[0.9375rem] font-medium text-muted-foreground">{title}</h3>
    {rows.length === 0 ? <p className="m-0 py-1 text-sm text-muted-foreground">{empty}</p> : (
      <dl className="m-0 [display:grid] grid-cols-[auto_1fr] gap-x-4">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="py-1.5 text-sm text-muted-foreground">{k}</dt>
            <dd className="m-0 py-1.5 text-right font-mono text-sm">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    )}
  </div>
);

// Layout picked in a wrapper: an early return before the hooks breaks when the width crosses the mobile breakpoint.
const ProductCatalog: React.FC = () => (useIsMobile() ? <MobileEquipment /> : <DesktopProductCatalog />);

const DesktopProductCatalog: React.FC = () => {

  const { isDark } = useTheme();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all'|'in_stock'|'out_of_stock'>('all');
  const [activeFilter, setActiveFilter] = useState<'all'|'active'|'inactive'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'product', dir: 1 });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ open: boolean; item: ProductCatalogItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<ProductCatalogItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Load everything once; category, search and filters apply here so the rail can show every count.
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiService.getProductCatalog();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the catalog. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [category, search, stockFilter, activeFilter, sort]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiService.deleteProductCatalogItem(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the product. Try again.'); setDeleteTarget(null); }
  };

  // The In stock and Active switches in the detail panel save as soon as they change.
  const patchItem = async (it: ProductCatalogItem, patch: Partial<ProductCatalogItem>) => {
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    try { await apiService.updateProductCatalogItem(it.id, patch); }
    catch (e) { setItems(prev => prev.map(x => x.id === it.id ? it : x)); setError(e instanceof Error ? e.message : 'Could not save the change. Try again.'); }
  };

  const q = search.trim().toLowerCase();
  const filtered = items.filter(it => {
    if (category !== 'all' && it.category !== category) return false;
    if (q && !`${it.brand} ${it.model_name} ${it.display_label ?? ''} ${it.dealer_name ?? ''}`.toLowerCase().includes(q)) return false;
    if (stockFilter === 'in_stock' && !it.in_stock) return false;
    if (stockFilter === 'out_of_stock' && it.in_stock) return false;
    if (activeFilter === 'active' && !it.is_active) return false;
    if (activeFilter === 'inactive' && it.is_active) return false;
    return true;
  }).sort((a, b) => {
    const d = sort.key === 'price' ? Number(a.price_per_unit) - Number(b.price_per_unit)
      : sort.key === 'stock' ? Number(b.in_stock) - Number(a.in_stock)
      : `${a.brand} ${a.model_name}`.localeCompare(`${b.brand} ${b.model_name}`);
    return d * sort.dir;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const catCounts = items.reduce<Record<string, number>>((acc, it) => { acc[it.category] = (acc[it.category] || 0) + 1; return acc; }, {});
  const selected = items.find(it => it.id === selectedId) ?? null;
  const hasFilters = stockFilter !== 'all' || activeFilter !== 'all' || q !== '';

  const specChips = (it: ProductCatalogItem): string => {
    const s = it.specs as any ?? {};
    const parts = it.category === 'panels' ? [s.wp && `${s.wp} Wp`, s.technology, s.dcr !== undefined ? (s.dcr ? 'DCR' : 'non-DCR') : null]
      : it.category === 'inverters' ? [s.kw && `${s.kw} kW`, s.phases && (Number(s.phases) === 3 ? '3-phase' : '1-phase'), s.type]
      : it.category === 'batteries' ? [s.kwh && `${s.kwh} kWh`, s.chemistry, s.voltage && `${s.voltage} V`]
      : Object.entries(s).slice(0, 3).map(([k, v]) => `${prettyKey(k)} ${prettyVal(v)}`);
    return parts.filter(Boolean).join('  ·  ') || '–';
  };

  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }));
  const sortHead = (key: SortKey, label: string, right = false) => (
    <TableHead aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={right ? 'text-right' : ''}>
      <button type="button" onClick={() => sortBy(key)} className="cursor-pointer hover:text-foreground">
        {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </TableHead>
  );

  const rail = CATEGORY_TABS.filter(ct => ct.id === 'all' || catCounts[ct.id] || ct.id === category);

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<Package size={20} color="white" />}
        title="Product Catalog"
        subtitle="Panels, inverters, batteries and balance-of-system parts"
        rightSlot={
          <div className="flex gap-2">
            <button type="button" onClick={() => setImportOpen(true)} className="ui-btn ui-btn--support">Import CSV</button>
            <button type="button" onClick={() => setModal({ open: true, item: null })} className="ui-btn ui-btn--main">Add product</button>
          </div>
        }
      />

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button type="button" onClick={load} className="ui-btn ui-btn--support ui-btn--sm" style={{ marginLeft: 12 }}>Try again</button>
        </div>
      )}

      <div className="[display:grid] grid-cols-1 gap-4 md:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_320px] 2xl:grid-cols-[200px_minmax(0,1fr)_340px]">
        <nav aria-label="Categories" className="rounded-[20px] border border-border bg-card p-2">
          <div className="flex gap-1 overflow-x-auto md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:flex-col md:overflow-y-auto">
          {rail.map(ct => {
            const on = category === ct.id;
            const n = ct.id === 'all' ? items.length : (catCounts[ct.id] || 0);
            return (
              <button key={ct.id} type="button" aria-pressed={on} onClick={() => setCategory(ct.id)}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-left text-sm md:rounded-xl ${on ? 'bg-primary/10 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <span>{ct.id === 'all' ? 'All products' : catLabel(ct.id)}</span>
                <span className="font-mono text-[0.8125rem]">{n}</span>
              </button>
            );
          })}
          </div>
        </nav>

        <section aria-label="Products" className="min-w-0 overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3.5">
            <Input type="search" aria-label="Search products" placeholder="Search brand, model or dealer"
              value={search} onChange={e => setSearch(e.target.value)} className="max-w-80 flex-[1_1_200px]" />
            <StyledSelect value={stockFilter} onChange={v => setStockFilter(v as typeof stockFilter)} isDark={isDark} className="w-auto min-w-[130px]"
              options={[{ value: 'all', label: 'All stock' }, { value: 'in_stock', label: 'In stock' }, { value: 'out_of_stock', label: 'Out of stock' }]} />
            <StyledSelect value={activeFilter} onChange={v => setActiveFilter(v as typeof activeFilter)} isDark={isDark} className="w-auto min-w-[130px]"
              options={[{ value: 'all', label: 'All status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            {hasFilters && <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => { setSearch(''); setStockFilter('all'); setActiveFilter('all'); }}>Clear filters</button>}
            <span className="ml-auto font-mono text-[0.85rem] text-muted-foreground">{filtered.length} of {items.length} products</span>
          </div>

          {loading ? (
            <p className="m-0 px-5 py-12 text-center text-sm text-muted-foreground">Loading the catalog…</p>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Package size={40} strokeWidth={1.25} className="mx-auto mb-3 text-muted-foreground" />
              <p className="m-0 font-semibold">{items.length === 0 ? 'No products yet' : 'No products match'}</p>
              <p className="m-0 mt-1 text-sm text-muted-foreground">{items.length === 0 ? 'Use Add product to create the first one.' : 'Change the search or the filters.'}</p>
            </div>
          ) : (
            <Table containerClassName="rounded-none border-0">
              <TableHeader>
                <TableRow>
                  {sortHead('product', 'Product')}
                  <TableHead>Key specs</TableHead>
                  {sortHead('price', 'Price', true)}
                  {/* Dealer is in the side panel; the column only fits on wide screens */}
                  <TableHead className="hidden 2xl:table-cell">Dealer</TableHead>
                  {sortHead('stock', 'Stock')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map(it => (
                  <TableRow key={it.id} tabIndex={0} aria-selected={it.id === selectedId}
                    onClick={() => setSelectedId(it.id)}
                    onKeyDown={e => { if (e.key === 'Enter') setSelectedId(it.id); }}
                    className={`cursor-pointer ${it.id === selectedId ? 'bg-primary/10' : ''}`}>
                    <TableCell className="min-w-[180px] whitespace-normal">
                      <div className="font-medium">{it.brand}</div>
                      <div className="text-sm text-muted-foreground">{it.model_name}</div>
                    </TableCell>
                    <TableCell className="min-w-[140px] max-w-[300px] whitespace-normal font-mono text-sm leading-snug">{specChips(it)}</TableCell>
                    <TableCell className="text-right font-mono">{money(it.price_per_unit)}<span className="text-sm text-muted-foreground"> /{it.price_unit}</span></TableCell>
                    <TableCell className="hidden max-w-[180px] 2xl:table-cell">
                      <div className="truncate">{it.dealer_name || '–'}</div>
                      {it.dealer_location && <div className="text-sm text-muted-foreground">{it.dealer_location}</div>}
                    </TableCell>
                    <TableCell>
                      {it.is_active
                        ? <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.in_stock ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-500'}`}><span className="size-[7px] rounded-full bg-current" />{it.in_stock ? 'In stock' : 'Out of stock'}</span>
                        : <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Inactive</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="font-mono text-[0.85rem] text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside aria-label="Product details" aria-live="polite" className="rounded-[20px] border border-border bg-card md:col-span-2 xl:col-span-1">
          <div>
          {!selected ? (
            <p className="m-0 px-6 py-16 text-center text-sm text-muted-foreground">Pick a product to see its specs, price and dealer here.</p>
          ) : (
            <>
              <div className="border-b border-border px-5 pb-4 pt-4">
                <div className="text-sm text-muted-foreground">{catLabel(selected.category)}</div>
                <h2 className="m-0 mb-2 text-xl font-semibold leading-tight">{selected.brand} {selected.model_name}</h2>
                <div className="font-mono text-[1.75rem] font-medium text-primary">{money(selected.price_per_unit)}<span className="text-sm text-muted-foreground"> per {selected.price_unit}</span></div>
              </div>
              <DetailList title="Specs" rows={Object.entries(selected.specs ?? {}).map(([k, v]) => [prettyKey(k), prettyVal(v)] as [string, string])} empty="No specs added yet." />
              <DetailList title="Pricing" rows={[
                ['Margin', selected.margin_pct ? `${Number(selected.margin_pct)} %` : '–'],
                ['GST', selected.gst_pct ? `${Number(selected.gst_pct)} %` : '–'],
                ['Sold as', selected.retail_or_pallet === 'pallet' ? 'Pallet' : 'Retail'],
                ['Price updated', selected.price_updated_on || '–'],
              ]} />
              <DetailList title="Dealer" rows={[
                ['Name', selected.dealer_name || '–'],
                ['Location', selected.dealer_location || '–'],
                ...(selected.stock_notes ? [['Stock note', selected.stock_notes]] as [string, string][] : []),
              ]} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
                <label className="flex items-center gap-2.5 text-sm">
                  <Switch checked={selected.in_stock} onCheckedChange={c => patchItem(selected, { in_stock: c })} /> In stock
                </label>
                <label className="flex items-center gap-2.5 text-sm">
                  <Switch checked={selected.is_active} onCheckedChange={c => patchItem(selected, { is_active: c })} /> Active in quotes
                </label>
              </div>
              <div className="sticky bottom-0 flex gap-2 rounded-b-[20px] border-t border-border bg-card px-5 py-3.5">
                <button type="button" className="ui-btn ui-btn--main flex-1" onClick={() => setModal({ open: true, item: selected })}>Edit product</button>
                <button type="button" className="ui-btn ui-btn--danger" onClick={() => setDeleteTarget(selected)}>Delete</button>
              </div>
            </>
          )}
          </div>
        </aside>
      </div>

      <CatalogFormModal open={modal.open} item={modal.item} isDark={isDark} onClose={() => setModal({ open: false, item: null })} onSaved={load} />
      <ConfirmDialog isDark={isDark} open={!!deleteTarget} title="Delete this product?"
        body={deleteTarget ? `${deleteTarget.brand} ${deleteTarget.model_name} will be removed from the catalog. This cannot be undone.` : undefined}
        confirmLabel="Delete" cancelLabel="Keep it" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <BulkImportModal open={importOpen} isDark={isDark} onClose={() => setImportOpen(false)} onImported={load} />
    </div>
  );
};

export default ProductCatalog;
