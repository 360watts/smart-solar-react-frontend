import { useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { calcEbBill, calcBomTotals } from '../utils/roiCalculator';
import type { QuotationData } from '../types/quotation';

function buildPayload(data: QuotationData): Record<string, unknown> {
  // Derive system size from EB bill readings
  const ebResult = calcEbBill(data.ebBill);
  const systemKw = ebResult.recommendedSystemKw > 0 ? ebResult.recommendedSystemKw : 5;

  // Net investment from optionA
  const totals = calcBomTotals(data.optionA.rows, data.optionA.subsidy);

  const systemTypeMap: Record<string, string> = {
    'ON-GRID': 'on_grid',
    'HYBRID': 'hybrid',
    'OFF-GRID': 'off_grid',
  };

  return {
    customer_name: data.customer.name,
    customer_phone: data.customer.phone,
    site_address: data.customer.address,
    system_type: systemTypeMap[data.customer.systemType] ?? 'on_grid',
    system_kw: Math.round(systemKw * 100) / 100,
    net_investment: Math.round(totals.netInvestment * 100) / 100,
    currency: 'INR',
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    form_data: data,
    pricing_snapshot: {},
  };
}

export function useSaveDraft() {
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const versionRef = useRef<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setExistingDraft(id: string, qNumber: string | null, version: number) {
    setPublicId(id);
    setQuoteNumber(qNumber);
    versionRef.current = version;
  }

  async function saveDraft(data: QuotationData): Promise<void> {
    setSaving(true);
    try {
      if (!publicId) {
        const result = await apiService.createQuotation(buildPayload(data));
        setPublicId(result.public_id);
        setQuoteNumber(result.quote_number ?? null);
        versionRef.current = result.version ?? 1;
      } else {
        const result = await apiService.patchQuotation(publicId, {
          ...buildPayload(data),
          version: versionRef.current,
        });
        versionRef.current = result.version ?? versionRef.current;
      }
      setLastSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  function startAutoSave(data: QuotationData, intervalMs = 60000) {
    stopAutoSave();
    intervalRef.current = setInterval(() => {
      saveDraft(data).catch(() => {});
    }, intervalMs);
  }

  function stopAutoSave() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return { saveDraft, saving, lastSavedAt, publicId, quoteNumber, setExistingDraft, startAutoSave, stopAutoSave };
}
