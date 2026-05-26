import { UseFormReturn } from 'react-hook-form';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { calcBomTotals, calcEbBill, calcROI, formatINR } from '../../utils/roiCalculator';
import type { QuotationData } from '../../types/quotation';

interface Props { form: UseFormReturn<QuotationData> }

const CHART_STYLE = {
  background: 'transparent',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1715',
      border: '1px solid rgba(0,166,62,0.2)',
      borderRadius: 8,
      padding: '8px 12px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.68rem',
    }}>
      <p style={{ color: '#7A6A58', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ₹{Math.abs(p.value).toLocaleString('en-IN')}k
        </p>
      ))}
    </div>
  );
}

function parsePanelWp(description: string): number {
  const m = description.match(/(\d+)\s*[Ww]p/);
  return m ? parseInt(m[1], 10) : 0;
}

export function Step4Review({ form }: Props) {
  const data = form.getValues();
  const calc = calcEbBill(data.ebBill);
  const { netInvestment } = calcBomTotals(data.optionA.rows, data.optionA.subsidy);
  const safeInvestment = Math.max(0, netInvestment);

  // Derive system kW from actual BoM: panel qty × Wp from description
  const panelRow = data.optionA.rows.find(r => r.item.toLowerCase() === 'panels');
  const panelWp = panelRow ? parsePanelWp(panelRow.description) : 0;
  const systemKw = panelRow && panelWp > 0
    ? (panelRow.qty * panelWp) / 1000
    : calc.recommendedSystemKw;

  // Annual saving = systemKw × PSH × 365.25 × 0.96 × avg ₹/kWh from bills
  const annualSaving = systemKw * data.ebBill.peakSunHours * 365.25 * 0.96 * calc.avgRatePerKwh;

  const roi = calcROI(safeInvestment, annualSaving);
  const breakEven = roi.yearlyData.find(y => y.breakeven >= 0)?.year;

  const chartData = roi.yearlyData.map(y => ({
    year: `Y${y.year}`,
    savings:  Math.round(y.breakeven  / 1000),
    noSolar:  Math.round(y.cumNoSolar / 1000),
    withSolar: Math.round(y.cumSolar  / 1000),
  }));

  const CELLS = [
    { key: 'Net Investment', val: formatINR(safeInvestment),                    cls: 'yellow' },
    { key: 'Annual Saving',  val: formatINR(annualSaving),                       cls: 'green'  },
    { key: 'Payback Period', val: `${roi.paybackYears}y ${roi.paybackMonths}m`,  cls: 'muted'  },
    { key: 'ROI / Year',     val: `${roi.roiPercent.toFixed(1)}%`,               cls: 'green'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Metric grid */}
      <div className="sq-review-grid">
        {CELLS.map(c => (
          <div key={c.key} className="sq-review-cell">
            <div className="sq-review-key">{c.key}</div>
            <div className={`sq-review-val ${c.cls}`}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Break-even badge */}
      {breakEven && (
        <div className="sq-breakeven">
          <div className="sq-breakeven-dot" />
          <span className="sq-breakeven-text">
            Break-even at Year {breakEven} — system fully pays for itself
          </span>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ minWidth: 0 }}>
          <p className="sq-chart-label">Net Cumulative Savings (₹ thousands)</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill: '#7A6A58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7A6A58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
                {breakEven && (
                  <ReferenceLine
                    x={`Y${breakEven}`}
                    stroke="#fdc700"
                    strokeDasharray="4 3"
                    label={{ value: '◆', position: 'insideTopRight', fill: '#fdc700', fontSize: 10 }}
                  />
                )}
                <Bar dataKey="savings" name="Net savings" fill="#00a63e" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <p className="sq-chart-label">Cumulative Cost Comparison (₹ thousands)</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill: '#7A6A58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7A6A58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#7A6A58' }}
                  iconType="circle" iconSize={7}
                />
                <Area type="monotone" dataKey="noSolar"   name="Without Solar" stroke="#2a4a35" fill="rgba(42,74,53,0.25)"   strokeWidth={1.5} />
                <Area type="monotone" dataKey="withSolar" name="With Solar"    stroke="#00a63e" fill="rgba(0,166,62,0.12)"  strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div style={{ borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', paddingTop: 14 }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--fg-muted, #64748b)', letterSpacing: '0.04em' }}>
          Click <span style={{ color: 'var(--amber, #f59e0b)' }}>Generate PDF</span> below to download the 10-slide proposal.
        </p>
      </div>

    </div>
  );
}
