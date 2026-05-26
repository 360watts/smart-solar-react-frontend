import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import React from 'react';
import type { QuotationData } from '../types/quotation';
import { ProposalDocument } from '../components/pdf/ProposalDocument';

export function usePdfExport() {
  const [generating, setGenerating] = useState(false);

  async function generate(data: QuotationData) {
    setGenerating(true);
    const toastId = toast.loading('Generating PDF proposal…');

    try {
      const origin = window.location.origin;
      const logoUrl = `${origin}/logo_with_font.png`;
      const finalLogoUrl = `${origin}/finalLogo.png`;
      const qrCodeUrl = `${origin}/assets/whatsapp-qr.png`;

      const doc = React.createElement(ProposalDocument, { data, logoUrl, finalLogoUrl, qrCodeUrl }) as any;
      const blob = await pdf(doc).toBlob();

      const date = new Date().toISOString().slice(0, 10);
      const name = (data.customer.name || 'customer').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `360watts-proposal-${name}-${date}.pdf`;
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

  // Kept for backwards compat — no longer used
  const containerRef = { current: null };
  const slideRefs: React.RefObject<HTMLDivElement>[] = [];

  return { containerRef, slideRefs, generating, generate };
}
