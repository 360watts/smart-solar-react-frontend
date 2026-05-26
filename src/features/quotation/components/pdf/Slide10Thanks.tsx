import { F, SmallLogo } from './Slide2Company';

export function Slide10Thanks() {
  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', overflow: 'hidden' }}>

      {/* Navy diagonal triangle — top right (mirrors cover) */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 1920, height: 1080,
        background: '#1C3D5A',
        clipPath: 'polygon(47% 0, 100% 0, 100% 57%)',
        zIndex: 0,
      }} />

      <SmallLogo />

      {/* THANK YOU heading */}
      <div style={{ position: 'absolute', top: 88, left: 80, zIndex: 2 }}>
        <h1 style={{ fontSize: 148, fontWeight: 800, color: '#111', margin: 0, lineHeight: 0.95, letterSpacing: '-4px' }}>
          THANK<br />YOU!
        </h1>
      </div>

      {/* Contact info block */}
      <div style={{ position: 'absolute', bottom: 100, left: 80, zIndex: 2 }}>
        <p style={{ fontSize: 34, color: '#444', margin: '0 0 28px', fontWeight: 400, letterSpacing: '-0.3px' }}>Get in touch</p>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 44 }}>
          {/* QR placeholder */}
          <div style={{
            width: 160, height: 160, background: '#F3F4F6', border: '2px solid #ddd',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 1.5 }}>WhatsApp<br />QR</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '✉', text: 'srinath@360watts.com' },
              { icon: '🌐', text: 'www.360watts.com' },
              { icon: '📞', text: '+91 9087610051' },
              { icon: '📍', text: 'Matterless Technologies (OPC) Private Limited\nc/o Forge, KCT Techpark, Coimbatore, Tamil Nadu\nGST: 3388TCM6353J1ZZ' },
            ].map(c => (
              <div key={c.icon} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, color: '#22C55E', flexShrink: 0, lineHeight: 1.4 }}>{c.icon}</span>
                <span style={{ fontSize: 24, color: '#222', whiteSpace: 'pre-line', lineHeight: 1.55 }}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
