import React from 'react';
import {
  Document, Page, View, Text, Image, Svg,
  Rect, Polygon, Line, Path, G,
  StyleSheet,
} from '@react-pdf/renderer';
import type { QuotationData, BomRow, QuoteOption, YearlyROIPoint } from '../../types/quotation';
import { calcBomTotals, calcEbBill, calcROI } from '../../utils/roiCalculator';

// ─── Page dimensions ──────────────────────────────────────────────────────────
const W = 960;
const H = 540;

// ─── Light Luxury palette ─────────────────────────────────────────────────────
const BG     = '#FAFAF8';   // warm off-white base
const WHITE  = '#FFFFFF';
const BLACK  = '#000000';   // solid black
const BLACK2 = '#1A1A1A';   // near-black
const ORANGE = '#F97316';   // brand accent
const GREEN  = '#22C55E';   // brand green
const TEXT   = '#1C1917';   // warm near-black
const MUTED  = '#64748B';   // slate-500 muted
const LIGHT  = '#F1F5F9';   // light grey card surface
const RULE   = '#E2E8F0';   // thin divider

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: { width: W, height: H, backgroundColor: WHITE, fontFamily: 'Helvetica', position: 'relative', overflow: 'hidden' },
  abs:  { position: 'absolute' },
  row:  { flexDirection: 'row' },
  col:  { flexDirection: 'column' },
  flex1: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return Math.round(n).toLocaleString('en-IN'); }
function fmtI(n: number) { return `Rs. ${fmt(n)}`; }

function getSystemKw(rows: BomRow[]): number {
  const inv = rows.find(r => r.item.toLowerCase() === 'inverter');
  if (inv) {
    const m = inv.description.match(/(\d+(?:\.\d+)?)\s*kw/i);
    if (m) return parseFloat(m[1]);
  }
  const panels = rows.find(r => r.item.toLowerCase() === 'panels');
  if (panels) {
    const m = panels.description.match(/(\d+)\s*[Ww]p/);
    const wp = m ? parseInt(m[1]) : 615;
    return parseFloat(((panels.qty * wp) / 1000).toFixed(1));
  }
  return 0;
}

// ─── Shared layout primitives ─────────────────────────────────────────────────

function GoldRule({ x = 0, y = 0, width = 48, thick = 1.5 }: { x?: number; y?: number; width?: number; thick?: number }) {
  return (
    <Svg style={{ position: 'absolute', top: y, left: x, width, height: thick + 1 }}>
      <Rect x={0} y={0} width={width} height={thick} fill={GREEN} />
    </Svg>
  );
}

