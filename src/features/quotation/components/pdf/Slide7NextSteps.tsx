import { SlideNum, SmallLogo, F } from './Slide2Company';

export function Slide7NextSteps() {
  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '72px 80px 72px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={7} />
      <SmallLogo />

      <h2 style={{ fontSize: 80, fontWeight: 800, color: '#111', margin: '0 0 56px', textTransform: 'uppercase', letterSpacing: '-2px' }}>
        Next Steps
      </h2>

      <div style={{ display: 'flex', gap: 100, flex: 1 }}>
        {/* Phase 1 */}
        <div style={{ flex: 1 }}>
          <div style={{
            border: '2px solid #F97316', borderRadius: 10, padding: '10px 28px',
            display: 'inline-block', marginBottom: 28,
          }}>
            <span style={{ color: '#F97316', fontSize: 26, fontWeight: 700 }}>Completion in 7–10 days</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 32, color: '#222', fontSize: 28, lineHeight: 2.1 }} start={1}>
            <li>Site visit &amp; technical assessment</li>
            <li>Proposal finalisation &amp; customer approval</li>
            <li>Payment (70%)</li>
            <li>On-site installation</li>
          </ol>
        </div>

        {/* Phase 2 */}
        <div style={{ flex: 1 }}>
          <div style={{
            border: '2px solid #F97316', borderRadius: 10, padding: '10px 28px',
            display: 'inline-block', marginBottom: 28,
          }}>
            <span style={{ color: '#F97316', fontSize: 26, fontWeight: 700 }}>Completion in 11–25 days</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 32, color: '#222', fontSize: 28, lineHeight: 2.1 }} start={5}>
            <li>Submission of applications<br /><span style={{ fontSize: 24, color: '#555' }}>(for sanctioned load extension + solar net meter)</span></li>
            <li>Approval &amp; commissioning by TNEB</li>
            <li>Remaining payment (30%)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
