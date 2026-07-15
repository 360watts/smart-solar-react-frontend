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
import { EmptyState } from '../../shared/components/EmptyState';
import PageHeader from '../../shared/layout/PageHeader';

// ── Theme ──────────────────────────────────────────────────────────────────────

const mkT = (isDark: boolean) => ({
  bg:             'var(--background)',
  surface:        'var(--card)',
  surfaceRaised:  isDark ? '#111927' : '#F8FAFC',
  border:         isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,21,26,0.09)',
  borderStrong:   isDark ? 'rgba(255,255,255,0.13)' : 'rgba(18,21,26,0.16)',
  text:           'var(--foreground)',
  textM:          isDark ? '#A8C4DC' : '#374151',
  accent:         '#2FBF71',
  amber:          '#E9B949',
  overlay:        isDark ? 'rgba(8,12,20,0.82)' : 'rgba(0,0,0,0.50)',
  glass:          isDark ? 'rgba(13,19,32,0.97)' : 'rgba(255,255,255,0.98)',
  glassHL:        isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
  inputBg:        isDark ? '#0C1420' : '#FFFFFF',
  inputBorder:    isDark ? 'rgba(255,255,255,0.12)' : 'var(--border-strong)',
});

const inputStyle = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 11px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border-strong)',
  background: isDark ? '#0C1420' : '#FFFFFF',
  color: 'var(--foreground)',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 140ms',
});