function SlideFooter({ n, total, logoUrl, finalLogoUrl }: { n: number; total: number; logoUrl: string; finalLogoUrl: string }) {
  return (
    <>
      <View style={[S.abs, { bottom: 0, left: 0, right: 0, height: 36, backgroundColor: BLACK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40 }]}>
        <Image src={finalLogoUrl} style={{ height: 30, opacity: 0.9, marginRight: 10 }} />
        <Text style={{ color: WHITE, fontSize: 8, fontFamily: 'Helvetica', opacity: 0.6, flex: 1 }}>
          360WATTS  ·  srinath@360watts.com  ·  +91 90876 10051
        </Text>
        <Text style={{ color: GREEN, fontSize: 8, fontFamily: 'Helvetica', letterSpacing: 1 }}>
          {String(n).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </Text>
      </View>
    </>
  );
}

function SectionLabel({ label, color = ORANGE, x = 48, y = 52 }: { label: string; color?: string; x?: number; y?: number }) {
  return (
    <View style={[S.abs, { top: y, left: x, flexDirection: 'row', alignItems: 'center' }]}>
      <View style={{ width: 20, height: 2, backgroundColor: color, marginRight: 8 }} />
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color, letterSpacing: 2.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function MetricBox({ label, value, sub, color = BLACK, x = 0, y = 0, w = 160, h = 80 }:
  { label: string; value: string; sub?: string; color?: string; x?: number; y?: number; w?: number; h?: number }) {
  return (
    <View style={[S.abs, { top: y, left: x, width: w, height: h, backgroundColor: color, padding: 14 }]}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 1.5, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: WHITE, lineHeight: 1 }}>{value}</Text>
      {sub && <Text style={{ fontSize: 8, color: WHITE, opacity: 0.65, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

// ─── Slide 1: Cover ───────────────────────────────────────────────────────────
function CoverSlide({ data, logoUrl, finalLogoUrl }: { data: QuotationData; logoUrl: string; finalLogoUrl: string }) {
  const { customer, ebBill, optionA } = data;
  const { inverterKw } = calcEbBill(ebBill);
  const systemKw = getSystemKw(optionA.rows) || inverterKw;
  const { netInvestment } = calcBomTotals(optionA.rows, optionA.subsidy);
  const systemTypeLabel = { 'ON-GRID': 'On-Grid System', 'HYBRID': 'Hybrid System', 'OFF-GRID': 'Off-Grid System' }[customer.systemType];

  return (
    <Page size={[W, H]} style={S.page}>
      {/* Right navy panel */}
      <View style={[S.abs, { top: 0, right: 0, width: 420, height: H, backgroundColor: BLACK }]} />

      {/* Site photo on right panel — full panel, reduced opacity overlay */}
      {customer.sitePhotoBase64 ? (
        <View style={[S.abs, { top: 0, right: 0, width: 420, height: H, overflow: 'hidden' }]}>
          <Image src={customer.sitePhotoBase64} style={{ width: 420, height: H, objectFit: 'cover', opacity: 0.75 }} />
        </View>
      ) : null}

      {/* Dark scrim so text stays readable over photo */}
      <View style={[S.abs, { top: 0, right: 0, width: 420, height: H, backgroundColor: BLACK, opacity: 0.15 }]} />

      {/* kW hero on right */}
      <View style={[S.abs, { top: 80, right: 0, width: 420, height: H - 116, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 4, marginBottom: 8 }}>S Y S T E M  C A P A C I T Y</Text>
        <Text style={{ fontSize: 120, fontFamily: 'Times-Bold', color: GREEN, lineHeight: 1, textAlign: 'center' }}>
          {systemKw % 1 === 0 ? systemKw.toFixed(0) : systemKw.toFixed(1)}
        </Text>
        <Text style={{ fontSize: 24, fontFamily: 'Times-Bold', color: WHITE, letterSpacing: 4, marginTop: -8 }}>kWp</Text>
        <View style={{ width: 40, height: 1.5, backgroundColor: GREEN, marginTop: 18, marginBottom: 14 }} />
        <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 3 }}>
          {systemTypeLabel.toUpperCase().split('').join(' ')}
        </Text>
        {netInvestment > 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: GREEN, marginTop: 12, letterSpacing: 0.5 }}>
            Net Investment: {fmtI(netInvestment)}
          </Text>
        )}
      </View>

      {/* Left content panel */}
      {/* Logo */}
      <View style={[S.abs, { top: 40, left: 52 }]}>
        <Image src={logoUrl} style={{ height: 52 }} />
      </View>

      {/* Orange accent bar */}
      <View style={[S.abs, { top: 0, left: 0, width: 4, height: H - 36, backgroundColor: ORANGE }]} />

      {/* SOLAR PROPOSAL label */}
      <View style={[S.abs, { top: 110, left: 52, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ width: 24, height: 1.5, backgroundColor: GREEN, marginRight: 10 }} />
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 3 }}>SOLAR PROPOSAL</Text>
      </View>

      {/* Customer name */}
      <Text style={[S.abs, { top: 136, left: 52, fontSize: 44, fontFamily: 'Times-Bold', color: TEXT, lineHeight: 1.1, width: 470 }]}>
        {customer.name || 'Customer Name'}
      </Text>

      {/* Thin gold rule */}
      <GoldRule x={52} y={210} width={380} thick={1} />

      {/* Address */}
      <Text style={[S.abs, { top: 224, left: 52, fontSize: 11, fontFamily: 'Helvetica', color: MUTED, width: 400, lineHeight: 1.6 }]}>
        {customer.address || '—'}
      </Text>

      {/* Phone */}
      {customer.phone ? (
        <Text style={[S.abs, { top: 272, left: 52, fontSize: 10, fontFamily: 'Helvetica', color: MUTED }]}>
          {customer.phone}
        </Text>
      ) : null}

      {/* Date badge */}
      <View style={[S.abs, { top: 306, left: 52, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ backgroundColor: LIGHT, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: MUTED, letterSpacing: 0.5 }}>
            Prepared on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Validity note */}
      <Text style={[S.abs, { top: 348, left: 52, fontSize: 9, fontFamily: 'Helvetica', color: MUTED, opacity: 0.7 }]}>
        This proposal is valid for 14 days from the date of issue.
      </Text>

      {/* Decorative bottom-left squares */}
      <Svg style={{ position: 'absolute', bottom: 36, left: 0, width: 100, height: 60 }}>
        <Rect x={4} y={20} width={14} height={14} fill={GREEN} opacity={0.25} />
        <Rect x={22} y={28} width={10} height={10} fill={ORANGE} opacity={0.18} />
        <Rect x={12} y={36} width={8} height={8} fill={BLACK} opacity={0.12} />
      </Svg>

      <SlideFooter n={1} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 2: Company Overview ────────────────────────────────────────────────
function CompanySlide({ logoUrl, finalLogoUrl }: { logoUrl: string; finalLogoUrl: string }) {
  const stats = [
    { value: '2019', label: 'Founded' },
    { value: '150+', label: 'Systems Installed' },
    { value: '1.2 MW', label: 'Total Capacity' },
    { value: '98%', label: 'Customer Satisfaction' },
  ];
  const pillars = [
    { icon: 'o', title: 'Solar Energy', body: "Grid-tied, hybrid and off-grid systems engineered for Coimbatore's climate, maximising every peak sun hour." },
    { icon: 'o', title: 'IoT Automation', body: 'Smart home energy automation via 360Watts hub — real-time monitoring, appliance control, predictive analytics.' },
    { icon: 'o', title: 'Service & Support', body: '5-year comprehensive AMC, 24/7 remote monitoring and field response within 48 hours across Tamil Nadu.' },
  ];

  return (
    <Page size={[W, H]} style={[S.page, { backgroundColor: BG }]}>
      {/* Top navy bar */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 6, backgroundColor: BLACK }]} />

      {/* Logo + company name */}
      <View style={[S.abs, { top: 30, left: 52 }]}>
        <Image src={logoUrl} style={{ height: 24 }} />
      </View>

      <SectionLabel label="Who We Are" x={52} y={72} />

      {/* Heading */}
      <Text style={[S.abs, { top: 96, left: 52, fontSize: 32, fontFamily: 'Times-Bold', color: ORANGE, width: 420, lineHeight: 1.2 }]}>
        POWERING TAMIL NADU{'\n'}WITH CLEAN ENERGY
      </Text>

      {/* Stats — side by side, compact, left side only */}
      <View style={[S.abs, { top: 230, left: 52, right: 296, flexDirection: 'row' }]}>
        {stats.slice(0, 3).map((s, i) => (
          <View key={i} style={{ flex: 1, paddingRight: i < 2 ? 10 : 0, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: RULE, borderLeftStyle: 'solid', paddingLeft: i === 0 ? 0 : 10 }}>
            <View style={{ width: 20, height: 2.5, backgroundColor: i === 0 ? ORANGE : i === 1 ? GREEN : BLACK, marginBottom: 6 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Times-Bold', color: BLACK, lineHeight: 1 }}>{s.value}</Text>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.5, marginTop: 4 }}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* 3 pillars — stacked vertically on white left side */}
      <View style={[S.abs, { top: 296, left: 52, right: 296, flexDirection: 'column' }]}>
        {pillars.map((p, i) => (
          <View key={i} style={{ marginBottom: i < pillars.length - 1 ? 16 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 5, height: 5, backgroundColor: GREEN, marginRight: 8 }} />
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLACK }}>{p.title}</Text>
            </View>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: MUTED, lineHeight: 1.6, paddingLeft: 13 }}>{p.body}</Text>
          </View>
        ))}
      </View>

      {/* Right decorative panel */}
      <View style={[S.abs, { top: 6, right: 0, width: 280, height: H - 6 - 36, backgroundColor: BLACK }]}>

        <View style={{ padding: 36, paddingTop: 52 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2, marginBottom: 16 }}>OUR MISSION</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Times-Italic', color: WHITE, lineHeight: 1.7, opacity: 0.9 }}>
            "To make every rooftop a{'\n'}power plant — sustainable,{'\n'}smart and profitable."
          </Text>
          <View style={{ width: 32, height: 1.5, backgroundColor: GREEN, marginTop: 20, marginBottom: 20 }} />
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: WHITE, opacity: 0.65, lineHeight: 1.8 }}>
            Certified Solar Installer{'\n'}
            MNRE Empanelled{'\n'}
            TANGEDCO Approved{'\n'}
            ISO 9001:2015
          </Text>
        </View>
      </View>

      <SlideFooter n={2} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slides 3 & 4: Quotation ──────────────────────────────────────────────────
function QuotationSlide({ option, label, slideNum, data, logoUrl, finalLogoUrl }: {
  option: QuoteOption; label: string; slideNum: number; data: QuotationData; logoUrl: string; finalLogoUrl: string;
}) {
  const { customer, ebBill } = data;
  const { inverterKw } = calcEbBill(ebBill);
  const { grossTotal, netInvestment } = calcBomTotals(option.rows, option.subsidy);
  const systemKw = getSystemKw(option.rows) || inverterKw;
  const annualSaving = calcEbBill(ebBill).annualSaving;
  const payback = annualSaving > 0 ? (netInvestment / annualSaving).toFixed(1) : '—';

  const visibleRows = option.rows.filter(r => r.qty > 0 || r.unitPrice > 0);

  return (
    <Page size={[W, H]} style={S.page}>
      {/* Navy header band */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 72, backgroundColor: BLACK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 48 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2, marginBottom: 6 }}>{label.toUpperCase()}{option.isRecommended ? '  ·  RECOMMENDED' : ''}</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Times-Bold', color: WHITE }}>{customer.name || 'Customer'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 9, color: GREEN, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 4 }}>{systemKw} kWp  ·  {customer.systemType}</Text>
          <Text style={{ fontSize: 9, color: WHITE, fontFamily: 'Helvetica', opacity: 0.65 }}>{customer.address?.split('\n')[0] || ''}</Text>
        </View>
      </View>

      {/* Orange left accent */}
      <View style={[S.abs, { top: 72, left: 0, width: 3, height: H - 72 - 36, backgroundColor: ORANGE }]} />

      {/* BoM table */}
      <View style={[S.abs, { top: 82, left: 16, width: 596, bottom: 42 }]}>
        {/* Table header */}
        <View style={{ flexDirection: 'row', backgroundColor: LIGHT, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 }}>
          {['Item', 'Brand / Specs', 'Qty'].map((h, i) => (
            <Text key={i} style={{
              fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 0.5,
              flex: [3.5, 4.5, 0.8][i], textAlign: i === 2 ? 'right' : 'left',
            }}>{h.toUpperCase()}</Text>
          ))}
        </View>

        {/* Table rows */}
        {visibleRows.slice(0, 10).map((row, i) => (
          <View key={row.id} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: i % 2 === 0 ? WHITE : BG }}>
            <Text style={{ flex: 3.5, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: TEXT }}>{row.item}</Text>
            <Text style={{ flex: 4.5, fontSize: 8, fontFamily: 'Helvetica', color: MUTED }}>{row.brand ? `${row.brand} · ` : ''}{row.description}</Text>
            <Text style={{ flex: 0.8, fontSize: 8.5, fontFamily: 'Helvetica', color: TEXT, textAlign: 'right' }}>{row.qty}</Text>
          </View>
        ))}

        {/* Gross total row */}
        <View style={{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: LIGHT, marginTop: 3 }}>
          <Text style={{ flex: 8.8, fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK }}>Gross Total (incl. GST)</Text>
          <Text style={{ flex: 1.4, fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'right' }}>{fmtI(grossTotal)}</Text>
        </View>

        {/* Subsidy row */}
        <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8 }}>
          <Text style={{ flex: 8.8, fontSize: 8.5, fontFamily: 'Helvetica', color: BLACK }}>PM Surya Ghar Subsidy (deduction)</Text>
          <Text style={{ flex: 1.4, fontSize: 8.5, fontFamily: 'Helvetica', color: BLACK, textAlign: 'right' }}>− {fmtI(option.subsidy)}</Text>
        </View>

        {/* Net total row */}
        <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, backgroundColor: WHITE, marginTop: 2 }}>
          <Text style={{ flex: 8.8, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BLACK }}>Net Total (after subsidy)</Text>
          <Text style={{ flex: 1.4, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'right' }}>{fmtI(netInvestment)}</Text>
        </View>
      </View>

      {/* Right metrics panel */}
      <View style={[S.abs, { top: 72, right: 0, width: 348, bottom: 36, backgroundColor: BG, padding: 28 }]}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: ORANGE, letterSpacing: 2, marginBottom: 16 }}>NET INVESTMENT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 40, fontFamily: 'Times-Bold', color: BLACK, lineHeight: 1 }}>{fmtI(netInvestment)}</Text>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: MUTED, marginLeft: 6, marginBottom: 6 }}>(INCL. GST)</Text>
        </View>
        <View style={{ width: 40, height: 1.5, backgroundColor: GREEN, marginTop: 10, marginBottom: 18 }} />

        {/* Metric chips */}
        {[
          { label: 'System Size', val: `${systemKw} kWp` },
          { label: 'Payback Period', val: `${payback} yrs` },
          { label: 'Annual Savings', val: fmtI(annualSaving) },
          { label: 'Subsidy Benefit', val: fmtI(option.subsidy) },
        ].map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: RULE, borderBottomStyle: 'solid' }}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica', color: MUTED }}>{m.label}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK }}>{m.val}</Text>
          </View>
        ))}

        {/* Expansion note */}
        {option.expansionPossible && (
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ width: 6, height: 6, backgroundColor: GREEN, marginTop: 3, marginRight: 8 }} />
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: MUTED, flex: 1, lineHeight: 1.6 }}>Future expansion possible</Text>
          </View>
        )}

        {/* Not included */}
        {option.notIncluded && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 4, letterSpacing: 0.5 }}>NOT INCLUDED</Text>
            {option.notIncluded.split('\n').filter(Boolean).slice(0, 3).map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ fontSize: 7.5, color: MUTED, marginRight: 4 }}>·</Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: MUTED, flex: 1, lineHeight: 1.5 }}>{line}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SlideFooter n={slideNum} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 5: Terms & Conditions ─────────────────────────────────────────────
