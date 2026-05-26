import React from 'react';
import {
  Document, Page, View, Text, Image, Svg, Rect, Polygon, Circle, Line,
  StyleSheet,
} from '@react-pdf/renderer';
import type { QuotationData, QuoteOption, BomRow } from '../../types/quotation';
import { calcBomTotals, calcEbBill, calcROI } from '../../utils/roiCalculator';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 960;
const H = 540;
const PAD = 44;
const NAVY = '#1C3D5A';
const ORANGE = '#F97316';
const GREEN = '#22C55E';
const WHITE = '#FFFFFF';
const INK = '#111111';
const GRAY = '#444444';
const MUTED = '#888888';
const BORDER = '#E5E7EB';
const LIGHT = '#F8F9FA';

const S = StyleSheet.create({
  page: { width: W, height: H, backgroundColor: WHITE, fontFamily: 'Helvetica', position: 'relative', overflow: 'hidden' },
  abs: { position: 'absolute' },
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  center: { alignItems: 'center', justifyContent: 'center' },
});

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SlideNum({ n, logoUrl }: { n: number; logoUrl: string }) {
  return (
    <>
      <View style={[S.abs, { top: 20, right: PAD, border: '1.5pt solid ' + ORANGE, borderRadius: 5, padding: '4pt 14pt' }]}>
        <Text style={{ color: ORANGE, fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{n}</Text>
      </View>
      <View style={[S.abs, { bottom: 18, right: PAD }]}>
        <Image src={logoUrl} style={{ height: 32 }} />
      </View>
    </>
  );
}

function NavyTriangleCover() {
  // Extends full height on right: diagonal from ~42% width at top to full bottom-right
  const pts = `${W * 0.42},0 ${W},0 ${W},${H}`;
  return (
    <Svg style={[S.abs, { top: 0, left: 0, width: W, height: H }]}>
      <Polygon points={pts} fill={NAVY} />
    </Svg>
  );
}

function NavyTriangleThanks() {
  // Bottom-right triangle: diagonal from bottom-left sweeping up to top-right
  const pts = `${W * 0.58},${H} ${W},${H * 0.35} ${W},${H}`;
  return (
    <Svg style={[S.abs, { top: 0, left: 0, width: W, height: H }]}>
      <Polygon points={pts} fill={NAVY} />
    </Svg>
  );
}

function OrangeBadge({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ border: '1.5pt solid ' + ORANGE, borderRadius: 6, padding: '5pt 14pt', alignSelf: 'flex-start' }, style]}>
      {children}
    </View>
  );
}

