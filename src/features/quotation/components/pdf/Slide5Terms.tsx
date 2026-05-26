import { SlideNum, SmallLogo, F } from './Slide2Company';

export function Slide5Terms() {
  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '72px 80px 72px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={5} />
      <SmallLogo />

      <h2 style={{ fontSize: 80, fontWeight: 800, color: '#111', margin: '0 0 52px', textTransform: 'uppercase', letterSpacing: '-2px' }}>
        Terms &amp; Conditions
      </h2>

      {/* Take-back promise row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 48, marginBottom: 72 }}>
        <div style={{
          width: 160, height: 160, borderRadius: '50%', background: '#1C3D5A', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{'12\nmonths'}</span>
        </div>
        <p style={{ fontSize: 32, color: '#222', margin: 0, fontWeight: 400, lineHeight: 1.5 }}>
          Take-back promise if unsatisfied with solar performance<br />
          <span style={{ fontSize: 26, color: '#555' }}>(all except labour costs)</span>
        </p>
      </div>

      {/* 3 warranty circles */}
      <div style={{ display: 'flex', gap: 120, alignItems: 'flex-start' }}>
        {[
          { label: 'Solar\ninverter', sub1: '10 years of warranty', sub2: '' },
          { label: 'Solar\npanels', sub1: '12 years of performance guarantee', sub2: '20–25 years of product warranty' },
          { label: 'Repair &\nservice', sub1: '5 years of warranty', sub2: '' },
        ].map(c => (
          <div key={c.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{
              width: 210, height: 210, borderRadius: '50%', background: '#22C55E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 28, fontWeight: 800, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{c.label}</span>
            </div>
            <div style={{ textAlign: 'center', maxWidth: 280 }}>
              <p style={{ fontSize: 24, color: '#222', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>{c.sub1}</p>
              {c.sub2 && <p style={{ fontSize: 22, color: '#555', margin: '6px 0 0', lineHeight: 1.5 }}>{c.sub2}</p>}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 20, color: '#888', marginTop: 'auto', paddingTop: 24, fontStyle: 'italic' }}>
        * Does not cover accidental and other damages caused by natural or man-made events.
      </p>
    </div>
  );
}
