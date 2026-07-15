import { UseFormReturn } from 'react-hook-form';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { calcBomTotals, calcEbBill, calcROI, formatINR } from '../utils/roiCalculator';
import type { QuotationData } from '../types/quotation';

interface LiveSummaryRailProps {
  form: UseFormReturn<QuotationData>;
  quoteNumber: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const SYSTEM_TYPE_LABEL: Record<string, string> = {
  'ON-GRID': 'On-Grid', 'HYBRID': 'Hybrid', 'OFF-GRID': 'Off-Grid',
};

function parsePanelWp(description: string): number {
  const m = description.match(/(\d+)\s*[Ww]p/);
  return m ? parseInt(m[1], 10) : 0;
}

export function LiveSummaryRail({ form, quoteNumber, collapsed, onToggleCollapsed }: LiveSummaryRailProps) {
  const custName = form.watch('customer.name');
  const custAddress = form.watch('customer.address');
  const sysType = form.watch('customer.systemType');
  const ebBill = form.watch('ebBill');
  const optionA = form.watch('optionA');

  const calc = calcEbBill(ebBill);
  const quotedSystemKw = calc.recommendedSystemKw;

  const panelRow = optionA.rows.find(r => r.item.toLowerCase() === 'panels');
  const panelWp = panelRow ? parsePanelWp(panelRow.description) : 0;
  const systemKw = panelRow && panelWp > 0 ? (panelRow.qty * panelWp) / 1000 : quotedSystemKw;

  const { netInvestment } = calcBomTotals(optionA.rows, optionA.subsidy, optionA.discount, quotedSystemKw);
  const safeInvestment = Math.max(0, netInvestment);
  const annualSaving = systemKw * ebBill.peakSunHours * 365.25 * 0.96 * calc.avgRatePerKwh;
  const roi = annualSaving > 0 ? calcROI(safeInvestment, annualSaving) : null;

  const rows = [
    { label: 'Customer', value: custName || '—' },
    { label: 'Site', value: custAddress ? custAddress.split('\n')[0] : '—' },
    { label: 'System', value: systemKw > 0 ? `${systemKw.toFixed(1)} kWp · ${SYSTEM_TYPE_LABEL[sysType] ?? sysType}` : '—' },
    { label: 'Net Investment', value: safeInvestment > 0 ? formatINR(safeInvestment) : '—', highlight: true },
    { label: 'ROI / Payback', value: roi ? `${roi.roiPercent.toFixed(1)}% · ${roi.paybackYears}y ${roi.paybackMonths}m` : '—' },
  ];

  if (collapsed) {
    return (
      <button type="button" className="sq-rail sq-rail--collapsed" onClick={onToggleCollapsed} aria-label="Expand summary">
        <ChevronLeft style={{ width: 14, height: 14 }} />
      </button>
    );
  }

  return (
    <aside className="sq-rail">
      <div className="sq-rail__header">
        <span className="sq-rail__title">Quote Summary</span>
        <button type="button" className="sq-rail__toggle" onClick={onToggleCollapsed} aria-label="Collapse summary">
          <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {quoteNumber && <p className="sq-rail__quote-number">{quoteNumber}</p>}
      <div className="sq-rail__rows">
        {rows.map(r => (
          <div key={r.label} className="sq-rail__row">
            <span className="sq-rail__label">{r.label}</span>
            <span className={r.highlight ? 'sq-rail__value sq-rail__value--highlight' : 'sq-rail__value'}>{r.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
