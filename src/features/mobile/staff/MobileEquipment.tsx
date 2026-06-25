import React, { useState, useEffect, useCallback } from 'react';
import { apiService, ProductCatalogItem } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import finalLogo from '../../../assets/finalLogo.png';
import { Package, Menu } from 'lucide-react';

type Category = 'all' | 'panels' | 'inverters' | 'batteries';

const CATEGORY_TABS: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',       label: 'All',       emoji: '📦' },
  { id: 'panels',    label: 'Panels',    emoji: '☀️' },
  { id: 'inverters', label: 'Inverters', emoji: '⚡' },
  { id: 'batteries', label: 'Batteries', emoji: '🔋' },
];

const CATEGORY_COLORS: Record<string, string> = {
  panels:    '#10ffcb',
  inverters: '#60a5fa',
  batteries: '#fbbf24',
};

const specSummary = (item: ProductCatalogItem): string => {
  const s = item.specs as any;
  if (item.category === 'panels') return s.wp ? `${s.wp}Wp${s.technology ? ' · ' + s.technology : ''}` : '';
  if (item.category === 'inverters') return s.kw ? `${s.kw}kW${s.type ? ' · ' + s.type : ''}` : '';
  if (item.category === 'batteries') return s.kwh ? `${s.kwh}kWh${s.chemistry ? ' · ' + s.chemistry : ''}` : '';
  return '';
};

const MobileEquipment: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';

  const [category, setCategory] = useState<Category>('all');
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const cat = category === 'all' ? undefined : category;
      const data = await apiService.getProductCatalog(cat);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: isDark ? 'rgba(10,14,24,0.9)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <img src={finalLogo} alt="360Watts" style={{ height: 28, width: 'auto' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif" }}>Product Catalog</div>
          <div style={{ fontSize: '0.65rem', color: muted }}>Solar panels, inverters & batteries</div>
        </div>
        <Package size={18} color={accent} />
      </div>

      {/* Category tabs */}
      <div style={{ padding: '10px 12px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {CATEGORY_TABS.map(ct => (
          <button
            key={ct.id}
            onClick={() => setCategory(ct.id)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              background: category === ct.id ? accent : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
              color: category === ct.id ? '#fff' : muted,
              transition: 'all 150ms',
            }}
          >
            {ct.emoji} {ct.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '10px 14px', fontSize: '0.75rem', color: '#F87171' }}>
          {error}
          <button onClick={load} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: '0.75rem' }}>Retry</button>
        </div>
      )}

      {/* List */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: muted, fontSize: '0.85rem', padding: 32 }}>Loading catalog…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: muted, fontSize: '0.85rem', padding: 32 }}>No products found.</div>
        ) : (
          items.map(it => (
            <div key={it.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: text }}>{it.brand}</div>
                  <div style={{ fontSize: '0.75rem', color: muted }}>{it.model_name}</div>
                </div>
                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, background: isDark ? `${CATEGORY_COLORS[it.category]}18` : `${CATEGORY_COLORS[it.category]}22`, color: CATEGORY_COLORS[it.category] }}>
                  {it.category}
                </span>
              </div>
              {specSummary(it) && (
                <div style={{ fontSize: '0.75rem', color: muted }}>{specSummary(it)}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: text }}>
                  {it.price_per_unit ? `₹${Number(it.price_per_unit).toLocaleString('en-IN')} / ${it.price_unit}` : '—'}
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: it.in_stock ? accent : '#ef4444' }}>
                  {it.in_stock ? '● In Stock' : '● Out of Stock'}
                </span>
              </div>
              {it.dealer_name && (
                <div style={{ fontSize: '0.7rem', color: muted }}>{it.dealer_name}{it.dealer_location ? ` · ${it.dealer_location}` : ''}</div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '8px 12px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.7rem', color: muted }}>Use desktop to add or edit catalog products</div>
      </div>
    </div>
  );
};

export default MobileEquipment;