function TermsSlide({ logoUrl, finalLogoUrl }: { logoUrl: string; finalLogoUrl: string }) {
  const warranties = [
    { years: '25', label: 'Panel Performance Warranty', body: 'Minimum 80% output guaranteed over 25 years by manufacturer.' },
    { years: '10', label: 'Panel Product Warranty', body: 'Manufacturing defects covered for 10 years.' },
    { years: '5', label: 'Inverter Warranty', body: 'Full parts and labour warranty on grid-tied inverter.' },
    { years: '1', label: 'Installation Warranty', body: 'Workmanship and civil warranty on mounting structure and wiring.' },
  ];
  const terms = [
    '50% advance, balance on commissioning.',
    'TANGEDCO net-metering application assistance included.',
    'AMC contract available at Rs.5,000/year post-warranty.',
    'Delivery: 15–21 working days from advance payment.',
    'Prices include GST; subject to change without prior notice.',
    'Generation estimates based on 4.5 PSH and TANGEDCO tariff.',
  ];

  return (
    <Page size={[W, H]} style={[S.page, { backgroundColor: BG }]}>
      {/* Top accent */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 5, backgroundColor: GREEN }]} />

      <SectionLabel label="Terms & Warranty" x={52} y={28} />

      <Text style={[S.abs, { top: 48, left: 52, fontSize: 24, fontFamily: 'Times-Bold', color: ORANGE, lineHeight: 1.2 }]}>
        OUR COMMITMENT TO YOU
      </Text>

      {/* Warranties — stacked vertically on white left side */}
      <View style={[S.abs, { top: 112, left: 52, right: 244, flexDirection: 'column' }]}>
        {warranties.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: RULE, borderBottomStyle: 'solid' }}>
            <View style={{ width: 44, flexShrink: 0, marginRight: 14 }}>
              <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: i < 2 ? BLACK : GREEN, lineHeight: 1 }}>{w.years}</Text>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.5 }}>YR{w.years !== '1' ? 'S' : ''}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: TEXT, marginBottom: 3 }}>{w.label}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica', color: MUTED, lineHeight: 1.6 }}>{w.body}</Text>
            </View>
          </View>
        ))}

        {/* T&C — two sections below warranties */}
        <View style={{ marginTop: 14, flexDirection: 'row' }}>
          {[{ heading: 'PAYMENT & DELIVERY', items: terms.slice(0, 3) }, { heading: 'ADDITIONAL TERMS', items: terms.slice(3) }].map((col, ci) => (
            <View key={ci} style={{ flex: 1, paddingRight: ci === 0 ? 20 : 0 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 1.5, marginBottom: 8 }}>{col.heading}</Text>
              {col.items.map((t, ti) => (
                <View key={ti} style={{ flexDirection: 'row', marginBottom: 6 }}>
                  <View style={{ width: 4, height: 4, backgroundColor: GREEN, marginTop: 3, marginRight: 8, flexShrink: 0 }} />
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: MUTED, flex: 1, lineHeight: 1.6 }}>{t}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Right accent panel */}
      <View style={[S.abs, { top: 5, right: 0, width: 220, height: H - 5 - 36, backgroundColor: BLACK }]}>
        <View style={{ padding: 28, paddingTop: 36 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2, marginBottom: 20 }}>CERTIFICATIONS</Text>
          {['MNRE Empanelled', 'TANGEDCO Approved', 'MSME Registered', 'ISO 9001:2015'].map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 4, height: 4, backgroundColor: GREEN, marginRight: 10 }} />
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: WHITE, opacity: 0.85 }}>{c}</Text>
            </View>
          ))}
          <View style={{ width: 40, height: 1, backgroundColor: GREEN, marginTop: 12, marginBottom: 16, opacity: 0.4 }} />
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: WHITE, opacity: 0.55, lineHeight: 1.7 }}>
            All installations comply{'\n'}with CEA regulations{'\n'}and IEC standards.
          </Text>
        </View>
      </View>

      <SlideFooter n={5} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 6: ROI Charts ──────────────────────────────────────────────────────
