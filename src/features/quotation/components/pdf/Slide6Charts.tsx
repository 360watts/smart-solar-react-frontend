import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import type { QuotationData } from '../../types/quotation';
import { calcBomTotals, calcEbBill, calcROI } from '../../utils/roiCalculator';
import { SlideNum, SmallLogo, F } from './Slide2Company';

interface Props { data: QuotationData }

export function Slide6Charts({ data }: Props) {
  const calc = calcEbBill(data.ebBill);
  const { netInvestment } = calcBomTotals(data.optionA.rows, data.optionA.subsidy);
  const roi = calcROI(netInvestment, calc.annualSaving);
  const breakEvenYear = roi.yearlyData.find(y => y.breakeven >= 0)?.year;

  const chartData = roi.yearlyData.map(y => ({
    year: y.year,
    savings: parseFloat((y.breakeven / 100000).toFixed(2)),
    noSolar: parseFloat((y.cumNoSolar / 100000).toFixed(2)),
    withSolar: parseFloat((y.cumSolar / 100000).toFixed(2)),
  }));

  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '70px 80px 80px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={6} />
      <SmallLogo />

      <h2 style={{ fontSize: 80, fontWeight: 800, color: '#111', margin: '0 0 40px', textTransform: 'uppercase', letterSpacing: '-2px' }}>
        Why Solar Is A Good Investment
      </h2>

      <div style={{ flex: 1, display: 'flex', gap: 80 }}>
        {/* Bar chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <BarChart width={820} height={500} data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 16 }} label={{ value: 'Years', position: 'insideBottom', offset: -10, fontSize: 16 }} />
            <YAxis tick={{ fontSize: 16 }} tickFormatter={v => `${v}L`} label={{ value: 'INR', angle: -90, position: 'insideLeft', fontSize: 16 }} />
            <Tooltip formatter={(v: number) => [`₹${v}L`, 'Net savings']} />
            <ReferenceLine y={0} stroke="#1C3D5A" strokeWidth={2} />
            {breakEvenYear && (
              <ReferenceLine
                x={breakEvenYear}
                stroke="#F97316"
                strokeDasharray="4 4"
                label={{ value: `Breakeven\nat\n${breakEvenYear}${breakEvenYear === 1 ? 'st' : breakEvenYear === 2 ? 'nd' : breakEvenYear === 3 ? 'rd' : 'th'} year`, position: 'insideTopLeft', fill: '#F97316', fontSize: 15 }}
              />
            )}
            <Bar dataKey="savings" fill="#22C55E" radius={[3, 3, 0, 0]} />
          </BarChart>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 0' }}>
            Investment Savings &amp; Breakeven Year
          </p>
        </div>

        {/* Area chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <AreaChart width={820} height={500} data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 16 }} label={{ value: 'Years', position: 'insideBottom', offset: -10, fontSize: 16 }} />
            <YAxis tick={{ fontSize: 16 }} tickFormatter={v => `${v}L`} label={{ value: 'INR', angle: -90, position: 'insideLeft', fontSize: 16 }} />
            <Tooltip formatter={(v: number) => [`₹${v}L`, '']} />
            <Legend wrapperStyle={{ fontSize: 16 }} />
            <Area type="monotone" dataKey="noSolar" name="Cost of not-going solar" stroke="#9CA3AF" fill="#D1D5DB" strokeWidth={2} />
            <Area type="monotone" dataKey="withSolar" name="Cost of going solar" stroke="#F97316" fill="#BBF7D0" strokeWidth={2} />
          </AreaChart>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: '12px 0 0' }}>
            Cumulative cost of 20 years<br />
            <span style={{ fontWeight: 700 }}>(NOT GOING vs GOING SOLAR)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