function ColorCircle({ bg, label, size = 80 }: { bg: string; label: string; size?: number }) {
  return (
    <View style={[S.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ color: WHITE, fontSize: size * 0.115, fontFamily: 'Helvetica-Bold', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function BreakevenBarChart({ data }: { data: { year: number; breakeven: number }[] }) {
  const CW = 390; const CH = 240;
  const topPad = 20; const botPad = 28; const leftPad = 36;
  const innerH = CH - topPad - botPad;
  const innerW = CW - leftPad - 8;
  const barSlot = innerW / data.length;
  const barW = barSlot * 0.55;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.breakeven)), 1);
  const toY = (v: number) => topPad + innerH / 2 - (v / maxAbs) * (innerH / 2);
  const zeroY = topPad + innerH / 2;
  const toL = (v: number) => (v / 100000).toFixed(0) + 'L';
  const beYear = data.find(d => d.breakeven >= 0)?.year;

  return (
    <Svg width={CW} height={CH}>
      {[-1, -0.5, 0, 0.5, 1].map((frac, i) => {
        const y = topPad + innerH / 2 - frac * innerH / 2;
        return (
          <React.Fragment key={i}>
            <Line x1={leftPad} y1={y} x2={CW - 8} y2={y}
              stroke={frac === 0 ? NAVY : BORDER} strokeWidth={frac === 0 ? 1 : 0.5}
              strokeDasharray={frac === 0 ? undefined : '2,2'} />
          </React.Fragment>
        );
      })}
      {data.map((d, i) => {
        const x = leftPad + i * barSlot + (barSlot - barW) / 2;
        const yVal = toY(d.breakeven);
        const barH = Math.abs(zeroY - yVal);
        const barY = d.breakeven >= 0 ? yVal : zeroY;
        return <Rect key={i} x={x} y={barY} width={barW} height={Math.max(barH, 1)} fill={d.breakeven >= 0 ? GREEN : '#F87171'} rx={1} />;
      })}
      {beYear && (
        <Line
          x1={leftPad + (beYear - 1) * barSlot + barSlot / 2}
          y1={topPad} x2={leftPad + (beYear - 1) * barSlot + barSlot / 2} y2={CH - botPad}
          stroke={ORANGE} strokeWidth={1.5} strokeDasharray="3,2" />
      )}
    </Svg>
  );
}

function CumulativeAreaChart({ data }: { data: { year: number; cumNoSolar: number; cumSolar: number }[] }) {
  const CW = 390; const CH = 240;
  const topPad = 20; const botPad = 28; const leftPad = 36;
  const innerH = CH - topPad - botPad;
  const innerW = CW - leftPad - 8;
  const maxVal = Math.max(...data.map(d => d.cumNoSolar), 1);
  const toX = (i: number) => leftPad + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => topPad + innerH - (v / maxVal) * innerH;

  const noSolarPts = data.map((d, i) => `${toX(i)},${toY(d.cumNoSolar)}`).join(' ');
  const solarPts = data.map((d, i) => `${toX(i)},${toY(d.cumSolar)}`).join(' ');
  const noSolarFill = `${noSolarPts} ${toX(data.length - 1)},${CH - botPad} ${leftPad},${CH - botPad}`;
  const solarFill = `${solarPts} ${toX(data.length - 1)},${CH - botPad} ${leftPad},${CH - botPad}`;

  return (
    <Svg width={CW} height={CH}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = topPad + innerH * (1 - f);
        return <Line key={i} x1={leftPad} y1={y} x2={CW - 8} y2={y} stroke={BORDER} strokeWidth={0.5} strokeDasharray="2,2" />;
      })}
      <Polygon points={noSolarFill} fill="#E5E7EB" opacity={0.7} />
      <Polygon points={solarFill} fill="#DCFCE7" opacity={0.8} />
      <Polygon points={noSolarPts} fill="none" stroke="#9CA3AF" strokeWidth={1.5} />
      <Polygon points={solarPts} fill="none" stroke={GREEN} strokeWidth={2} />
    </Svg>
  );
}

// ─── BOM helpers ──────────────────────────────────────────────────────────────
const PRIMARY_KEYS = ['panels', 'inverter', 'iot hub'];
function isPrimary(r: BomRow) { return PRIMARY_KEYS.some(k => r.item.toLowerCase().includes(k)); }

