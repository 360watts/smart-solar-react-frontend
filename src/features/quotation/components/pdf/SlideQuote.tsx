import type { QuotationData, QuoteOption, BomRow } from '../../types/quotation';
import { calcBomTotals, calcEbBill, calcROI, formatINR } from '../../utils/roiCalculator';
import { SlideNum, SmallLogo, F } from './Slide2Company';

interface Props {
  data: QuotationData;
  option: QuoteOption;
  optionLabel: string;
  slideNum?: number;
}

const PRIMARY_ITEMS = ['panels', 'inverter', 'iot hub'];

function isPrimary(row: BomRow) {
  return PRIMARY_ITEMS.some(k => row.item.toLowerCase().includes(k));
}

function groupSecondary(rows: BomRow[]): string[] {
  const sec = rows.filter(r => !isPrimary(r));
  const groups: string[] = [];
  // Protection
  const prot = sec.filter(r => r.item.toLowerCase().includes('acdb') || r.item.toLowerCase().includes('dcdb'));
  if (prot.length) groups.push('Protection devices (' + prot.map(r => r.item).join(', ') + ')');
  // Mounting
  const mount = sec.filter(r => r.item.toLowerCase().includes('mounting'));
  if (mount.length) groups.push('Mounting Structures (' + mount.map(r => r.description || 'GI Steel').join(', ') + ')');
  // BoS
  const bos = sec.filter(r =>
    r.item.toLowerCase().includes('earthing') ||
    r.item.toLowerCase().includes('lightning') ||
    r.item.toLowerCase().includes('mc4') ||
    r.item.toLowerCase().includes('accessor')
  );
  if (bos.length) groups.push('Balance of System\n(' + bos.map(r => r.item).join(', ') + ')');
  // Wiring
  const wire = sec.filter(r => r.item.toLowerCase().includes('wir'));
  if (wire.length) {
    const desc = wire.map(r => r.description || r.item).join(', ');
    groups.push('DC wire / AC wire' + (desc ? '\n(' + desc + ')' : ''));
  }
  // Others not yet grouped
  const accounted = new Set([...prot, ...mount, ...bos, ...wire].map(r => r.id));
  sec.filter(r => !accounted.has(r.id)).forEach(r => groups.push(r.item));
  return groups;
}

const TD: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid #E8E8E8', fontSize: 20, color: '#222', verticalAlign: 'top' };
const TH: React.CSSProperties = { padding: '12px 16px', borderBottom: '2px solid #E8E8E8', fontSize: 18, color: '#444', fontWeight: 600, textAlign: 'left', background: '#fafafa' };

export function SlideQuote({ data, option, slideNum = 3 }: Props) {
  const calc = calcEbBill(data.ebBill);
  const { grossTotal, netInvestment } = calcBomTotals(option.rows, option.subsidy);
  const roi = calcROI(netInvestment, calc.annualSaving);

  const primaryRows = option.rows.filter(isPrimary);
  const secondaryGroups = groupSecondary(option.rows);
  const notIncludedLines = option.notIncluded ? option.notIncluded.split('\n').filter(Boolean) : [];
  const factorLines = option.factorsNote ? option.factorsNote.split('\n').filter(Boolean) : [];

  return (
    <div style={{ width: 1920, height: 1080, background: '#fff', fontFamily: F, position: 'relative', padding: '60px 80px 70px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <SlideNum n={slideNum} />
      <SmallLogo />

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 36, marginRight: 120 }}>
        <h2 style={{ fontSize: 50, fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-0.5px' }}>
          Quotation for {calc.inverterKw > 0 ? `${calc.inverterKw}kW` : '—'} solar system ({data.customer.systemType.replace('_', '-')})
        </h2>
        {option.isRecommended && (
          <div style={{ background: '#F97316', borderRadius: 6, padding: '6px 20px', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: '0.05em' }}>RECOMMENDED</span>
          </div>
        )}
      </div>

      {/* 3-column body */}
      <div style={{ flex: 1, display: 'flex', gap: 48 }}>

        {/* Primary components table */}
        <div style={{ width: 460 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '50%' }}>Primary components</th>
                <th style={{ ...TH, width: '25%' }}>Brand</th>
                <th style={{ ...TH, width: '25%' }}>Qty.</th>
              </tr>
            </thead>
            <tbody>
              {primaryRows.map(row => (
                <tr key={row.id}>
                  <td style={{ ...TD, border: '1px solid #ddd' }}>
                    {row.item === 'Panels' || row.item.toLowerCase() === 'panels'
                      ? <><strong style={{ display: 'block' }}>Solar Panel</strong><span style={{ fontSize: 17, color: '#555' }}>({row.description})</span></>
                      : row.item.toLowerCase() === 'inverter'
                      ? <><strong style={{ display: 'block' }}>On-Grid Solar Inverter</strong><span style={{ fontSize: 17, color: '#555' }}>({row.description})</span></>
                      : <><strong style={{ display: 'block' }}>{row.item}</strong>{row.description && <span style={{ fontSize: 17, color: '#555' }}>({row.description})</span>}</>
                    }
                  </td>
                  <td style={{ ...TD, border: '1px solid #ddd' }}>{row.brand || '—'}</td>
                  <td style={{ ...TD, border: '1px solid #ddd' }}>{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Secondary components table */}
        <div style={{ width: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr>
                <th style={{ ...TH }}>Secondary components</th>
              </tr>
            </thead>
            <tbody>
              {secondaryGroups.map((g, i) => (
                <tr key={i}>
                  <td style={{ ...TD, border: '1px solid #ddd', whiteSpace: 'pre-line' }}>{g}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: pricing + notes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Total Amount</p>
            <div style={{ background: '#FFF3E0', border: '2px solid #F97316', borderRadius: 8, padding: '10px 20px' }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#F97316' }}>
                ₹ {grossTotal.toLocaleString('en-IN')}/- <span style={{ fontSize: 18, fontWeight: 400 }}>(inclusive GST)</span>
              </span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Payback At</p>
            <div style={{ border: '2px solid #22C55E', borderRadius: 8, padding: '10px 20px' }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#22C55E' }}>
                {roi.paybackYears} years{roi.paybackMonths > 0 ? `, ${roi.paybackMonths} months` : ''}
              </span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Scope for Future Expansion</p>
            <div style={{ border: '2px solid #22C55E', borderRadius: 8, padding: '8px 20px', display: 'inline-block' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#22C55E' }}>{option.expansionPossible ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {notIncludedLines.length > 0 && (
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Not Included in Quotation</p>
              <ol style={{ margin: 0, paddingLeft: 24, color: '#333', fontSize: 19, lineHeight: 1.7 }}>
                {notIncludedLines.map((l, i) => <li key={i}>{l}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Factors note */}
      {factorLines.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
          <p style={{ fontSize: 19, color: '#111', margin: '0 0 8px', fontWeight: 700 }}>Factors taken into calculation:</p>
          <ol style={{ margin: 0, paddingLeft: 24, color: '#333', fontSize: 19, lineHeight: 1.7 }}>
            {factorLines.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
