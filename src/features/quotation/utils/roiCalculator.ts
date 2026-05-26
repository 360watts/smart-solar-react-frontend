import type { BomRow, BomTotals, EbBillData, EbCalcResult, ROIData, YearlyROIPoint } from '../types/quotation';

// TANGEDCO bi-monthly slabs (Tamil Nadu domestic tariff)
// Two structures apply: consumption < 500 kWh uses a concessional 101–200 rate of ₹2.35
const SLABS_LOW: { from: number; to: number; rate: number }[] = [
  { from: 0,    to: 100,      rate: 0 },
  { from: 101,  to: 200,      rate: 2.35 },
  { from: 201,  to: 400,      rate: 4.7 },
  { from: 401,  to: 500,      rate: 6.3 },
];
const SLABS_HIGH: { from: number; to: number; rate: number }[] = [
  { from: 0,    to: 100,      rate: 0 },
  { from: 101,  to: 400,      rate: 4.7 },
  { from: 401,  to: 500,      rate: 6.3 },
  { from: 501,  to: 600,      rate: 8.4 },
  { from: 601,  to: 800,      rate: 9.45 },
  { from: 801,  to: 1000,     rate: 10.5 },
  { from: 1001, to: Infinity, rate: 11.55 },
];

export function calcTangedcoBill(kWh: number): number {
  const slabs = kWh <= 500 ? SLABS_LOW : SLABS_HIGH;
  let bill = 0;
  let remaining = kWh;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const inSlab = Math.min(remaining, slab.to === Infinity ? remaining : slab.to - slab.from + 1);
    bill += inSlab * slab.rate;
    remaining -= inSlab;
  }
  return Math.round(bill);
}

// 365.25 days/year ÷ 6 bi-monthly periods = 60.875 days per period
const DAYS_PER_BIMONTHLY = 365.25 / 6;

// Standard inverter sizes available in the market (kW AC)
const STANDARD_INVERTER_KW = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];

// Round required AC kW up to the next standard inverter size
export function snapToInverterSize(requiredAcKw: number): number {
  return STANDARD_INVERTER_KW.find(s => s >= requiredAcKw) ?? STANDARD_INVERTER_KW[STANDARD_INVERTER_KW.length - 1];
}

// DC sizing: size array from consumption first, then derive inverter from DC.
// perfRatio=0.96 accounts for wiring + temperature derating (4% system losses).
// DC/AC ratio > 1 ensures DC array is always larger than inverter.
export function calcDcAndInverter(
  avgBimonthlyKwh: number, psh = 4.5, pf = 1.0, dcAcRatio = 1.1, panelWp = 615,
): { inverterKw: number; dcKw: number } {
  const safePsh  = psh > 0 ? psh : 4.5;
  const safePf   = pf  > 0 ? pf  : 1.0;
  const safeDcAc = dcAcRatio > 0 ? dcAcRatio : 1.1;
  const avgDailyKwh = avgBimonthlyKwh / DAYS_PER_BIMONTHLY;
  // Step 1: DC array sized to meet consumption (PF adjusts for reactive load)
  const requiredDcKw = avgDailyKwh / (safePsh * safePf);
  // Step 2: round up to whole-panel boundary
  const panels  = Math.ceil((requiredDcKw * 1000) / panelWp);
  const dcKw    = parseFloat((panels * panelWp / 1000).toFixed(3));
  // Step 3: inverter = DC ÷ DC/AC ratio, snapped UP to standard size (inverter < DC ✓)
  const inverterKw = snapToInverterSize(dcKw / safeDcAc);
  return { inverterKw, dcKw };
}

export function calcSystemSize(avgBimonthlyKwh: number, psh = 4.5, pf = 1.0, dcAcRatio = 1.1): number {
  return calcDcAndInverter(avgBimonthlyKwh, psh, pf, dcAcRatio).dcKw;
}