// ─── SLIDE 1: Cover ───────────────────────────────────────────────────────────
function CoverSlide({ data, logoUrl }: { data: QuotationData; logoUrl: string }) {
  const { customer, ebBill } = data;
  const calc = calcEbBill(ebBill);
  const kw = calc.inverterKw > 0 ? `${calc.inverterKw}` : '—';
  const addrLines = customer.address ? customer.address.split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <Page size={[W, H]} style={S.page}>
      <NavyTriangleCover />

      {/* Logo top-left — 100% bigger */}
      <View style={[S.abs, { top: 26, left: PAD }]}>
        <Image src={logoUrl} style={{ height: 104 }} />
      </View>

      {/* Site photo — inside navy triangle area */}
      {customer.sitePhotoBase64 ? (
        <View style={[S.abs, { top: 16, right: 60, width: 240, height: 256, borderRadius: 6, overflow: 'hidden' }]}>
          <Image src={customer.sitePhotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
      ) : (
        <View style={[S.abs, { top: 16, right: 60, width: 240, height: 256, borderRadius: 6, backgroundColor: '#2D5580', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#64748B', fontSize: 13 }}>Site Photo</Text>
        </View>
      )}

      {/* Main heading — fonts +30% */}
      <View style={[S.abs, { bottom: 120, left: PAD, maxWidth: 380 }]}>
        <Text style={{ fontSize: 57, fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1.02 }}>
          Smart Solar{'\n'}Proposal
        </Text>
        <Text style={{ fontSize: 22, color: GRAY, marginTop: 12, fontFamily: 'Helvetica' }}>
          for customer{' '}
          <Text style={{ fontFamily: 'Helvetica-Bold', color: INK }}>{customer.name || 'Customer Name'}</Text>
        </Text>
      </View>

      {/* kW badge — bottom left */}
      <View style={[S.abs, { bottom: 40, left: PAD, flexDirection: 'row', alignItems: 'baseline', border: '2.5pt solid ' + GREEN, borderRadius: 7, padding: '8pt 24pt' }]}>
        <Text style={{ fontSize: 44, fontFamily: 'Helvetica-Bold', color: GREEN, lineHeight: 1 }}>{kw}</Text>
        <Text style={{ fontSize: 21, fontFamily: 'Helvetica-Bold', color: GREEN, marginLeft: 6 }}>kW</Text>
      </View>

      {/* Address — inside blue triangle (bottom-right, white text) */}
      {(addrLines.length > 0 || customer.phone) && (
        <View style={[S.abs, { bottom: 40, right: 56, maxWidth: 260, alignItems: 'flex-end' }]}>
          {addrLines.map((line, i) => (
            <Text key={i} style={{ color: WHITE, fontSize: 12, lineHeight: 1.7 }}>{line}{i < addrLines.length - 1 ? ',' : ''}</Text>
          ))}
          {customer.phone && (
            <Text style={{ color: WHITE, fontSize: 12, lineHeight: 1.7, marginTop: 3 }}>{customer.phone}</Text>
          )}
        </View>
      )}
    </Page>
  );
}

// ─── SLIDE 2: Company ─────────────────────────────────────────────────────────
function CompanySlide({ logoUrl, finalLogoUrl }: { logoUrl: string; finalLogoUrl: string }) {
  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD}pt ${PAD}pt ${PAD}pt ${PAD}pt` }]}>
      <SlideNum n={2} logoUrl={finalLogoUrl} />

      <Text style={{ fontSize: 52, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 20, letterSpacing: -1 }}>
        COMPANY OVERVIEW
      </Text>

      <View style={[S.row, { flex: 1, gap: 36 }]}>
        <View style={{ flex: 1 }}>
          {[
            '360watts is a technology-led solar energy company that makes solar simple and stress-free.',
            'We design and install smart solar PV systems that bring more energy savings — track and control your energy through our mobile app.',
            'We remain your single point of contact for installation, monitoring, service and upgrades — for the next 20+ years.',
            'We work with trusted partners to ensure high-quality execution and long-term performance.',
          ].map((t, i) => (
            <Text key={i} style={{ fontSize: 15, color: GRAY, lineHeight: 1.7, marginBottom: 8 }}>{t}</Text>
          ))}

          {/* Circles — larger */}
          <View style={[S.row, { gap: 28, marginTop: 'auto', paddingTop: 14 }]}>
            {[
              { bg: NAVY, label: '20+ years\nof solar' },
              { bg: ORANGE, label: 'Modular home\nautomation' },
              { bg: GREEN, label: 'Single contact\nfor services' },
            ].map(c => (
              <ColorCircle key={c.bg} bg={c.bg} label={c.label} size={104} />
            ))}
          </View>

          <Text style={{ fontSize: 17, color: GRAY, marginTop: 14, lineHeight: 1.5 }}>
            Designed for today's <Text style={{ color: GREEN, fontFamily: 'Helvetica-Bold' }}>savings</Text>
            {' '}and tomorrow's <Text style={{ color: ORANGE, fontFamily: 'Helvetica-Bold' }}>energy independence</Text>.
          </Text>
        </View>

        <View style={[S.center, { width: 210 }]}>
          <Image src={logoUrl} style={{ width: 192 }} />
          <Text style={{ fontSize: 15, color: MUTED, marginTop: 12, textAlign: 'center' }}>Drive what's next.</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── SLIDE 3/4: Quote ─────────────────────────────────────────────────────────
function QuoteSlide({ data, option, slideNum, finalLogoUrl }: {
  data: QuotationData; option: QuoteOption; slideNum: number; finalLogoUrl: string;
}) {
  const calc = calcEbBill(data.ebBill);
  const { grossTotal, netInvestment } = calcBomTotals(option.rows, option.subsidy);
  const roi = calcROI(netInvestment, calc.annualSaving);
  const primaryRows = option.rows.filter(isPrimary);
  const secondaryRows = option.rows.filter(r => !isPrimary(r));
  const notIncluded = option.notIncluded ? option.notIncluded.split('\n').filter(Boolean) : [];
  const factors = option.factorsNote ? option.factorsNote.split('\n').filter(Boolean) : [];

  const TH = { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#555', padding: '6pt 7pt', backgroundColor: LIGHT, borderBottom: '1pt solid ' + BORDER };
  const TD = { fontSize: 13, color: INK, padding: '6pt 7pt', borderBottom: '0.5pt solid ' + BORDER };

  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD - 8}pt ${PAD}pt ${PAD - 8}pt ${PAD}pt` }]}>
      <SlideNum n={slideNum} logoUrl={finalLogoUrl} />

      <View style={[S.row, { alignItems: 'center', gap: 12, marginBottom: 16, marginRight: 60 }]}>
        <Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold', color: INK, flex: 1 }}>
          Quotation — {calc.inverterKw > 0 ? `${calc.inverterKw}kW` : '—'} {data.customer.systemType.replace('_', '-')} System
        </Text>
        {option.isRecommended && (
          <View style={{ backgroundColor: ORANGE, borderRadius: 4, padding: '4pt 14pt' }}>
            <Text style={{ color: WHITE, fontSize: 12, fontFamily: 'Helvetica-Bold' }}>RECOMMENDED</Text>
          </View>
        )}
      </View>

      <View style={[S.row, { flex: 1, gap: 22 }]}>
        {/* Primary */}
        <View style={{ width: 230 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Primary Components</Text>
          <View style={{ border: '0.75pt solid ' + BORDER, borderRadius: 4 }}>
            <View style={[S.row, { borderBottom: '1pt solid ' + BORDER }]}>
              <Text style={[TH, { flex: 2 }]}>Item</Text>
              <Text style={[TH, { flex: 1 }]}>Brand</Text>
              <Text style={[TH, { width: 30 }]}>Qty</Text>
            </View>
            {primaryRows.map(row => (
              <View key={row.id} style={[S.row]}>
                <View style={{ flex: 2, padding: '6pt 7pt', borderBottom: '0.5pt solid ' + BORDER }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK }}>
                    {row.item.toLowerCase() === 'panels' ? 'Solar Panel' : row.item.toLowerCase() === 'inverter' ? 'On-Grid Inverter' : row.item}
                  </Text>
                  {row.description && <Text style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>{row.description}</Text>}
                </View>
                <Text style={[TD, { flex: 1 }]}>{row.brand || '—'}</Text>
                <Text style={[TD, { width: 30 }]}>{row.qty}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Secondary */}
        <View style={{ width: 210 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Secondary Components</Text>
          <View style={{ border: '0.75pt solid ' + BORDER, borderRadius: 4 }}>
            {secondaryRows.map((row, i) => (
              <View key={row.id} style={{ padding: '6pt 8pt', borderBottom: i < secondaryRows.length - 1 ? '0.5pt solid ' + BORDER : undefined }}>
                <Text style={{ fontSize: 13, color: INK }}>{row.item}</Text>
                {row.description && <Text style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{row.description}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Right: pricing */}
        <View style={{ flex: 1, gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Total Amount</Text>
            <View style={{ backgroundColor: '#FFF3E0', border: '1.5pt solid ' + ORANGE, borderRadius: 6, padding: '9pt 14pt' }}>
              <Text style={{ fontSize: 21, fontFamily: 'Helvetica-Bold', color: ORANGE }}>
                ₹ {grossTotal.toLocaleString('en-IN')} <Text style={{ fontSize: 14, fontFamily: 'Helvetica' }}>(incl. GST)</Text>
              </Text>
            </View>
          </View>
          {option.subsidy > 0 && (
            <View>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>After Subsidy</Text>
              <View style={{ border: '1.5pt solid ' + GREEN, borderRadius: 6, padding: '9pt 14pt' }}>
                <Text style={{ fontSize: 21, fontFamily: 'Helvetica-Bold', color: GREEN }}>₹ {netInvestment.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Payback Period</Text>
            <View style={{ border: '1.5pt solid ' + GREEN, borderRadius: 6, padding: '9pt 14pt' }}>
              <Text style={{ fontSize: 21, fontFamily: 'Helvetica-Bold', color: GREEN }}>
                {roi.paybackYears} years{roi.paybackMonths > 0 ? `, ${roi.paybackMonths} mo` : ''}
              </Text>
            </View>
          </View>
          <View style={[S.row, { gap: 10, alignItems: 'center' }]}>
            <Text style={{ fontSize: 13, color: GRAY }}>Future expansion:</Text>
            <View style={{ border: '1.5pt solid ' + GREEN, borderRadius: 4, padding: '3pt 10pt' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN }}>{option.expansionPossible ? 'Yes' : 'No'}</Text>
            </View>
          </View>
          {notIncluded.length > 0 && (
            <View>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Not Included</Text>
              {notIncluded.map((l, i) => (
                <Text key={i} style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>{i + 1}. {l}</Text>
              ))}
            </View>
          )}
        </View>
      </View>

      {factors.length > 0 && (
        <View style={{ marginTop: 10, borderTop: '0.75pt solid ' + BORDER, paddingTop: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 4 }}>Factors taken into calculation:</Text>
          {factors.map((l, i) => (
            <Text key={i} style={{ fontSize: 12, color: GRAY, lineHeight: 1.6 }}>{i + 1}. {l}</Text>
          ))}
        </View>
      )}
    </Page>
  );
}

// ─── SLIDE 5: Terms ───────────────────────────────────────────────────────────
function TermsSlide({ finalLogoUrl }: { finalLogoUrl: string }) {
  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD}pt ${PAD}pt ${PAD}pt ${PAD}pt` }]}>
      <SlideNum n={5} logoUrl={finalLogoUrl} />
      <Text style={{ fontSize: 52, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 26, letterSpacing: -1 }}>
        TERMS & CONDITIONS
      </Text>
      <View style={[S.row, { alignItems: 'center', gap: 26, marginBottom: 32 }]}>
        <ColorCircle bg={NAVY} label={'12\nmonths'} size={94} />
        <Text style={{ fontSize: 19, color: GRAY, lineHeight: 1.5, flex: 1 }}>
          Take-back promise if unsatisfied with solar performance{'\n'}
          <Text style={{ fontSize: 15, color: MUTED }}>(all except labour costs)</Text>
        </Text>
      </View>
      <View style={[S.row, { gap: 52 }]}>
        {[
          { label: 'Solar\nInverter', sub1: '10 years of warranty', sub2: '' },
          { label: 'Solar\nPanels', sub1: '12 years performance guarantee', sub2: '20–25 years product warranty' },
          { label: 'Repair &\nService', sub1: '5 years of warranty', sub2: '' },
        ].map(w => (
          <View key={w.label} style={[S.col, { alignItems: 'center', gap: 14 }]}>
            <ColorCircle bg={GREEN} label={w.label} size={124} />
            <Text style={{ fontSize: 14, color: INK, textAlign: 'center', lineHeight: 1.5, maxWidth: 160, fontFamily: 'Helvetica-Bold' }}>{w.sub1}</Text>
            {w.sub2 && <Text style={{ fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 1.4, maxWidth: 160 }}>{w.sub2}</Text>}
          </View>
        ))}
      </View>
      <Text style={[S.abs, { bottom: 22, left: PAD, fontSize: 11, color: MUTED }]}>
        * Does not cover accidental and other damages caused by natural or man-made events.
      </Text>
    </Page>
  );
}

// ─── SLIDE 6: Charts ──────────────────────────────────────────────────────────
function ChartsSlide({ data, finalLogoUrl }: { data: QuotationData; finalLogoUrl: string }) {
  const calc = calcEbBill(data.ebBill);
  const { netInvestment } = calcBomTotals(data.optionA.rows, data.optionA.subsidy);
  const roi = calcROI(netInvestment, calc.annualSaving);
  const beYear = roi.yearlyData.find(y => y.breakeven >= 0)?.year;

  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD}pt ${PAD}pt ${PAD - 8}pt ${PAD}pt` }]}>
      <SlideNum n={6} logoUrl={finalLogoUrl} />
      <Text style={{ fontSize: 52, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 18, letterSpacing: -1 }}>
        WHY SOLAR IS A GOOD INVESTMENT
      </Text>
      <View style={[S.row, { flex: 1, gap: 36 }]}>
        <View style={{ flex: 1 }}>
          <BreakevenBarChart data={roi.yearlyData} />
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Investment Savings & Breakeven Year
          </Text>
          {beYear && <Text style={{ fontSize: 13, color: ORANGE, marginTop: 4 }}>Break-even at year {beYear}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <CumulativeAreaChart data={roi.yearlyData} />
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cumulative 20-year Cost
          </Text>
          <View style={[S.row, { gap: 18, marginTop: 6 }]}>
            <View style={[S.row, { alignItems: 'center', gap: 6 }]}>
              <View style={{ width: 14, height: 4, backgroundColor: '#9CA3AF', borderRadius: 2 }} />
              <Text style={{ fontSize: 11, color: MUTED }}>Without Solar</Text>
            </View>
            <View style={[S.row, { alignItems: 'center', gap: 6 }]}>
              <View style={{ width: 14, height: 4, backgroundColor: GREEN, borderRadius: 2 }} />
              <Text style={{ fontSize: 11, color: MUTED }}>With Solar</Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ─── SLIDE 7: Next Steps ──────────────────────────────────────────────────────
function NextStepsSlide({ finalLogoUrl }: { finalLogoUrl: string }) {
  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD}pt ${PAD}pt ${PAD}pt ${PAD}pt` }]}>
      <SlideNum n={7} logoUrl={finalLogoUrl} />
      <Text style={{ fontSize: 52, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 26, letterSpacing: -1 }}>
        NEXT STEPS
      </Text>
      <View style={[S.row, { gap: 48, flex: 1 }]}>
        {[
          { label: 'Completion in 7–10 days', steps: ['Site visit & technical assessment', 'Proposal finalisation & customer approval', 'Payment (70%)', 'On-site installation'], start: 1 },
          { label: 'Completion in 11–25 days', steps: ['Submission of applications\n(sanctioned load extension + solar net meter)', 'Approval & commissioning by TNEB', 'Remaining payment (30%)'], start: 5 },
        ].map(phase => (
          <View key={phase.label} style={{ flex: 1 }}>
            <OrangeBadge style={{ marginBottom: 18 }}>
              <Text style={{ color: ORANGE, fontSize: 15, fontFamily: 'Helvetica-Bold' }}>{phase.label}</Text>
            </OrangeBadge>
            {phase.steps.map((step, i) => (
              <View key={i} style={[S.row, { gap: 12, marginBottom: 14, alignItems: 'flex-start' }]}>
                <View style={[S.center, { width: 28, height: 28, borderRadius: 14, backgroundColor: NAVY, flexShrink: 0, marginTop: 1 }]}>
                  <Text style={{ color: WHITE, fontSize: 13, fontFamily: 'Helvetica-Bold' }}>{phase.start + i}</Text>
                </View>
                <Text style={{ fontSize: 17, color: GRAY, lineHeight: 1.5, flex: 1 }}>{step}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── SLIDE 8: App ─────────────────────────────────────────────────────────────
function AppSlide({ finalLogoUrl }: { finalLogoUrl: string }) {
  return (
    <Page size={[W, H]} style={[S.page, { padding: `${PAD - 4}pt ${PAD}pt ${PAD - 4}pt ${PAD}pt` }]}>
      <SlideNum n={8} logoUrl={finalLogoUrl} />
      <Text style={{ fontSize: 42, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 18, letterSpacing: -0.5, lineHeight: 1.1 }}>
        SMART SOLAR + SMART HOME{'\n'}WITH 360WATTS APP
      </Text>
      <View style={[S.row, { flex: 1, gap: 28 }]}>
        <View style={{ width: 230, gap: 14 }}>
          <View style={{ backgroundColor: '#F0FDF4', border: '1.5pt solid ' + GREEN, borderRadius: 10, padding: '16pt 18pt' }}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#166534', marginBottom: 12 }}>PV Solar + IoT Energy Hub</Text>
            <View style={[S.row, { gap: 24, justifyContent: 'center' }]}>
              {['☀️\nPV solar\nsystem', '📡\nIoT Energy\nhub'].map((label, i) => (
                <View key={i} style={[S.center, { gap: 4 }]}>
                  <Text style={{ fontSize: 24 }}>{label.split('\n')[0]}</Text>
                  <Text style={{ fontSize: 11, color: '#166534', textAlign: 'center' }}>{label.split('\n').slice(1).join('\n')}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ backgroundColor: NAVY, borderRadius: 10, padding: '16pt 18pt', flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#E2E8F0', marginBottom: 8 }}>Smart Appliances</Text>
            <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Washing machine, AC, water heater…</Text>
            <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 12 }}>— or —</Text>
            <View style={[S.row, { gap: 20, justifyContent: 'center' }]}>
              {[{ icon: '🔌', label: 'Smart plugs' }, { icon: '🔲', label: 'Smart switches' }].map(item => (
                <View key={item.label} style={[S.center, { gap: 4 }]}>
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  <Text style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center' }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={[S.row, { flex: 1, gap: 14 }]}>
          {['Monitor Solar', 'Track Financials', 'Predictive Diagnosis', 'Monitor Energy'].map(label => (
            <View key={label} style={[S.col, { flex: 1, alignItems: 'center', gap: 8 }]}>
              <View style={{ flex: 1, width: '100%', backgroundColor: NAVY, borderRadius: 18, border: '2pt solid #2D5580', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>App Screen</Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── SLIDE 9: Reference ───────────────────────────────────────────────────────
function ReferenceSlide({ overrides = [] }: { overrides?: (string | null)[] }) {
  const defaults = [
    { label: '6 kWp — Residential', src: '/assets/ref-6kw.jpg' },
    { label: '8 kWp — Residential', src: '/assets/ref-8kw.jpg' },
    { label: '20 kWp — Commercial', src: '/assets/ref-20kw.jpg' },
  ];
  const sites = defaults.map((s, i) => ({ ...s, src: overrides[i] || s.src }));

  return (
    <Page size={[W, H]} style={S.page}>
      <View style={{ backgroundColor: NAVY, padding: `24pt ${PAD}pt 20pt` }}>
        <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Our Work</Text>
        <Text style={{ fontSize: 47, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: -0.5 }}>Reference Installations</Text>
      </View>
      <View style={[S.row, { flex: 1, padding: `18pt ${PAD}pt 22pt`, gap: 16 }]}>
        {sites.map(site => (
          <View key={site.label} style={{ flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#E2E8F0', position: 'relative' }}>
            <Image src={site.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <View style={[S.abs, { bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: '10pt 14pt' }]}>
              <Text style={{ color: WHITE, fontSize: 17, fontFamily: 'Helvetica-Bold' }}>{site.label}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={[S.row, { height: 6 }]}>
        <View style={{ flex: 1, backgroundColor: NAVY }} />
        <View style={{ flex: 1, backgroundColor: ORANGE }} />
        <View style={{ flex: 1, backgroundColor: GREEN }} />
      </View>
    </Page>
  );
}

// ─── SLIDE 10: Thanks ─────────────────────────────────────────────────────────
function ThanksSlide({ finalLogoUrl, qrCodeUrl }: { finalLogoUrl: string; qrCodeUrl?: string }) {
  const contacts = [
    { label: 'srinath@360watts.com' },
    { label: 'www.360watts.com' },
    { label: '+91 9087610051' },
    { label: 'Matterless Technologies (OPC) Private Limited\nc/o Forge, KCT Techpark,\nCoimbatore, Tamil Nadu\nGST: 3388TCM6353J1ZZ' },
  ];

  return (
    <Page size={[W, H]} style={S.page}>
      <NavyTriangleThanks />

      {/* THANK YOU — top left */}
      <View style={[S.abs, { top: PAD, left: PAD }]}>
        <Text style={{ fontSize: 108, fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1, letterSpacing: -2 }}>
          THANK{'\n'}YOU!
        </Text>
      </View>

      {/* Get in touch block — bottom left */}
      <View style={[S.abs, { bottom: PAD, left: PAD }]}>
        <Text style={{ fontSize: 24, color: GRAY, marginBottom: 18, fontFamily: 'Helvetica' }}>Get in touch</Text>

        <View style={[S.row, { gap: 24, alignItems: 'flex-start' }]}>
          {/* QR code */}
          <View style={{ width: 110, height: 110, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            {qrCodeUrl
              ? <Image src={qrCodeUrl} style={{ width: 110, height: 110 }} />
              : (
                <View style={[S.center, { width: 110, height: 110, backgroundColor: LIGHT, border: '1pt solid ' + BORDER, borderRadius: 6 }]}>
                  <Text style={{ fontSize: 9, color: MUTED, textAlign: 'center' }}>WhatsApp{'\n'}QR Code</Text>
                </View>
              )
            }
          </View>

          {/* Contact rows */}
          <View style={{ gap: 11 }}>
            {contacts.map((c, i) => (
              <View key={i} style={[S.row, { gap: 10, alignItems: 'flex-start' }]}>
                {/* Coloured dot as icon substitute */}
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginTop: 5, flexShrink: 0 }} />
                <Text style={{ fontSize: 16, color: INK, lineHeight: 1.5 }}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Small logo bottom-right (on navy area) */}
      <View style={[S.abs, { bottom: 18, right: PAD }]}>
        <Image src={finalLogoUrl} style={{ height: 32 }} />
      </View>
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────
interface Props {
  data: QuotationData;
  logoUrl: string;
  finalLogoUrl: string;
  qrCodeUrl?: string;
}

export function ProposalDocument({ data, logoUrl, finalLogoUrl, qrCodeUrl }: Props) {
  return (
    <Document>
      <CoverSlide data={data} logoUrl={logoUrl} />
      <CompanySlide logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <QuoteSlide data={data} option={data.optionA} slideNum={3} finalLogoUrl={finalLogoUrl} />
      {data.optionB && (
        <QuoteSlide data={data} option={data.optionB} slideNum={4} finalLogoUrl={finalLogoUrl} />
      )}
      <TermsSlide finalLogoUrl={finalLogoUrl} />
      <ChartsSlide data={data} finalLogoUrl={finalLogoUrl} />
      <NextStepsSlide finalLogoUrl={finalLogoUrl} />
      <AppSlide finalLogoUrl={finalLogoUrl} />
      <ReferenceSlide />
      <ThanksSlide finalLogoUrl={finalLogoUrl} qrCodeUrl={qrCodeUrl} />
    </Document>
  );
}
