import { PDFViewer } from '@react-pdf/renderer';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProposalDocument } from './pdf/ProposalDocument';
import type { QuotationData } from '../types/quotation';

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface Props {
  data: QuotationData;
  onClose: () => void;
}

export function PdfPreviewModal({ data, onClose }: Props) {
  const origin = window.location.origin;
  const logoUrl = `${origin}/logo_with_font.png`;
  const finalLogoUrl = `${origin}/finalLogo.png`;
  const [appScreen1, setAppScreen1] = useState('');
  const [appScreen2, setAppScreen2] = useState('');
  const [phoneCover, setPhoneCover] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [ref6kw, setRef6kw] = useState('');
  const [ref8kw, setRef8kw] = useState('');
  const [ref20kw, setRef20kw] = useState('');

  useEffect(() => {
    Promise.all([
      toBase64(`${origin}/app-screen-energy.png`),
      toBase64(`${origin}/app-screen-dashboard.png`),
      toBase64(`${origin}/phonecover.png`),
      toBase64(`${origin}/whatsapp.png`),
      toBase64(`${origin}/6kw_ref.png`),
      toBase64(`${origin}/8kw_ref.png`),
      toBase64(`${origin}/20kw_ref.png`),
    ]).then(([s1, s2, pc, qr, r6, r8, r20]) => {
      setAppScreen1(s1); setAppScreen2(s2); setPhoneCover(pc);
      setQrCodeUrl(qr); setRef6kw(r6); setRef8kw(r8); setRef20kw(r20);
    });
  }, []);

  const ready = appScreen1 && appScreen2 && phoneCover && qrCodeUrl && ref6kw && ref8kw && ref20kw;

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
        {ready && (
          <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
            <ProposalDocument
              data={data}
              logoUrl={logoUrl}
              finalLogoUrl={finalLogoUrl}
              qrCodeUrl={qrCodeUrl}
              appScreen1={appScreen1}
              appScreen2={appScreen2}
              phoneCover={phoneCover}
              ref6kw={ref6kw}
              ref8kw={ref8kw}
              ref20kw={ref20kw}
            />
          </PDFViewer>
        )}
      </div>
    </div>
  );
}