function ChartsSlide({ data, logoUrl, finalLogoUrl }: { data: QuotationData; logoUrl: string; finalLogoUrl: string }) {
  const { ebBill, optionA } = data;
  const { annualSaving } = calcEbBill(ebBill);
  const { netInvestment } = calcBomTotals(optionA.rows, optionA.subsidy);
  const roi = calcROI(netInvestment, annualSaving);
  const pts = roi.yearlyData;
  const breakEvenYr = pts.find(p => p.breakeven >= 0)?.year ?? 0;
  const totalSaving20 = pts[19]?.breakeven ?? 0;

  // ── Layout constants ──
  // Metric cards row: top 64–120
  // Charts row: top 128–360
  // Labels/legends: top 362+

  // Bar chart — annual bill without solar (growing) vs with solar (tiny residual)
  // Show year-by-year EB bill savings
  const BX = 48, BY = 172, BW = 420, BH = 180;
  const maxBarVal = Math.max(...pts.map(p => p.billNoSolar));
  const bw = (BW - 8) / 20; // bar slot width
  const bToY = (v: number) => BY + BH - (v / (maxBarVal || 1)) * BH;

  // Area chart — cumulative
  const AX = 504, AY = 172, AW = 420, AH = 180;
  const maxCum = Math.max(...pts.map(p => Math.max(p.cumNoSolar, p.cumSolar)));
  const aToX = (yr: number) => AX + ((yr - 1) / 19) * AW;
  const aToY = (v: number) => AY + AH - (v / (maxCum || 1)) * AH;

  const noSolarLinePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${aToX(p.year).toFixed(1)},${aToY(p.cumNoSolar).toFixed(1)}`).join(' ');
  const solarLinePath   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${aToX(p.year).toFixed(1)},${aToY(p.cumSolar).toFixed(1)}`).join(' ');
  const noSolarArea = noSolarLinePath + ` L${aToX(20).toFixed(1)},${AY + AH} L${AX},${AY + AH} Z`;
  const solarArea   = solarLinePath   + ` L${aToX(20).toFixed(1)},${AY + AH} L${AX},${AY + AH} Z`;

  // Y-axis nice ticks for bar chart
  const barTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: f * maxBarVal,
    y: BY + BH - f * BH,
  }));

  // Y-axis nice ticks for area chart
  const cumTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: f * maxCum,
    y: AY + AH - f * AH,
  }));

  function fmtL(v: number) {
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return `${Math.round(v)}`;
  }

  return (
    <Page size={[W, H]} style={[S.page, { backgroundColor: BG }]}>
      {/* Navy header */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 52, backgroundColor: BLACK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 48 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2 }}>FINANCIAL ANALYSIS</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Times-Bold', color: WHITE, marginTop: 3 }}>20-Year Solar Returns</Text>
        </View>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: WHITE, opacity: 0.5 }}>Based on current TANGEDCO tariff · 3% annual escalation</Text>
      </View>

      {/* ── 4 metric cards ── */}
      {([
        { label: 'Net Investment', val: fmtI(netInvestment), sub: 'after subsidy', color: WHITE, textColor: GREEN, valColor: GREEN },
        { label: 'Annual Savings', val: fmtI(annualSaving), sub: 'year 1 estimate', color: WHITE, textColor: BLACK, valColor: BLACK },
        { label: 'Payback Period', val: `${roi.paybackYears} yrs ${roi.paybackMonths} mo`, sub: 'break-even point', color: ORANGE, textColor: WHITE, valColor: WHITE },
        { label: '20-Year Net Gain', val: fmtI(totalSaving20), sub: 'total profit', color: WHITE, textColor: BLACK, valColor: GREEN },
      ] as const).map((m, i) => (
        <View key={i} style={[S.abs, {
          top: 60, left: 48 + i * 222, width: 210, height: 68,
          backgroundColor: m.color,
          borderWidth: m.color === WHITE ? 1 : 0,
          borderColor: RULE,
          borderStyle: 'solid',
          padding: 12,
        }]}>
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: m.color === WHITE ? MUTED : m.valColor, letterSpacing: 1, marginBottom: 5, opacity: m.color === WHITE ? 1 : 0.75 }}>{m.label.toUpperCase()}</Text>
          <Text style={{ fontSize: 17, fontFamily: 'Times-Bold', color: m.valColor, lineHeight: 1 }}>{m.val}</Text>
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: m.color === WHITE ? MUTED : m.textColor, opacity: 0.7, marginTop: 3 }}>{m.sub}</Text>
        </View>
      ))}

      {/* ── Chart titles ── */}
      <Text style={[S.abs, { top: BY - 28, left: BX, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 1 }]}>
        ANNUAL ELECTRICITY BILL  —  WITH vs. WITHOUT SOLAR  (Rs.)
      </Text>
      <Text style={[S.abs, { top: BY - 28, left: AX, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 1 }]}>
        CUMULATIVE COST COMPARISON OVER 20 YEARS  (Rs.)
      </Text>

      <Svg style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>

        {/* ════ BAR CHART ════ */}

        {/* Grid lines */}
        {barTicks.map((t, i) => (
          <Line key={i} x1={BX} y1={t.y} x2={BX + BW} y2={t.y} stroke={RULE} strokeWidth={i === 0 ? 0 : 0.5} strokeDasharray={i === 0 ? '' : '3,4'} />
        ))}
        {/* Axes */}
        <Line x1={BX} y1={BY} x2={BX} y2={BY + BH} stroke={'#CBD5E1'} strokeWidth={1} />
        <Line x1={BX} y1={BY + BH} x2={BX + BW} y2={BY + BH} stroke={'#CBD5E1'} strokeWidth={1} />

        {/* Bars — without solar (light) and with solar (navy) side by side */}
        {pts.map((p, i) => {
          const slotX = BX + 4 + i * bw;
          const barPairW = bw - 4;
          const noSolarH = Math.max(((p.billNoSolar / (maxBarVal || 1)) * BH), 1);
          const solarH   = Math.max(((p.billSolar   / (maxBarVal || 1)) * BH), 1);
          const halfW = barPairW / 2 - 1;
          return (
            <G key={i}>
              {/* Without solar — grey */}
              <Rect x={slotX} y={BY + BH - noSolarH} width={halfW} height={noSolarH} fill={'#94A3B8'} opacity={0.55} />
              {/* With solar — navy */}
              <Rect x={slotX + halfW + 1} y={BY + BH - solarH} width={halfW} height={solarH} fill={BLACK} opacity={0.85} />
            </G>
          );
        })}

        {/* Break-even dashed vertical line */}
        {breakEvenYr > 0 && breakEvenYr <= 20 && (
          <Line
            x1={BX + 4 + (breakEvenYr - 1) * bw}
            y1={BY - 2}
            x2={BX + 4 + (breakEvenYr - 1) * bw}
            y2={BY + BH}
            stroke={ORANGE} strokeWidth={1.5} strokeDasharray="4,3"
          />
        )}

        {/* ════ AREA CHART ════ */}

        {/* Grid lines */}
        {cumTicks.map((t, i) => (
          <Line key={i} x1={AX} y1={t.y} x2={AX + AW} y2={t.y} stroke={RULE} strokeWidth={i === 0 ? 0 : 0.5} strokeDasharray={i === 0 ? '' : '3,4'} />
        ))}
        {/* Axes */}
        <Line x1={AX} y1={AY} x2={AX} y2={AY + AH} stroke={'#CBD5E1'} strokeWidth={1} />
        <Line x1={AX} y1={AY + AH} x2={AX + AW} y2={AY + AH} stroke={'#CBD5E1'} strokeWidth={1} />

        {/* Fill areas */}
        <Path d={noSolarArea} fill={'#94A3B8'} opacity={0.15} />
        <Path d={solarArea}   fill={BLACK}       opacity={0.12} />

        {/* Lines */}
        <Path d={noSolarLinePath} stroke={'#64748B'} strokeWidth={2} fill="none" />
        <Path d={solarLinePath}   stroke={BLACK}      strokeWidth={2.5} fill="none" />

        {/* Crossover / gap annotation at year 20 */}
        {pts[19] && (
          <>
            <Line x1={aToX(20)} y1={aToY(pts[19].cumSolar)} x2={aToX(20)} y2={aToY(pts[19].cumNoSolar)}
              stroke={GREEN} strokeWidth={2} strokeDasharray="3,2" />
          </>
        )}

        {/* Break-even marker on area chart */}
        {breakEvenYr > 0 && breakEvenYr <= 20 && (
          <>
            <Line x1={aToX(breakEvenYr)} y1={AY} x2={aToX(breakEvenYr)} y2={AY + AH}
              stroke={ORANGE} strokeWidth={1.5} strokeDasharray="4,3" />
            <Rect x={aToX(breakEvenYr) - 1} y={aToY(pts[breakEvenYr - 1]?.cumSolar ?? 0) - 5} width={8} height={8} fill={ORANGE} />
          </>
        )}
      </Svg>

      {/* ── Bar chart Y-axis labels ── */}
      {barTicks.map((t, i) => (
        <Text key={i} style={[S.abs, { top: t.y - 5, left: BX - 38, fontSize: 6.5, fontFamily: 'Helvetica', color: MUTED, width: 34, textAlign: 'right' }]}>
          {i === 0 ? '' : `${fmtL(t.val)}`}
        </Text>
      ))}

      {/* ── Bar chart X-axis year labels ── */}
      {[1, 3, 5, 7, 10, 13, 15, 18, 20].map(yr => (
        <Text key={yr} style={[S.abs, { top: BY + BH + 4, left: BX + 4 + (yr - 1) * bw - 4, fontSize: 6.5, fontFamily: 'Helvetica', color: MUTED }]}>{yr}</Text>
      ))}

      {/* ── Break-even badge (bar chart) ── */}
      {breakEvenYr > 0 && breakEvenYr <= 20 && (
        <View style={[S.abs, {
          top: BY - 16,
          left: BX + 4 + (breakEvenYr - 1) * bw - 18,
          backgroundColor: ORANGE, paddingHorizontal: 5, paddingVertical: 2,
        }]}>
          <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: WHITE }}>Break-even Yr {breakEvenYr}</Text>
        </View>
      )}

      {/* ── Area chart Y-axis labels ── */}
      {cumTicks.map((t, i) => (
        <Text key={i} style={[S.abs, { top: t.y - 5, left: AX - 38, fontSize: 6.5, fontFamily: 'Helvetica', color: MUTED, width: 34, textAlign: 'right' }]}>
          {i === 0 ? '' : `${fmtL(t.val)}`}
        </Text>
      ))}

      {/* ── Area chart X-axis year labels ── */}
      {[1, 5, 10, 15, 20].map(yr => (
        <Text key={yr} style={[S.abs, { top: AY + AH + 4, left: aToX(yr) - 4, fontSize: 6.5, fontFamily: 'Helvetica', color: MUTED }]}>{yr}</Text>
      ))}

      {/* ── 20-yr gap label on area chart ── */}
      {pts[19] && (
        <View style={[S.abs, { top: aToY((pts[19].cumNoSolar + pts[19].cumSolar) / 2) - 8, left: AX + AW - 60 }]}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: GREEN }}>Save {fmtL(pts[19].cumNoSolar - pts[19].cumSolar)}</Text>
        </View>
      )}

      {/* ── Legends ── */}
      <View style={[S.abs, { top: BY + BH + 16, left: BX, flexDirection: 'row' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
          <View style={{ width: 10, height: 10, backgroundColor: '#94A3B8', opacity: 0.7, marginRight: 5 }} />
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: MUTED }}>Without Solar</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, backgroundColor: BLACK, opacity: 0.85, marginRight: 5 }} />
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: MUTED }}>With Solar</Text>
        </View>
      </View>

      <View style={[S.abs, { top: AY + AH + 16, left: AX, flexDirection: 'row' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
          <View style={{ width: 16, height: 2, backgroundColor: '#64748B', marginRight: 5 }} />
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: MUTED }}>Without Solar (cumulative spend)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 16, height: 2.5, backgroundColor: BLACK, marginRight: 5 }} />
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: MUTED }}>With Solar (cumulative spend)</Text>
        </View>
      </View>

      <SlideFooter n={6} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 7: Next Steps ──────────────────────────────────────────────────────
