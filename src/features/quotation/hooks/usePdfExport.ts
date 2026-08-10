import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import type { QuotationData } from '../types/quotation';
import { ProposalDocument } from '../components/pdf/ProposalDocument';

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

/** Renders the proposal as a PDF Blob without downloading it. */
export async function generatePdfBlob(data: QuotationData): Promise<{ blob: Blob; filename: string }> {
  const origin = window.location.origin;
  const logoUrl = `${origin}/logo_with_font.png`;
  const finalLogoUrl = `${origin}/finalLogo.png`;
  const [appScreen1, appScreen2, phoneCover, qrCodeUrl, ref6kw, ref8kw, ref20kw] = await Promise.all([
    toBase64(`${origin}/app-screen-energy.png`),
    toBase64(`${origin}/app-screen-dashboard.png`),
    toBase64(`${origin}/phonecover.png`),
    toBase64(`${origin}/whatsapp.png`),
    toBase64(`${origin}/6kw_ref.png`),
    toBase64(`${origin}/8kw_ref.png`),
    toBase64(`${origin}/20kw_ref.png`),
  ]);

  const doc = React.createElement(ProposalDocument, { data, logoUrl, finalLogoUrl, qrCodeUrl, appScreen1, appScreen2, phoneCover, ref6kw, ref8kw, ref20kw }) as any;
  const blob = await pdf(doc).toBlob();
  const date = new Date().toISOString().slice(0, 10);
  const name = (data.customer.name || 'customer').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return { blob, filename: `360watts-proposal-${name}-${date}.pdf` };
}

export function usePdfExport() {
  const [generating, setGenerating] = useState(false);

  async function generate(data: QuotationData) {
    setGenerating(true);
    const toastId = toast.loading('Generating PDF proposal…');

    try {
      const { blob, filename } = await generatePdfBlob(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!', { id: toastId });
    } catch (err) {
      console.error('PDF generation failed', err);
      toast.error('PDF generation failed. Please try again.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  return { generating, generate };
}
