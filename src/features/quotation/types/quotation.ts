export interface EbReading {
  period: string;
  units: number;
  billAmount: number;
}

export interface BomRow {
  id: string;
  item: string;
  brand: string;
  description: string;
  qty: number;
  unitPrice: number;
  marginPct: number;
  gstPct: number;
}

export interface QuoteOption {
  rows: BomRow[];
  subsidy: number;
  discount: number;
  isRecommended: boolean;
  expansionPossible: boolean;
  notIncluded: string;
  factorsNote: string;
}

export interface CustomerData {
  name: string;
  address: string;
  phone: string;
  email: string;
  sitePhotoBase64: string;
  systemType: 'ON-GRID' | 'HYBRID' | 'OFF-GRID';
  customerType: 'residential' | 'commercial';
}

export interface EbBillData {
  readings: EbReading[];
  peakSunHours: number;
  powerFactor: number;
  dcAcRatio: number;
  phase: 'single' | 'three';
}

export interface QuotationData {
  customer: CustomerData;
  ebBill: EbBillData;
  optionA: QuoteOption;
  optionB: QuoteOption | null;
}

export interface ROIData {
  annualSaving: number;
  netInvestment: number;
  paybackYears: number;
  paybackMonths: number;
  roiPercent: number;
  yearlyData: YearlyROIPoint[];
}

export interface YearlyROIPoint {
  year: number;
  billNoSolar: number;
  billSolar: number;
  cumNoSolar: number;
  cumSolar: number;
  breakeven: number;
}

export interface EbCalcResult {
  avgBimonthlyKwh: number;
  avgDailyKwh: number;
  tangedcoBill: number;
  annualSaving: number;
  inverterKw: number;          // snapped to nearest standard inverter size (AC kW)
  exactAcKw: number;           // raw AC requirement before snapping (kW)
  recommendedSystemKw: number; // snapped DC system size after applying dcAcRatio (kWp)
  exactDcKw: number;           // raw DC sizing after applying dcAcRatio, before snapping (kWp)
  avgRatePerKwh: number;
}

export interface BomTotals {
  grossTotal: number;
  netInvestment: number;
}

export interface EquipmentPrice {
  id: number;
  itemName: string;
  brand: string;
  description: string;
  unitPrice: number;
  uom: string;
  marginPct: number;
  gstPct: number;
  sortOrder: number;
  isActive: boolean;
}