function NextStepsSlide({ logoUrl, finalLogoUrl }: { logoUrl: string; finalLogoUrl: string }) {
  const steps = [
    { n: '01', title: 'Confirm & Advance', body: '50% advance payment to confirm your order and lock in the current price.' },
    { n: '02', title: 'Site Survey', body: 'Our engineer visits for final structural assessment, shading analysis and panel placement planning.' },
    { n: '03', title: 'TANGEDCO Application', body: 'We file the net-meter and sanctioned-load application on your behalf.' },
    { n: '04', title: 'Installation', body: 'Panels, inverter, DCDB/ACDB, wiring and IoT hub installed within 2–3 days by our certified team.' },
    { n: '05', title: 'Commissioning', body: 'System tested, inverter commissioned, 360Watts app configured and handover walkthrough completed.' },
    { n: '06', title: 'Net Metering', body: 'TANGEDCO meter installation (15–45 days) — you start exporting excess power to the grid.' },
  ];

  return (
    <Page size={[W, H]} style={S.page}>
      {/* Left black panel — wider */}
      <View style={[S.abs, { top: 0, left: 0, width: 300, height: H - 36, backgroundColor: BLACK }]}>
        <View style={{ padding: 44, paddingTop: 56 }}>
          <View style={{ width: 24, height: 2, backgroundColor: GREEN, marginBottom: 16 }} />
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2, marginBottom: 10 }}>YOUR JOURNEY</Text>
          <Text style={{ fontSize: 28, fontFamily: 'Times-Bold', color: WHITE, lineHeight: 1.3, marginBottom: 24 }}>
            From{'\n'}Proposal{'\n'}to Power
          </Text>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: WHITE, opacity: 0.65, lineHeight: 1.9 }}>
            Typical time from{'\n'}advance to first{'\n'}unit generated:
          </Text>
          <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: GREEN, marginTop: 8 }}>21 days</Text>
        </View>
      </View>

      {/* Steps — vertical list */}
      <View style={[S.abs, { top: 24, left: 324, right: 36, bottom: 52 }]}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: i < steps.length - 1 ? 1 : 0, borderBottomColor: RULE, borderBottomStyle: 'solid' }}>
            <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: GREEN, marginRight: 18, lineHeight: 1, width: 38 }}>{step.n}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 }}>{step.title}</Text>
              <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica', color: MUTED, lineHeight: 1.65 }}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <SlideFooter n={7} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 8: App Features ────────────────────────────────────────────────────
