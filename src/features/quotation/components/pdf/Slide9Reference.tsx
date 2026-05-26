import { F } from './Slide2Company';

const DEFAULT_SITES = [
  { label: '6 kWp — Residential', src: '/assets/ref-6kw.jpg' },
  { label: '8 kWp — Residential', src: '/assets/ref-8kw.jpg' },
  { label: '20 kWp — Commercial', src: '/assets/ref-20kw.jpg' },
];

interface Props {
  overrides?: (string | null)[];
}

export function Slide9Reference({ overrides = [] }: Props) {
  const sites = DEFAULT_SITES.map((s, i) => ({
    ...s,
    src: overrides[i] || s.src,
  }));

  return (
    <div style={{ width: 1920, height: 1080, display: 'flex', fontFamily: F, background: '#fff', flexDirection: 'column' }}>
      {/* Navy header bar */}
      <div style={{ background: '#1C3D5A', padding: '44px 80px 40px' }}>
        <p style={{ color: '#64748B', fontSize: 18, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>Our Work</p>
        <h2 style={{ color: '#fff', fontSize: 72, fontWeight: 800, margin: 0, letterSpacing: '-1.5px' }}>Reference Installations</h2>
      </div>

      {/* 3 photo columns */}
      <div style={{ flex: 1, display: 'flex', padding: '36px 80px 44px', gap: 32, minHeight: 0 }}>
        {sites.map(site => (
          <div key={site.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ flex: 1, borderRadius: 16, overflow: 'hidden', background: '#E2E8F0', position: 'relative' }}>
              <img
                src={site.src}
                alt={site.label}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 55%)',
                display: 'flex', alignItems: 'flex-end', padding: '28px 28px',
              }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.3px' }}>{site.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Brand gradient bar */}
      <div style={{ height: 8, background: 'linear-gradient(to right, #1C3D5A, #F97316, #22C55E)' }} />
    </div>
  );
}
