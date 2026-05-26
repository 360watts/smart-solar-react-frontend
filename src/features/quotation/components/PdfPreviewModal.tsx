import { PDFViewer } from '@react-pdf/renderer';
import React from 'react';
import { X } from 'lucide-react';
import { ProposalDocument } from './pdf/ProposalDocument';
import type { QuotationData } from '../types/quotation';

interface Props {
  data: QuotationData;
  onClose: () => void;
}

export function PdfPreviewModal({ data, onClose }: Props) {
  const origin = window.location.origin;
  const logoUrl = `${origin}/logo_with_font.png`;
  const finalLogoUrl = `${origin}/finalLogo.png`;
  const qrCodeUrl = `${origin}/assets/whatsapp-qr.png`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--card, #1a2435)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--fg, #f1f5f9)', fontWeight: 600, fontSize: 15 }}>
          PDF Preview — {data.customer.name || 'Draft'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg, #f1f5f9)', padding: '6px', borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* PDF viewer fills remaining space */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
          <ProposalDocument data={data} logoUrl={logoUrl} finalLogoUrl={finalLogoUrl} qrCodeUrl={qrCodeUrl} />
        </PDFViewer>
      </div>
    </div>
  );
}