function AppSlide({ logoUrl, finalLogoUrl, appScreen1, appScreen2, phoneCover }: { logoUrl: string; finalLogoUrl: string; appScreen1: string; appScreen2: string; phoneCover: string }) {
  const features = [
    { title: 'Live Energy Monitor', body: 'Real-time solar generation, consumption and grid import/export in a clean dashboard.' },
    { title: 'Smart Automation', body: 'Schedule appliances to run on solar-peak hours, cutting bills further.' },
    { title: 'Savings Tracker', body: 'CO₂ avoided, rupees saved, payback progress — all visualised beautifully.' },
    { title: 'Alerts & Reports', body: 'Instant notifications for faults; monthly PDF reports for your records.' },
    { title: 'Remote Control', body: 'Switch appliances on/off from anywhere with secure device control.' },
  ];

  // Carousel layout: center phone large + prominent, flanking phones smaller + dimmed
  // Right zone: x=480 to x=960 (480pt wide)
  const CPW = 175;  // center phone width
  const CPH = Math.round(CPW * 636 / 329); // ~339
  const SPW = 120;  // side phone width
  const SPH = Math.round(SPW * 636 / 329); // ~252
  const GAP = 2;
  // Center phone x, vertically centred in content area
  const CPX = 480 + Math.round((480 - (SPW + GAP + CPW + GAP + SPW)) / 2) + SPW + GAP;
  const CPY = Math.round((H - 36 - CPH) / 2) - 20;
  // Side phones vertically aligned with center phone mid-point
  const SPY = CPY + Math.round((CPH - SPH) / 2);
  const SP1X = CPX - GAP - SPW;
  const SP2X = CPX + CPW + GAP;
  // Screenshot insets — proportional to phone size
  const cScrW = Math.round(CPW * 0.75) - 2; const cScrH = Math.round(CPH * 0.83) - 4;
  const cScrL = Math.round(CPW * 0.13); const cScrT = Math.round(CPH * 0.08) + 3;
  const sScrW = Math.round(SPW * 0.75) - 3; const sScrH = Math.round(SPH * 0.83) - 5;
  const sScrL = Math.round(SPW * 0.13) + 0.5; const sScrT = Math.round(SPH * 0.08) + 3;
  // Dot indicators
  const dotY = CPY + CPH + 14;
  const dotCX = CPX + Math.round(CPW / 2);

  return (
    <Page size={[W, H]} style={[S.page, { backgroundColor: BLACK }]}>
      {/* Gold accent top */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 4, backgroundColor: GREEN }]} />

      {/* Left: heading + feature list */}
      <View style={[S.abs, { top: 24, left: 44, width: 430, bottom: 44 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 20, height: 2, backgroundColor: GREEN, marginRight: 10 }} />
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2 }}>SMART SOLAR APP</Text>
        </View>
        <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: WHITE, lineHeight: 1.2, marginBottom: 8 }}>
          Your Solar Plant{'\n'}in Your Pocket
        </Text>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: WHITE, opacity: 0.7, lineHeight: 1.7, marginBottom: 16, textAlign: 'left' }}>
          Complete visibility and control over your solar system — anytime, anywhere, on iOS and Android.
        </Text>

        {features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: i < features.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.1)', borderBottomStyle: 'solid' }}>
            <View style={{ width: 5, height: 5, backgroundColor: GREEN, marginTop: 5, marginRight: 12, flexShrink: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, marginBottom: 3 }}>{f.title}</Text>
              <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: WHITE, opacity: 0.6, lineHeight: 1.55 }}>{f.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Right: carousel-style 3-phone layout — center prominent, flanks dimmed */}
      {/* Left side phone (dimmed) — clip bottom 24pt to hide shadow in phonecover asset */}
      <View style={[S.abs, { top: SPY, left: SP1X, width: SPW, height: SPH - 24, overflow: 'hidden', opacity: 0.85 }]}>
        <Image src={appScreen2} style={{ position: 'absolute', top: sScrT, left: sScrL, width: sScrW, height: sScrH }} />
        <Image src={phoneCover} style={{ position: 'absolute', top: 0, left: 0, width: SPW, height: SPH, objectFit: 'cover' }} />
      </View>
      {/* Center phone (prominent) */}
      <View style={[S.abs, { top: CPY, left: CPX, width: CPW, height: CPH - 30, overflow: 'hidden' }]}>
        <Image src={appScreen1} style={{ position: 'absolute', top: cScrT, left: cScrL, width: cScrW, height: cScrH }} />
        <Image src={phoneCover} style={{ position: 'absolute', top: 0, left: 0, width: CPW, height: CPH, objectFit: 'cover' }} />
      </View>
      {/* Right side phone (dimmed) */}
      <View style={[S.abs, { top: SPY, left: SP2X, width: SPW, height: SPH - 22, overflow: 'hidden', opacity: 0.85 }]}>
        <Image src={appScreen2} style={{ position: 'absolute', top: sScrT, left: sScrL, width: sScrW, height: sScrH }} />
        <Image src={phoneCover} style={{ position: 'absolute', top: 0, left: 0, width: SPW, height: SPH, objectFit: 'cover' }} />
      </View>

      {/* iOS / Android badges below carousel */}
      <View style={[S.abs, { top: dotY, left: dotCX - 90, width: 180, flexDirection: 'row', justifyContent: 'center', gap: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'solid' }}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: WHITE }}> iOS</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'solid' }}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: WHITE }}> Android</Text>
        </View>
      </View>

      <SlideFooter n={8} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 9: Reference Sites ─────────────────────────────────────────────────