const labelStyle = (isDark: boolean): React.CSSProperties => ({
  fontSize: '0.75rem', fontWeight: 600,
  color: isDark ? '#A8C4DC' : '#374151',
  display: 'block', marginBottom: 5,
  fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.01em',
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
  installation: '#34d399',
  iot:          '#f87171',
};

const PAGE_SIZE = 20;

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

const TYPE_COLORS: Record<KVType, string> = { text: '#94bfdc', number: '#60a5fa', boolean: '#22c55e' };

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
          {hint && <span style={{ fontWeight: 400, marginLeft: 6, fontSize: '0.7rem', color: T.textM }}>{hint}</span>}
        </label>
      )}

      {rows.length > 0 && (
        <div style={{ border: rowBorder, borderRadius: 9, overflow: 'hidden', marginBottom: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 76px 30px', background: T.surfaceRaised, borderBottom: rowBorder }}>
            {['Field', 'Value', 'Type', ''].map((h, i) => (
              <div key={i} style={{ padding: '5px 8px', fontSize: '0.65rem', fontWeight: 700, color: T.textM, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>{h}</div>
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
                  <input value={row.key} onChange={e => setRow(row.id, { key: e.target.value })} style={{ ...inputBase, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: catColor }} placeholder="field_name" />
                </div>
                <div style={{ borderRight: rowBorder }}>
                  {row.type === 'boolean' ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px' }}>
                      {['true', 'false'].map(v => (
                        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: T.text, cursor: 'pointer' }}>
                          <input type="radio" name={`kv-${row.id}`} checked={row.value === v} onChange={() => setRow(row.id, { value: v })} style={{ accentColor: '#22c55e' }} />
                          {v === 'true' ? 'Yes' : 'No'}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input type={row.type === 'number' ? 'number' : 'text'} value={row.value} onChange={e => setRow(row.id, { value: e.target.value })} style={inputBase} placeholder="value" />
                  )}
                </div>
                <div style={{ borderRight: rowBorder, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                  <select value={row.type} onChange={e => setRow(row.id, { type: e.target.value as KVType, value: '' })} style={{ ...inputBase, cursor: 'pointer', padding: '2px 4px', fontSize: '0.7rem', fontWeight: 700, color: TYPE_COLORS[row.type], background: `${TYPE_COLORS[row.type]}14`, border: `1px solid ${TYPE_COLORS[row.type]}30`, borderRadius: 5 }}>
                    <option value="text">Text</option>
                    <option value="number">Num</option>
                    <option value="boolean">Y/N</option>
                  </select>
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
          <span style={{ fontSize: '0.68rem', color: T.textM, alignSelf: 'center', fontWeight: 600 }}>Quick add:</span>
          {suggestions.map(s => (
            <button key={s.key} onClick={() => addRow(s.key, '', s.type)}
              style={{ padding: '2px 9px', borderRadius: 99, border: `1px solid ${catColor}35`, background: `${catColor}0d`, cursor: 'pointer', fontSize: '0.68rem', color: catColor, fontFamily: 'JetBrains Mono, monospace', transition: 'all 130ms' }}>
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

// ── Delete modal ───────────────────────────────────────────────────────────────

const DeleteModal: React.FC<{ open: boolean; label: string; onConfirm: () => void; onCancel: () => void; isDark: boolean }> = ({ open, label, onConfirm, onCancel, isDark }) => {
  const T = mkT(isDark);
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: T.overlay, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <motion.div variants={panelVariants} initial="hidden" animate="visible" exit="exit"
            style={{ background: T.glass, border: `1px solid ${T.glassHL}`, borderRadius: 16, width: 400, maxWidth: '95vw', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
            {/* Danger header */}
            <div style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.14) 0%, transparent 60%)', padding: '22px 24px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={18} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: T.text, fontFamily: 'Outfit, Outfit, sans-serif' }}>Delete Product?</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: T.textM }}>This cannot be undone</p>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px 20px' }}>
              <p style={{ margin: '0 0 20px', color: T.textM, fontSize: '0.875rem', lineHeight: 1.55 }}>
                <strong style={{ color: T.text }}>{label}</strong> will be permanently removed from the catalog.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 12px rgba(220,38,38,0.35)', transition: 'background 150ms' }}>
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
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

  const cellS: React.CSSProperties = { padding: '6px 10px', fontSize: '0.73rem', color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 };
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: T.text, fontFamily: 'Outfit, sans-serif' }}>Bulk Import Products</h3>
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, fontFamily: 'Outfit, sans-serif' }}>Download Template</div>
                  <div style={{ fontSize: '0.72rem', color: T.textM, marginTop: 2 }}>CSV with all 16 columns + 2 example rows</div>
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
                  style={{ border: `2px dashed ${dragOver ? '#2FBF71' : T.borderStrong}`, borderRadius: 12, padding: '44px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 180ms', background: dragOver ? 'rgba(47,191,113,0.05)' : 'transparent', boxShadow: dragOver ? '0 0 0 4px rgba(47,191,113,0.1)' : 'none' }}
                >
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                    <Upload size={34} color={dragOver ? '#2FBF71' : T.textM} style={{ marginBottom: 12 }} />
                  </motion.div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: T.text, fontFamily: 'Outfit, sans-serif' }}>Drop file here to import</div>
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
                    <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.73rem', color: T.textM, textDecoration: 'underline' }}>Different file</button>
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: 'auto', maxHeight: 260 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: T.surfaceRaised }}>
                          {['#','category','brand','model','price','unit','stock','dealer','status'].map(h => (
                            <th key={h} style={{ ...cellS, fontWeight: 700, color: T.textM, fontSize: '0.68rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => {
                          const hasErr = row._errors.length > 0;
                          return (
                            <tr key={row._row} style={{ background: hasErr ? (isDark ? 'rgba(239,68,68,0.07)' : '#fff5f5') : ri%2===1 ? T.surfaceRaised : 'transparent' }}>
                              <td style={{ ...cellS, color: T.textM }}>{row._row}</td>
                              <td style={cellS}><span style={{ padding: '1px 7px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: `${CATEGORY_COLORS[row.category]||'#888'}20`, color: CATEGORY_COLORS[row.category]||T.textM }}>{row.category}</span></td>
                              <td style={{ ...cellS, fontWeight: 600 }}>{row.brand}</td>
                              <td style={cellS}>{row.model_name}</td>
                              <td style={{ ...cellS, fontFamily: 'JetBrains Mono, monospace', color: '#E9B949' }}>{row.price_per_unit}</td>
                              <td style={cellS}>{row.price_unit}</td>
                              <td style={{ ...cellS, color: row.in_stock?.toLowerCase() !== 'false' ? '#22c55e' : '#ef4444' }}>{row.in_stock}</td>
                              <td style={cellS}>{row.dealer_name}</td>
                              <td style={{ ...cellS, maxWidth: 200 }}>
                                {hasErr
                                  ? <span style={{ color: '#ef4444', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}><AlertCircle size={11} />{row._errors.join('; ')}</span>
                                  : <span style={{ color: '#2FBF71', fontSize: '0.7rem', fontWeight: 700 }}>✓ OK</span>}
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
                        <span>Importing…</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{progress.done} / {progress.total}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: T.border, overflow: 'hidden' }}>
                        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.2 }}
                          style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #2FBF71 0%, #4DD68A 100%)', boxShadow: '0 0 8px rgba(47,191,113,0.5)' }} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Results */}
              {results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 10, background: results.ok > 0 ? 'rgba(47,191,113,0.1)' : T.surfaceRaised, border: `1px solid ${results.ok > 0 ? 'rgba(47,191,113,0.3)' : T.border}` }}>
                    <CheckCircle2 size={20} color="#2FBF71" />
                    <div style={{ fontSize: '0.9rem', color: T.text }}><strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{results.ok}</strong> product{results.ok !== 1 ? 's' : ''} imported successfully</div>
                  </div>
                  {results.failed.length > 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: 9, background: isDark ? 'rgba(239,68,68,0.07)' : '#fff5f5', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>{results.failed.length} failed:</div>
                      {results.failed.map(f => <div key={f.row} style={{ fontSize: '0.73rem', color: '#ef4444' }}>Row {f.row}: {f.err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: T.surfaceRaised }}>
              <button onClick={onClose} className="btn btn-secondary">{results ? 'Close' : 'Cancel'}</button>
              {rows.length > 0 && !results && (
                <button onClick={handleImport} disabled={importing || validRows.length === 0}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2FBF71 0%, #1a9e5a 100%)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(47,191,113,0.35)', opacity: (importing || validRows.length === 0) ? 0.5 : 1 }}>
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
    if (!form.brand?.trim()) { setErr('Brand is required.'); return; }
    if (!form.model_name?.trim()) { setErr('Model name is required.'); return; }
    if (!form.price_per_unit) { setErr('Price is required.'); return; }
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
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const secLabel = (label: string, icon: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px' }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: catColor, flexShrink: 0 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: T.textM, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>{icon}{label}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );

  const productTitle = [form.brand, form.model_name].filter(Boolean).join(' ') || (item ? `${item.brand} ${item.model_name}` : 'New Product');

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: T.overlay, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <motion.div variants={panelVariants} initial="hidden" animate="visible" exit="exit"
            style={{ background: T.glass, border: `1px solid ${T.glassHL}`, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>

            {/* Gradient header */}
            <div style={{ background: `linear-gradient(135deg, ${catColor}1a 0%, transparent 55%), ${T.surfaceRaised}`, padding: '18px 22px 16px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, boxShadow: `0 0 6px ${catColor}80` }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: catColor, letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>{catLabel}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: T.text, fontFamily: 'Outfit, Outfit, sans-serif', lineHeight: 1.2 }}>{productTitle}</h3>
                </div>
                <button onClick={onClose} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: T.textM, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {secLabel('Product Info', <Package size={11} />)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div>
                  <label style={labelStyle(isDark)}>Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={cat} onChange={e => f('category', e.target.value as ProductCatalogCategory)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                    {ALL_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Brand <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={form.brand ?? ''} onChange={e => f('brand', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., Waaree" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle(isDark)}>Model Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={form.model_name ?? ''} onChange={e => f('model_name', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., TOPCon 700Wp" />
                </div>
              </div>

              {secLabel(cat === 'panels' ? 'Panel Specs' : cat === 'inverters' ? 'Inverter Specs' : cat === 'batteries' ? 'Battery Specs' : 'Specs', <Zap size={11} />)}
              {cat === 'panels' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Wattage (Wp)</label><input type="number" value={form.specs_panels_wp} onChange={e => f('specs_panels_wp', e.target.value)} style={inputStyle(isDark)} placeholder="700" /></div>
                  <div><label style={labelStyle(isDark)}>Efficiency (%)</label><input type="number" value={form.specs_panels_efficiency} onChange={e => f('specs_panels_efficiency', e.target.value)} style={inputStyle(isDark)} placeholder="21.3" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Technology</label>
                    <select value={form.specs_panels_technology} onChange={e => f('specs_panels_technology', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                      <option value="">— Select —</option>
                      {['Mono PERC','TOPCon','Bifacial TOPCon','HJT','Bifacial PERC','Polycrystalline'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                    <input type="checkbox" checked={form.specs_panels_dcr} onChange={e => f('specs_panels_dcr', e.target.checked)} style={{ width: 16, height: 16, accentColor: catColor, cursor: 'pointer' }} />
                    <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>DCR (Dual-Cut Ribbon)</label>
                  </div>
                </div>
              )}
              {cat === 'inverters' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Power (kW)</label><input type="number" value={form.specs_inv_kw} onChange={e => f('specs_inv_kw', e.target.value)} style={inputStyle(isDark)} placeholder="10" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Type</label>
                    <select value={form.specs_inv_type} onChange={e => f('specs_inv_type', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                      {['on-grid','hybrid','off-grid','micro','string'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle(isDark)}>Phases</label>
                    <select value={form.specs_inv_phases} onChange={e => f('specs_inv_phases', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                      <option value="1">Single Phase</option><option value="3">Three Phase</option>
                    </select>
                  </div>
                </div>
              )}
              {cat === 'batteries' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <div><label style={labelStyle(isDark)}>Capacity (kWh)</label><input type="number" value={form.specs_bat_kwh} onChange={e => f('specs_bat_kwh', e.target.value)} style={inputStyle(isDark)} placeholder="5.12" /></div>
                  <div><label style={labelStyle(isDark)}>Nominal Voltage (V)</label><input type="number" value={form.specs_bat_voltage} onChange={e => f('specs_bat_voltage', e.target.value)} style={inputStyle(isDark)} placeholder="51.2" /></div>
                  <div>
                    <label style={labelStyle(isDark)}>Chemistry</label>
                    <select value={form.specs_bat_chemistry} onChange={e => f('specs_bat_chemistry', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                      {['LiFePO4','NMC','Lead Acid','NCA'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {!isStructured && <KVEditor key={`kv-g-${cat}`} value={form.specs_generic} onChange={v => f('specs_generic', v)} category={cat} isDark={isDark} label="Specs" hint="fields that describe this product" />}
              {isStructured && <KVEditor key={`kv-e-${cat}`} value={form.specs_extra} onChange={v => f('specs_extra', v)} category={cat} isDark={isDark} label="Additional specs" hint="optional · merged with fields above" />}

              {secLabel('Pricing', <Tag size={11} />)}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 11 }}>
                <div>
                  <label style={labelStyle(isDark)}>Price Per Unit <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" value={form.price_per_unit ?? ''} onChange={e => f('price_per_unit', e.target.value)} style={inputStyle(isDark)} placeholder="23.5" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Unit</label>
                  <select value={form.price_unit ?? 'nos'} onChange={e => f('price_unit', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                    {['Wp','nos','kWh','kW','set','m','kg'].map(u => <option key={u} value={u}>₹/{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Margin %</label>
                  <input type="number" value={form.margin_pct ?? ''} onChange={e => f('margin_pct', e.target.value)} style={inputStyle(isDark)} placeholder="12" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>GST %</label>
                  <input type="number" value={form.gst_pct ?? ''} onChange={e => f('gst_pct', e.target.value)} style={inputStyle(isDark)} placeholder="18" />
                </div>
                <div>
                  <label style={labelStyle(isDark)}>Retail / Pallet</label>
                  <select value={form.retail_or_pallet ?? 'retail'} onChange={e => f('retail_or_pallet', e.target.value)} style={{ ...inputStyle(isDark), cursor: 'pointer' }}>
                    <option value="retail">Retail</option><option value="pallet">Pallet</option>
                  </select>
                </div>
                <div style={{ gridColumn: '2 / -1' }}>
                  <label style={labelStyle(isDark)}>Price Updated On</label>
                  <input type="date" value={form.price_updated_on ?? ''} onChange={e => f('price_updated_on', e.target.value || null)} style={inputStyle(isDark)} />
                </div>
              </div>

              {secLabel('Dealer & Stock', <Store size={11} />)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div><label style={labelStyle(isDark)}>Dealer Name</label><input value={form.dealer_name ?? ''} onChange={e => f('dealer_name', e.target.value)} style={inputStyle(isDark)} placeholder="SolarXL Distributors" /></div>
                <div><label style={labelStyle(isDark)}>Dealer Location</label><input value={form.dealer_location ?? ''} onChange={e => f('dealer_location', e.target.value)} style={inputStyle(isDark)} placeholder="Coimbatore" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle(isDark)}>Stock Notes</label><input value={form.stock_notes ?? ''} onChange={e => f('stock_notes', e.target.value)} style={inputStyle(isDark)} placeholder="e.g., Pallet of 36" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.in_stock ?? true} onChange={e => f('in_stock', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
                  <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>In Stock</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_active ?? true} onChange={e => f('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: catColor, cursor: 'pointer' }} />
                  <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>Active</label>
                </div>
              </div>

              {secLabel('Display Order', <ListOrdered size={11} />)}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 11, alignItems: 'start' }}>
                <div><label style={labelStyle(isDark)}>Sort Order</label><input type="number" value={form.sort_order ?? 0} onChange={e => f('sort_order', Number(e.target.value))} style={inputStyle(isDark)} placeholder="0" /></div>
                <p style={{ margin: '22px 0 0', fontSize: '0.73rem', color: T.textM, lineHeight: 1.55 }}>Lower numbers appear first. Equal sort orders fall back to alphabetical by brand.</p>
              </div>

              {err && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', color: '#ef4444', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.28)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} />{err}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: T.surfaceRaised }}>
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: saving ? T.border : 'linear-gradient(135deg, #2FBF71 0%, #1a9e5a 100%)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', boxShadow: saving ? 'none' : '0 4px 14px rgba(47,191,113,0.35)', transition: 'all 150ms' }}>
                {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Product'}
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

const ProductCatalog: React.FC = () => {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileEquipment />;

  const { isDark } = useTheme();
  const T = mkT(isDark);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all'|'in_stock'|'out_of_stock'>('all');
  const [activeFilter, setActiveFilter] = useState<'all'|'active'|'inactive'>('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; item: ProductCatalogItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<ProductCatalogItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const cat = category === 'all' ? undefined : category;
      const data = await apiService.getProductCatalog(cat);
      setItems(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load catalog'); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, stockFilter, activeFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await apiService.deleteProductCatalogItem(deleteTarget.id); setDeleteTarget(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const filtered = items.filter(it => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!it.brand.toLowerCase().includes(q) && !it.model_name.toLowerCase().includes(q) && !(it.display_label ?? '').toLowerCase().includes(q) && !(it.dealer_name ?? '').toLowerCase().includes(q)) return false;
    }
    if (stockFilter === 'in_stock' && !it.in_stock) return false;
    if (stockFilter === 'out_of_stock' && it.in_stock) return false;
    if (activeFilter === 'active' && !it.is_active) return false;
    if (activeFilter === 'inactive' && it.is_active) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Per-category counts for tab badges
  const catCounts = items.reduce<Record<string, number>>((acc, it) => { acc[it.category] = (acc[it.category] || 0) + 1; return acc; }, {});

  // Spec chips for table rows
  const specChips = (it: ProductCatalogItem): string[] => {
    const s = it.specs as any ?? {};
    if (it.category === 'panels') return [s.wp && `${s.wp}Wp`, s.technology, s.dcr !== undefined ? (s.dcr ? 'DCR' : 'non-DCR') : null].filter(Boolean) as string[];
    if (it.category === 'inverters') return [s.kw && `${s.kw}kW`, s.phases && (s.phases === 3 ? '3-ph' : '1-ph'), s.type].filter(Boolean) as string[];
    if (it.category === 'batteries') return [s.kwh && `${s.kwh}kWh`, s.chemistry, s.voltage && `${s.voltage}V`].filter(Boolean) as string[];
    return Object.entries(s).slice(0, 2).map(([k, v]) => `${k}: ${v}`);
  };

  const hasActiveFilters = stockFilter !== 'all' || activeFilter !== 'all' || search.trim() !== '';

  // Stats
  const inStockPct = items.length ? Math.round(items.filter(i => i.in_stock).length / items.length * 100) : 0;
  const activeCnt = items.filter(i => i.is_active).length;
  const categoryCnt = new Set(items.map(i => i.category)).size;

  const filterPill = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{
      padding: '4px 11px', borderRadius: 99, border: `1px solid ${active ? T.accent : T.border}`,
      cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 140ms',
      background: active ? (isDark ? 'rgba(47,191,113,0.15)' : 'rgba(47,191,113,0.10)') : 'transparent',
      color: active ? T.accent : T.textM,
    }}>{children}</button>
  );

  const dotGrid = isDark
    ? 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)'
    : 'radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px)';

  const thStyle: React.CSSProperties = { padding: '10px 14px', fontSize: '0.68rem', fontWeight: 700, color: T.textM, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif', borderBottom: `1px solid ${T.border}`, background: T.surfaceRaised, whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle', borderBottom: `1px solid ${T.border}` };

  return (
    <div className="admin-container responsive-page" style={{ backgroundImage: dotGrid, backgroundSize: '22px 22px' }}>
      <PageHeader
        icon={<Package size={20} color="white" />}
        title="Product Catalog"
        subtitle="Solar panels, inverters, batteries & BOS"
        rightSlot={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setImportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: T.textM, transition: 'all 140ms' }}>
              <Upload size={14} /> Import
            </button>
            <button onClick={() => setModal({ open: true, item: null })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2FBF71 0%, #1a9e5a 100%)', color: '#fff', fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(47,191,113,0.35)', transition: 'all 140ms' }}>
              <Plus size={14} /> Add Product
            </button>
          </div>
        }
      />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Products', value: items.length, color: T.accent },
          { label: 'In Stock', value: `${inStockPct}%`, color: '#22c55e' },
          { label: 'Active', value: activeCnt, color: T.amber },
          { label: 'Categories', value: categoryCnt, color: '#60a5fa' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.28 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: 10, background: T.surfaceRaised, border: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.05rem', color: s.color, lineHeight: 1 }}>{loading ? '—' : s.value}</span>
            <span style={{ fontSize: '0.7rem', color: T.textM, fontWeight: 500 }}>{s.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {CATEGORY_TABS.map(ct => {
          const active = category === ct.id;
          const color = ct.id === 'all' ? T.accent : (CATEGORY_COLORS[ct.id] || T.accent);
          const cnt = ct.id === 'all' ? items.length : (catCounts[ct.id] || 0);
          return (
            <button key={ct.id} onClick={() => setCategory(ct.id)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 99, border: `1px solid ${active ? color + '55' : T.border}`,
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, transition: 'all 160ms', fontFamily: 'DM Sans, sans-serif',
              background: active ? `${color}18` : T.surfaceRaised,
              color: active ? color : T.textM,
              boxShadow: active ? `0 0 0 1px ${color}30, 0 0 14px ${color}20` : 'none',
            }}>
              <span style={{ fontSize: '0.82rem' }}>{ct.emoji}</span>
              {ct.label}
              {cnt > 0 && <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', opacity: 0.75 }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Filters + search toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {filterPill(stockFilter === 'all', () => setStockFilter('all'), 'All stock')}
        {filterPill(stockFilter === 'in_stock', () => setStockFilter('in_stock'), '✅ In Stock')}
        {filterPill(stockFilter === 'out_of_stock', () => setStockFilter('out_of_stock'), '❌ Out')}
        <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
        {filterPill(activeFilter === 'all', () => setActiveFilter('all'), 'All status')}
        {filterPill(activeFilter === 'active', () => setActiveFilter('active'), '● Active')}
        {filterPill(activeFilter === 'inactive', () => setActiveFilter('inactive'), '○ Inactive')}
        {hasActiveFilters && (
          <button onClick={() => { setSearch(''); setStockFilter('all'); setActiveFilter('all'); }}
            style={{ padding: '4px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
            ✕ Clear
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.75rem', color: T.textM }}>{filtered.length} of {items.length}</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textM, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brand, model…"
              style={{ ...inputStyle(isDark), paddingLeft: 30, width: 200, fontSize: '0.8rem' }} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '11px 16px', borderRadius: 9, background: isDark ? 'rgba(239,68,68,0.10)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.30)', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={load} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.22)' : '0 1px 8px rgba(18,21,26,0.07)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textM, fontSize: '0.875rem' }}>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }}>Loading catalog…</motion.div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48 }}><EmptyState title={hasActiveFilters ? 'No results' : 'No products yet'} description={hasActiveFilters ? 'Try adjusting your search or filters.' : 'Add the first product to the catalog.'} /></div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Brand / Model</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Specs</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Dealer</th>
                  <th style={thStyle}>Stock</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(it => {
                  const cc = CATEGORY_COLORS[it.category] || T.accent;
                  const isHovered = hoveredRow === it.id;
                  const chips = specChips(it);
                  return (
                    <tr key={it.id} onMouseEnter={() => setHoveredRow(it.id)} onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: isHovered ? (isDark ? 'rgba(255,255,255,0.024)' : 'rgba(0,0,0,0.014)') : 'transparent', transition: 'background 120ms' }}>

                      {/* Brand / Model — colored left border via borderLeft on first td */}
                      <td style={{ ...tdStyle, borderLeft: `3px solid ${cc}` }}>
                        <div style={{ fontWeight: 700, color: T.text, fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem' }}>{it.brand}</div>
                        <div style={{ fontSize: '0.75rem', color: T.textM, marginTop: 1 }}>{it.model_name}</div>
                      </td>

                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: `${cc}1a`, color: cc, border: `1px solid ${cc}30` }}>
                          {it.category}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {chips.length > 0 ? chips.map((chip, i) => (
                            <span key={i} style={{ padding: '1px 7px', borderRadius: 4, fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', background: T.surfaceRaised, color: T.textM, border: `1px solid ${T.border}` }}>{chip}</span>
                          )) : <span style={{ color: T.textM, fontSize: '0.75rem' }}>—</span>}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {it.price_per_unit ? (
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: T.amber, fontSize: '0.88rem' }}>
                            ₹{Number(it.price_per_unit).toLocaleString('en-IN')}<span style={{ fontSize: '0.72rem', fontWeight: 400, color: T.textM }}>/{it.price_unit}</span>
                          </span>
                        ) : <span style={{ color: T.textM }}>—</span>}
                      </td>

                      <td style={{ ...tdStyle, maxWidth: 140 }}>
                        {it.dealer_name ? (
                          <>
                            <div style={{ fontSize: '0.8rem', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.dealer_name}</div>
                            {it.dealer_location && <div style={{ fontSize: '0.7rem', color: T.textM }}>{it.dealer_location}</div>}
                          </>
                        ) : <span style={{ color: T.textM }}>—</span>}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, color: it.in_stock ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 8 }}>●</span>{it.in_stock ? 'In Stock' : 'Out'}
                          </span>
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: it.is_active ? 'rgba(34,197,94,0.10)' : 'rgba(148,163,184,0.12)', color: it.is_active ? '#22c55e' : T.textM, fontWeight: 600, width: 'fit-content' }}>
                            {it.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', opacity: isHovered ? 1 : 0.2, transition: 'opacity 140ms' }}>
                          <button onClick={() => setModal({ open: true, item: it })}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: `1px solid ${T.border}`, background: T.surfaceRaised, cursor: 'pointer', color: T.textM, transition: 'all 120ms' }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(it)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', cursor: 'pointer', color: '#ef4444', transition: 'all 120ms' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: T.surfaceRaised }}>
            <span style={{ fontSize: '0.75rem', color: T.textM, fontFamily: 'JetBrains Mono, monospace' }}>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ label: '«', onClick: () => setPage(1), disabled: safePage === 1 }, { label: '‹', onClick: () => setPage(p => Math.max(1, p-1)), disabled: safePage === 1 }].map(btn => (
                <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', cursor: btn.disabled ? 'default' : 'pointer', fontSize: '0.8rem', color: T.textM, opacity: btn.disabled ? 0.35 : 1 }}>
                  {btn.label}
                </button>
              ))}
              {Array.from({ length: totalPages }, (_, i) => i+1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number|'…')[]>((acc, p, i, arr) => { if (i > 0 && (p as number)-(arr[i-1] as number) > 1) acc.push('…'); acc.push(p); return acc; }, [])
                .map((p, i) => p === '…' ? (
                  <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: '0.8rem', color: T.textM }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${safePage === p ? T.accent : T.border}`, background: safePage === p ? `${T.accent}20` : 'transparent', cursor: 'pointer', fontSize: '0.8rem', fontWeight: safePage === p ? 700 : 400, color: safePage === p ? T.accent : T.textM, minWidth: 32 }}>
                    {p}
                  </button>
                ))
              }
              {[{ label: '›', onClick: () => setPage(p => Math.min(totalPages, p+1)), disabled: safePage === totalPages }, { label: '»', onClick: () => setPage(totalPages), disabled: safePage === totalPages }].map(btn => (
                <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', cursor: btn.disabled ? 'default' : 'pointer', fontSize: '0.8rem', color: T.textM, opacity: btn.disabled ? 0.35 : 1 }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && totalPages <= 1 && (
          <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border}`, fontSize: '0.75rem', color: T.textM, background: T.surfaceRaised }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <CatalogFormModal open={modal.open} item={modal.item} isDark={isDark} onClose={() => setModal({ open: false, item: null })} onSaved={load} />
      <DeleteModal open={!!deleteTarget} label={deleteTarget ? `${deleteTarget.brand} ${deleteTarget.model_name}` : ''} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDark={isDark} />
      <BulkImportModal open={importOpen} isDark={isDark} onClose={() => setImportOpen(false)} onImported={load} />
    </div>
  );
};

export default ProductCatalog;