export function calcInverterKw(avgBimonthlyKwh: number, psh = 4.5, pf = 1.0, dcAcRatio = 1.1): number {
  return calcDcAndInverter(avgBimonthlyKwh, psh, pf, dcAcRatio).inverterKw;
}

export function calcEbBill(data: EbBillData): EbCalcResult {
  const validReadings = data.readings.filter(r => r.units > 0);
  if (validReadings.length === 0) {
    return { avgBimonthlyKwh: 0, avgDailyKwh: 0, tangedcoBill: 0, annualSaving: 0, inverterKw: 0, recommendedSystemKw: 0, avgRatePerKwh: 0 };
  }
  const avgBimonthlyKwh = validReadings.reduce((s, r) => s + r.units, 0) / validReadings.length;
  const avgDailyKwh = avgBimonthlyKwh / DAYS_PER_BIMONTHLY;
  const tangedcoBill = calcTangedcoBill(avgBimonthlyKwh);

  // Use actual avg Rs/kWh from bills (matches Excel approach) rather than slab recalculation.
  // Annual saving = system_generation × avg_rate; generation uses 4% derating (wiring + temperature),
  // NOT the 25% DC-oversizing factor which is for panel sizing only.
  const totalUnits = validReadings.reduce((s, r) => s + r.units, 0);
  const totalBillAmount = validReadings.reduce((s, r) => s + r.billAmount, 0);
  const avgRatePerKwh = totalUnits > 0 ? totalBillAmount / totalUnits : 0;

  const psh  = data.peakSunHours || 4.5;
  const pf   = data.powerFactor  || 1.0;
  const dcAc = data.dcAcRatio    || 1.1;
  const { inverterKw, dcKw: recommendedSystemKw } = calcDcAndInverter(avgBimonthlyKwh, psh, pf, dcAc);
  // Step 2 preview estimate: tangedcoBill × 6 periods (actual saving computed in Step 4 from BoM system kW)
  const annualSaving = tangedcoBill * 6;

  return { avgBimonthlyKwh, avgDailyKwh, tangedcoBill, annualSaving, inverterKw, recommendedSystemKw, avgRatePerKwh };
}

export function calcBomRow(row: BomRow): number {
  const bomCost = row.qty * row.unitPrice;
  const basicCost = bomCost * (1 + row.marginPct / 100);
  return basicCost * (1 + row.gstPct / 100);
}

export function calcBomTotals(rows: BomRow[], subsidy: number): BomTotals {
  const grossTotal = rows.reduce((s, r) => s + calcBomRow(r), 0);
  const netInvestment = grossTotal - subsidy;
  return { grossTotal, netInvestment };
}

export function calcROI(
  netInvestment: number,
  annualSaving: number,
  esc = 0.03,
  years = 20,
  inverterReplacementYear = 11,
  inverterReplacementCost = 54800,
): ROIData {
  const paybackExact = annualSaving > 0 ? netInvestment / annualSaving : 0;
  const paybackYears = Math.floor(paybackExact);
  const paybackMonths = Math.round((paybackExact - paybackYears) * 12);

  const yearlyData: YearlyROIPoint[] = [];
  let cumNoSolar = 0;
  let cumSolar = netInvestment;

  for (let yr = 1; yr <= years; yr++) {
    const billNoSolar = annualSaving * Math.pow(1 + esc, yr - 1);
    const billSolar = billNoSolar * 0.10;
    cumNoSolar += billNoSolar;
    cumSolar += billSolar + (yr === inverterReplacementYear ? inverterReplacementCost : 0);
    yearlyData.push({
      year: yr,
      billNoSolar,
      billSolar,
      cumNoSolar,
      cumSolar,
      breakeven: cumNoSolar - cumSolar,
    });
  }

  return {
    annualSaving,
    netInvestment,
    paybackYears,
    paybackMonths,
    roiPercent: annualSaving > 0 ? (annualSaving / netInvestment) * 100 : 0,
    yearlyData,
  };
}

export function formatINR(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(2)}L`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