function ReferenceSlide({ logoUrl, finalLogoUrl, ref6kw, ref8kw, ref20kw }: { logoUrl: string; finalLogoUrl: string; ref6kw: string; ref8kw: string; ref20kw: string }) {
  const sites = [
    { kw: '6 kWp', type: 'Residential · On-Grid', loc: 'Saravanampatti, Coimbatore', saving: 'Rs.72,000/yr', img: ref6kw },
    { kw: '8 kWp', type: 'Commercial · Hybrid', loc: 'RS Puram, Coimbatore', saving: 'Rs.1.25L/yr', img: ref8kw },
    { kw: '20 kWp', type: 'Industrial · On-Grid', loc: 'Ganapathy, Coimbatore', saving: 'Rs.2.40L/yr', img: ref20kw },
  ];

  return (
    <Page size={[W, H]} style={[S.page, { backgroundColor: BG }]}>
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 5, backgroundColor: ORANGE }]} />

      <SectionLabel label="Our Work" x={52} y={28} />

      <Text style={[S.abs, { top: 50, left: 52, fontSize: 28, fontFamily: 'Times-Bold', color: ORANGE }]}>
        INSTALLATIONS ACROSS COIMBATORE
      </Text>
      <Text style={[S.abs, { top: 86, left: 52, fontSize: 10, fontFamily: 'Helvetica', color: MUTED }]}>
        Real systems, real savings — our portfolio speaks for itself.
      </Text>

      {/* Site cards */}
      <View style={[S.abs, { top: 116, left: 52, right: 52, bottom: 52, flexDirection: 'row' }]}>
        {sites.map((site, i) => (
          <View key={i} style={{ flex: 1, marginRight: i < sites.length - 1 ? 16 : 0, backgroundColor: WHITE, overflow: 'hidden' }}>
            {/* Site photo */}
            <View style={{ height: 200, overflow: 'hidden' }}>
              {site.img ? (
                <Image src={site.img} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
              ) : (
                <View style={{ height: 200, backgroundColor: BLACK }} />
              )}
            </View>
            <View style={{ padding: 14, flex: 1 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Times-Bold', color: BLACK, lineHeight: 1 }}>{site.kw}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: ORANGE, letterSpacing: 0.5, marginTop: 4 }}>{site.type.toUpperCase()}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica', color: MUTED, marginTop: 6, lineHeight: 1.6 }}>{site.loc}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <View style={{ width: 4, height: 4, backgroundColor: GREEN, marginRight: 6 }} />
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: GREEN }}>{site.saving}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <SlideFooter n={9} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Slide 10: Thank You ──────────────────────────────────────────────────────
function ThanksSlide({ data, logoUrl, finalLogoUrl, qrCodeUrl }: {
  data: QuotationData; logoUrl: string; finalLogoUrl: string; qrCodeUrl: string;
}) {
  const { customer } = data;

  return (
    <Page size={[W, H]} style={S.page}>
      {/* Background watermark */}
      <Svg style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
        <Polygon points={`${W},0 ${W},${H} ${W * 0.55},0`} fill={BLACK} opacity={0.04} />
        <Polygon points={`0,${H} ${W * 0.45},${H} 0,0`} fill={LIGHT} opacity={0.6} />
      </Svg>

      {/* Thin gold top accent */}
      <View style={[S.abs, { top: 0, left: 0, right: 0, height: 4, backgroundColor: GREEN }]} />

      {/* Left content */}
      <View style={[S.abs, { top: 60, left: 80, width: 440 }]}>
        <Image src={logoUrl} style={{ height: 40, width: 40, marginBottom: 18 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 20, height: 2, backgroundColor: GREEN, marginRight: 10 }} />
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: 2 }}>THANK YOU</Text>
        </View>

        <Text style={{ fontSize: 52, fontFamily: 'Times-Bold', color: BLACK, lineHeight: 1, marginBottom: 6 }}>
          {customer.name ? `Dear ${customer.name.split(' ')[0]},` : 'Dear Customer,'}
        </Text>

        <View style={{ width: 56, height: 2, backgroundColor: ORANGE, marginBottom: 20 }} />

        <Text style={{ fontSize: 11, fontFamily: 'Times-Italic', color: TEXT, lineHeight: 1.8, opacity: 0.85, marginBottom: 24 }}>
          Thank you for considering 360Watts for your solar journey.{'\n'}
          We look forward to powering your home with clean energy.
        </Text>

        {/* Contact strip */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { label: 'Phone', val: '+91 90876 10051' },
            { label: 'Email', val: 'srinath@360watts.com' },
            { label: 'Web', val: 'www.360watts.com' },
          ].map((c, i) => (
            <View key={i} style={{ marginRight: 36, marginBottom: 10 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1.5, marginBottom: 5 }}>{c.label.toUpperCase()}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica', color: TEXT }}>{c.val}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Right panel */}
      <View style={[S.abs, { top: 4, right: 0, width: 340, height: H - 4 - 36, backgroundColor: BLACK }]}>
        <View style={[S.abs, { top: 40, left: 52 }]}>
          <View style={{ width: 40, height: 1, backgroundColor: GREEN, marginBottom: 24, opacity: 0.4 }} />

          {/* QR code */}
          <View style={{ backgroundColor: WHITE, padding: 6, marginBottom: 16, width: 120, height: 120 }}>
            <Image src={qrCodeUrl} style={{ width: 108, height: 108, objectFit: 'contain' }} />
          </View>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: WHITE, opacity: 0.55, letterSpacing: 0.5, textAlign: 'center' }}>
            SCAN TO CHAT ON WHATSAPP
          </Text>

          <View style={{ width: 40, height: 1, backgroundColor: GREEN, marginTop: 24, marginBottom: 20, opacity: 0.4 }} />

          <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: WHITE, opacity: 0.6, lineHeight: 1.9 }}>
            Matterless Technologies (OPC) Pvt Ltd{'\n'}
            c/o Forge, KCT Techpark,{'\n'}
            Coimbatore, Tamil Nadu{'\n'}
            GST: 3388TCM6353J1ZZ
          </Text>
        </View>
      </View>

      <SlideFooter n={10} total={10} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────
