export const F = 'Inter, Arial, sans-serif';

export const SlideNum = ({ n }: { n: number }) => (
  <div style={{
    position: 'absolute', top: 44, right: 80,
    border: '2px solid #F97316', borderRadius: 8,
    padding: '8px 22px', color: '#F97316', fontSize: 24, fontWeight: 700, fontFamily: F,
    zIndex: 10,
  }}>{n}</div>
);

export const SmallLogo = () => (
  <div style={{ position: 'absolute', bottom: 44, right: 80, zIndex: 10 }}>
    <img src="/finalLogo.png" alt="360watts" style={{ height: 64, display: 'block' }} />
  </div>
);

export function Slide2Company() {
  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '72px 80px 72px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={2} />
      <SmallLogo />

      {/* Heading */}
      <h2 style={{ fontSize: 80, fontWeight: 800, color: '#111', margin: '0 0 40px', letterSpacing: '-2px', textTransform: 'uppercase' }}>
        Company Overview
      </h2>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, gap: 80 }}>
        {/* Left: text + circles + tagline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, lineHeight: 1.8, color: '#333', flex: 1 }}>
            <p style={{ margin: '0 0 20px' }}>360watts is a technology-led solar energy company that makes solar simple and stress-free.</p>
            <p style={{ margin: '0 0 20px' }}>We design and install smart solar PV systems that bring more energy savings — track and control your energy through our mobile app.</p>
            <p style={{ margin: '0 0 20px' }}>We remain your single point of contact for everything: installation, monitoring, service, and upgrades — for the next 20+ years.</p>
            <p style={{ margin: 0 }}>We work with trusted, experienced partners to ensure high-quality execution and long-term performance.</p>
          </div>

          {/* 3 circles */}
          <div style={{ display: 'flex', gap: 52, alignItems: 'center', marginTop: 44 }}>
            {[
              { bg: '#1C3D5A', label: '20+ years\nof solar' },
              { bg: '#F97316', label: 'Modular\nhome\nautomation' },
              { bg: '#22C55E', label: 'Single\ncontact for\nservices' },
            ].map(c => (
              <div key={c.label} style={{
                width: 168, height: 168, borderRadius: '50%', background: c.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Tagline */}
          <p style={{ fontSize: 28, color: '#333', margin: '28px 0 0', fontWeight: 400, lineHeight: 1.5 }}>
            Designed for today's{' '}
            <span style={{ color: '#22C55E', fontWeight: 700 }}>savings</span>
            {' '}and tomorrow's{' '}
            <span style={{ color: '#F97316', fontWeight: 700 }}>energy independence</span>.
          </p>
        </div>

        {/* Right: large logo centred */}
        <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <img src="/logo_with_font.png" alt="360watts" style={{ width: 380, display: 'block' }} />
          <p style={{ fontSize: 26, color: '#555', margin: 0, fontWeight: 400, letterSpacing: '0.02em', textAlign: 'center' }}>Drive what's next.</p>
        </div>
      </div>
    </div>
  );
}
