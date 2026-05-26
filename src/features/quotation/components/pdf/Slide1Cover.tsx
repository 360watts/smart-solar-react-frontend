import type { QuotationData } from '../../types/quotation';
import { calcEbBill } from '../../utils/roiCalculator';

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMUMzRDVBIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjOTRBM0I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+U2l0ZSBQaG90bzwvdGV4dD48L3N2Zz4=';

interface Props { data: QuotationData }

export function Slide1Cover({ data }: Props) {
  const { customer, ebBill } = data;
  const calc = calcEbBill(ebBill);
  const photo = customer.sitePhotoBase64 || PLACEHOLDER;
  const systemKw = calc.inverterKw > 0 ? calc.inverterKw : '—';

  // Parse address into clean lines, splitting on commas
  const addrLines = customer.address
    ? customer.address.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div style={{
      width: 1920, height: 1080,
      background: '#ffffff',
      position: 'relative',
      fontFamily: 'Inter, Arial, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Navy diagonal triangle — covers top-right ── */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '100%', height: '100%',
        background: '#1C3D5A',
        clipPath: 'polygon(47% 0%, 100% 0%, 100% 57%)',
        zIndex: 1,
      }} />

      {/* ── Site photo — inside triangle area ── */}
      <div style={{
        position: 'absolute',
        top: 28, right: 116,
        width: 440, height: 468,
        zIndex: 3,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
      }}>
        <img
          src={photo}
          alt="Site"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* ── Logo — top left ── */}
      <div style={{ position: 'absolute', top: 56, left: 80, zIndex: 4 }}>
        <img
          src="/logo_with_font.png"
          alt="360watts"
          style={{ height: 120, display: 'block' }}
        />
      </div>

      {/* ── Main heading block ── */}
      <div style={{
        position: 'absolute',
        bottom: 220, left: 80,
        zIndex: 4,
        maxWidth: 860,
      }}>
        <h1 style={{
          fontSize: 88,
          fontWeight: 800,
          color: '#111111',
          margin: 0,
          lineHeight: 1.02,
          letterSpacing: '-2.5px',
        }}>
          Smart Solar Proposal
        </h1>
        <p style={{
          fontSize: 34,
          color: '#444444',
          margin: '18px 0 0',
          fontWeight: 400,
          letterSpacing: '-0.3px',
        }}>
          for customer{' '}
          <strong style={{ fontWeight: 700, color: '#111111' }}>
            {customer.name || 'Customer Name'}
          </strong>
        </p>
      </div>

      {/* ── kW badge — bottom left ── */}
      <div style={{
        position: 'absolute',
        bottom: 68, left: 80,
        zIndex: 4,
        border: '3px solid #22C55E',
        borderRadius: 10,
        padding: '12px 40px',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 10,
      }}>
        <span style={{
          fontSize: 68,
          fontWeight: 700,
          color: '#22C55E',
          lineHeight: 1,
          letterSpacing: '-1px',
        }}>
          {systemKw}
        </span>
        <span style={{
          fontSize: 32,
          fontWeight: 600,
          color: '#22C55E',
          letterSpacing: '0',
        }}>
          kW
        </span>
      </div>

      {/* ── Address — bottom right, dark text on white ── */}
      {(addrLines.length > 0 || customer.phone) && (
        <div style={{
          position: 'absolute',
          bottom: 68, right: 80,
          zIndex: 4,
          textAlign: 'right',
          maxWidth: 480,
        }}>
          {addrLines.map((line, i) => (
            <p key={i} style={{
              color: '#333333',
              fontSize: 21,
              lineHeight: 1.65,
              margin: 0,
            }}>
              {line}{i < addrLines.length - 1 ? ',' : ''}
            </p>
          ))}
          {customer.phone && (
            <p style={{ color: '#333333', fontSize: 21, lineHeight: 1.65, margin: '6px 0 0' }}>
              {customer.phone}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