interface Props {
  data: QuotationData;
  logoUrl: string;
  finalLogoUrl: string;
  qrCodeUrl: string;
  appScreen1: string;
  appScreen2: string;
  phoneCover: string;
  ref6kw: string;
  ref8kw: string;
  ref20kw: string;
}

export function ProposalDocument({ data, logoUrl, finalLogoUrl, qrCodeUrl, appScreen1, appScreen2, phoneCover, ref6kw, ref8kw, ref20kw }: Props) {
  const hasOptionB = !!data.optionB;

  return (
    <Document title={`360Watts Solar Proposal — ${data.customer.name}`} author="360Watts Energy Solutions">
      <CoverSlide    data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <CompanySlide  logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <QuotationSlide option={data.optionA} label="Option A" slideNum={3} data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      {hasOptionB && (
        <QuotationSlide option={data.optionB!} label="Option B" slideNum={4} data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      )}
      <TermsSlide     logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <ChartsSlide    data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <NextStepsSlide logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} />
      <AppSlide       logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} appScreen1={appScreen1} appScreen2={appScreen2} phoneCover={phoneCover} />
      <ReferenceSlide logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} ref6kw={ref6kw} ref8kw={ref8kw} ref20kw={ref20kw} />
      <ThanksSlide    data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} qrCodeUrl={qrCodeUrl} />
    </Document>
  );
}
