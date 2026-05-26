import { SlideNum, SmallLogo, F } from './Slide2Company';

export function Slide8App() {
  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '60px 80px 60px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={8} />
      <SmallLogo />

      <h2 style={{ fontSize: 62, fontWeight: 800, color: '#111', margin: '0 0 36px', textTransform: 'uppercase', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
        Smart Solar + Smart Home<br />with 360Watts App
      </h2>

      <div style={{ flex: 1, display: 'flex', gap: 56, minHeight: 0 }}>
        {/* Left: product boxes */}
        <div style={{ width: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Green box — PV + IoT */}
          <div style={{ background: '#F0FDF4', border: '2px solid #22C55E', borderRadius: 16, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 36, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44 }}>☀️</div>
                <p style={{ fontSize: 20, color: '#166534', margin: '10px 0 0', fontWeight: 600 }}>PV solar system</p>
              </div>
              <span style={{ fontSize: 36, color: '#22C55E', fontWeight: 800 }}>+</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44 }}>📡</div>
                <p style={{ fontSize: 20, color: '#166534', margin: '10px 0 0', fontWeight: 600 }}>IoT Energy hub</p>
              </div>
            </div>
          </div>
          {/* Navy box — smart appliances */}
          <div style={{ background: '#1C3D5A', borderRadius: 16, padding: '28px 32px', flex: 1 }}>
            <p style={{ color: '#E2E8F0', fontSize: 22, margin: '0 0 16px', fontWeight: 600 }}>Smart appliances</p>
            <p style={{ color: '#94A3B8', fontSize: 18, margin: '0 0 4px' }}>Washing machine, AC, water heater…</p>
            <p style={{ color: '#64748B', fontSize: 20, margin: '20px 0 16px', textAlign: 'center', fontWeight: 500 }}>— or —</p>
            <div style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40 }}>🔌</div>
                <p style={{ color: '#CBD5E1', fontSize: 18, margin: '10px 0 0', fontWeight: 500 }}>Smart plugs</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40 }}>🔲</div>
                <p style={{ color: '#CBD5E1', fontSize: 18, margin: '10px 0 0', fontWeight: 500 }}>Smart switches<br /><span style={{ fontSize: 15, color: '#94A3B8' }}>(with energy meter)</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 4 phone placeholders */}
        <div style={{ flex: 1, display: 'flex', gap: 24 }}>
          {[
            { label: 'Monitor Solar' },
            { label: 'Track Financials' },
            { label: 'Predictive Diagnosis' },
            { label: 'Monitor Energy' },
          ].map(p => (
            <div key={p.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Phone frame */}
              <div style={{
                flex: 1, width: '100%', background: '#1C3D5A', borderRadius: 28,
                border: '3px solid #334D66',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Notch */}
                <div style={{ width: 60, height: 14, background: '#0F2233', borderRadius: '0 0 10px 10px', marginTop: 0, flexShrink: 0 }} />
                {/* Screen area */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px' }}>
                  <span style={{ fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 1.5 }}>App screenshot<br />placeholder</span>
                </div>
                {/* Home bar */}
                <div style={{ width: 40, height: 5, background: '#334D66', borderRadius: 3, marginBottom: 10, flexShrink: 0 }} />
              </div>
              <p style={{ fontSize: 18, color: '#22C55E', fontWeight: 700, letterSpacing: '0.05em', margin: 0, textAlign: 'center', textTransform: 'uppercase' }}>{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
