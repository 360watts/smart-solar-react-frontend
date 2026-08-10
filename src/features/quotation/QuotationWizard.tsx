import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, FileText, User, Zap, Package, Loader2, Save, Eye } from 'lucide-react';
import { Step1Customer } from './components/steps/Step1Customer';
import { StepSizing } from './components/steps/StepSizing';
import { StepBom, newRows } from './components/steps/StepBom';
import { Step4Review } from './components/steps/Step4Review';
import { LiveSummaryRail } from './components/LiveSummaryRail';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { usePdfExport, generatePdfBlob } from './hooks/usePdfExport';
import { useSaveDraft } from './hooks/useSaveDraft';
import { calcEbBill, calcEvSizing, getEffectiveSystemKw } from './utils/roiCalculator';
import type { QuotationData } from './types/quotation';
import { useIsMobile } from '../../shared/hooks/useIsMobile';

function formatRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Share panel (shown on Step 4 when quote is saved) ──────────────────────
interface SharePanelProps {
  quoteNumber: string;
  customerPhone?: string;
  getFormData: () => import('./types/quotation').QuotationData;
}

function SharePanel({ quoteNumber, customerPhone, getFormData }: SharePanelProps) {
  const [sharing, setSharing] = useState<'wa' | 'email' | null>(null);

  const phoneClean = (customerPhone ?? '').replace(/\D/g, '');

  async function sharePdf(channel: 'wa' | 'email') {
    setSharing(channel);
    const toastId = toast.loading('Generating PDF…');
    try {
      const data = getFormData();
      const { blob, filename } = await generatePdfBlob(data);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Solar Proposal — ${quoteNumber}` });
        toast.success('PDF shared!', { id: toastId });
      } else {
        // Desktop fallback: download PDF then open channel
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        if (channel === 'wa' && phoneClean) {
          const msg = encodeURIComponent(`Hi, please find your solar proposal (${quoteNumber}) attached.`);
          window.open(`https://wa.me/${phoneClean}?text=${msg}`, '_blank');
        } else if (channel === 'email') {
          const customerEmail = data.customer.email ?? '';
          const subject = encodeURIComponent(`Solar Proposal — ${quoteNumber}`);
          const body = encodeURIComponent(`Dear Customer,\n\nPlease find your solar proposal (${quoteNumber}) attached.\n\nRegards,\n360Watts Energy Solutions`);
          window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
        }
        toast.success('PDF downloaded — attach it to your message.', { id: toastId });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Share failed. Please try again.', { id: toastId });
      else toast.dismiss(toastId);
    } finally {
      setSharing(null);
    }
  }

  return (
    <div className="sq-share-panel">
      <div className="sq-share-section">
        <p className="sq-share-section-label">Share PDF Proposal</p>
        <div className="sq-share-actions">
          {phoneClean && (
            <button
              className="sq-share-btn sq-share-btn-wa"
              onClick={() => sharePdf('wa')}
              disabled={!!sharing}
            >
              {sharing === 'wa'
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
              }
              WhatsApp
            </button>
          )}
          <button
            className="sq-share-btn sq-share-btn-email"
            onClick={() => sharePdf('email')}
            disabled={!!sharing}
          >
            {sharing === 'email'
              ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              : <svg width="16" height="12" viewBox="52 42 88 66">
                  <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
                  <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
                  <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
                  <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
                  <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
                </svg>
            }
            Email
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 1, num: 'I',   label: 'Customer & Site',   desc: 'Customer details and site photo',      icon: User },
  { id: 2, num: 'II',  label: 'Sizing',             desc: 'Consumption & system size',             icon: Zap },
  { id: 3, num: 'III', label: 'Bill of Materials',  desc: 'Equipment and pricing',                  icon: Package },
  { id: 4, num: 'IV',  label: 'Review & Generate',  desc: 'ROI analysis and PDF download',          icon: FileText },
];

const DEFAULT_NOT_INCLUDED =
  'Civil works\nTANGEDCO payment for sanctioned load extension + solar net meter\nReflective paints';

function getDefaults(): QuotationData {
  return {
    customer: { name: '', address: '', phone: '', email: '', sitePhotoBase64: '', systemType: 'ON-GRID', customerType: 'residential' },
    ebBill: {
      readings: [
        { period: '', units: 0, billAmount: 0 },
        { period: '', units: 0, billAmount: 0 },
        { period: '', units: 0, billAmount: 0 },
      ],
      peakSunHours: 4.5,
      powerFactor: 1.0,
      dcAcRatio: 1.1,
      phase: 'single' as const,
      evSizing: {
        modelName: '',
        batteryCapacityKwh: 0,
        fullChargesPerWeek: 0,
        halfChargesPerWeek: 0,
      },
    },
    optionA: {
      rows: newRows(),
      subsidy: 78000,
      discount: 0,
      isRecommended: true,
      expansionPossible: false,
      notIncluded: DEFAULT_NOT_INCLUDED,
      factorsNote: '',
    },
    optionB: null,
  };
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 20, filter: 'blur(2px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, filter: 'blur(2px)' }),
};

interface WizardProps {
  publicId?: string | null;
  onSaved?: () => void;
}

export default function QuotationWizard({ publicId, onSaved }: WizardProps = {}) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [loadingDraft, setLoadingDraft] = useState(!!publicId);
  const [showPreview, setShowPreview] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string>('draft');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const form = useForm<QuotationData>({ defaultValues: getDefaults() });
  const { generating, generate } = usePdfExport();
  const { saveDraft, saving, lastSavedAt, quoteNumber, publicId: savedPublicId, setExistingDraft } = useSaveDraft();

  useEffect(() => {
    if (!publicId) return;
    apiService.getQuotation(publicId)
      .then(detail => {
        if (detail.form_data) form.reset(detail.form_data as unknown as QuotationData);
        setExistingDraft(detail.public_id, detail.quote_number ?? null, detail.version ?? 1);
        setQuoteStatus(detail.status ?? 'draft');
      })
      .catch(err => console.error('Failed to load draft', err))
      .finally(() => setLoadingDraft(false));
  }, [publicId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiService.getEquipmentPrices().then((prices) => {
      if (!prices.length) return;
      const priceMap = new Map(prices.map((p: any) => [p.item_name.toLowerCase(), p]));
      // Panels and Inverter are selected from ProductCatalog in Step 3 — skip them here
      const CATALOG_ITEMS = new Set(['panels', 'inverter']);
      // Patch only the rows that actually match a legacy price — via indexed setValue,
      // not a whole-array replace — so this can't remount (and interrupt) any in-flight
      // catalog picker elsewhere in the table (see autofillBomQuantities below for why).
      function applyPrices(path: 'optionA' | 'optionB', rows: ReturnType<typeof newRows>) {
        rows.forEach((r, idx) => {
          if (CATALOG_ITEMS.has(r.item.toLowerCase())) return;
          const p = priceMap.get(r.item.toLowerCase());
          if (!p) return;
          form.setValue(`${path}.rows.${idx}`, {
            ...r,
            brand: p.brand || r.brand,
            unitPrice: parseFloat(p.unit_price) || r.unitPrice,
            marginPct: parseFloat(p.margin_pct) ?? r.marginPct,
            gstPct: parseFloat(p.gst_pct) ?? r.gstPct,
            priceSource: 'legacy-equipment-price' as const,
            priceUnit: p.uom,
          });
        });
      }
      applyPrices('optionA', form.getValues('optionA.rows'));
      const optionB = form.getValues('optionB');
      if (optionB) applyPrices('optionB', optionB.rows);
    }).catch(() => { /* prices unavailable — keep zeros */ });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(n: number) {
    setDir(n > step ? 1 : -1);
    setStep(n);
  }

  const autofillBomQuantities = useCallback(() => {
    const { ebBill } = form.getValues();
    const calc = calcEbBill({ ...ebBill });
    const { inverterKw, exactDcKw } = calc;
    const effectiveKw = getEffectiveSystemKw(ebBill, calc);
    const baseDcKw = effectiveKw > 0 ? effectiveKw : exactDcKw;
    const acKw = inverterKw;
    if (acKw <= 0) return;

    // Option B represents the EV-inclusive system when an EV preset is selected —
    // it needs its own (bigger) panel/inverter sizing, not a mirror of Option A's.
    const evCalc = calcEvSizing(ebBill);
    const optionBDcKw = evCalc ? evCalc.recommendedSystemKw : baseDcKw;

    // Patches only the rows that actually need a new qty/rate, via indexed setValue —
    // never a whole-array replace. Replacing the whole array regenerates react-hook-form's
    // field-array ids, which remounts every CatalogSelector in the table (including any
    // mid-flight catalog auto-pick), silently dropping the price it was about to apply —
    // that's exactly how Option B's Panels row was ending up unpriced.
    function applyQtys(path: 'optionA' | 'optionB', rows: ReturnType<typeof newRows>, dcKw: number) {
      const panelDesc = rows.find(x => x.item.toLowerCase() === 'panels')?.description ?? '';
      const panelWpMatch = panelDesc.match(/(\d+)\s*[Ww]p/);
      const panelWp = panelWpMatch ? parseInt(panelWpMatch[1], 10) : 615;
      const panelQty = Math.ceil((dcKw * 1000) / panelWp);

      rows.forEach((r, idx) => {
        const item = r.item.toLowerCase();
        if (item === 'panels' && r.qty !== panelQty) {
          form.setValue(`${path}.rows.${idx}`, { ...r, qty: panelQty });
        } else if (item === 'mc4 connectors' && r.qty !== panelQty * 2) {
          form.setValue(`${path}.rows.${idx}`, { ...r, qty: panelQty * 2 });
        } else if (item === 'mounting structure' && r.priceSource !== 'catalog') {
          const ratePerKw = r.unitPrice > 0 && r.unitPrice <= 10000 ? r.unitPrice : 4000;
          form.setValue(`${path}.rows.${idx}`, { ...r, qty: 1, unitPrice: ratePerKw, priceUnit: 'rate_per_kw' });
        } else if (item === 'installation' && r.priceSource !== 'catalog') {
          const ratePerKw = r.unitPrice > 0 && r.unitPrice <= 10000 ? r.unitPrice : 3000;
          form.setValue(`${path}.rows.${idx}`, { ...r, qty: 1, unitPrice: ratePerKw, priceUnit: 'rate_per_kw' });
        }
      });
    }

    applyQtys('optionA', form.getValues('optionA.rows'), baseDcKw);
    const optionB = form.getValues('optionB');
    if (optionB) applyQtys('optionB', optionB.rows, optionBDcKw);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistDraft({ silent = false, leaveWizard = false }: { silent?: boolean; leaveWizard?: boolean } = {}) {
    try {
      await saveDraft(form.getValues());
      if (!silent) toast.success('Draft saved');
      if (leaveWizard) onSaved?.();
      return true;
    } catch (err) {
      console.error('Failed to save draft', err);
      toast.error('Unable to save draft. Please try again.');
      return false;
    }
  }

  async function navigateTo(targetStep: number) {
    const nextStep = Math.max(1, Math.min(targetStep, STEPS.length));
    if (nextStep === step) return;

    // Only gate forward movement — going back should always be free.
    if (nextStep > step) {
      if (step === 1) {
        const valid = await form.trigger(['customer.name', 'customer.address']);
        if (!valid) { toast.error('Add the customer name and site address before continuing.'); return; }
      }
      if (step === 2) {
        const ebBill = form.getValues('ebBill');
        const effectiveKw = getEffectiveSystemKw(ebBill, calcEbBill(ebBill));
        if (effectiveKw <= 0) { toast.error('Add at least one electricity bill reading before continuing.'); return; }
      }
    }

    const saved = await persistDraft({ silent: true });
    if (!saved) return;
    goTo(nextStep);
  }

  async function next() {
    await navigateTo(step + 1);
  }

  async function prev() {
    await navigateTo(step - 1);
  }

  async function handleGenerate() { await generate(form.getValues()); }

  async function handleSaveDraft() {
    await persistDraft({ leaveWizard: true });
  }

  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  const current = STEPS[step - 1];

  if (loadingDraft) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: 'var(--fg-muted)' }}>
        <Loader2 style={{ width: 22, height: 22 }} className="animate-spin" />
        <span style={{ marginLeft: 12, fontSize: '0.9rem' }}>Loading draft…</span>
      </div>
    );
  }

  return (
    <>
    <div className={`sq-layout ${isMobile ? 'sq-layout--mobile' : ''}`}>

      {/* ── Unified horizontal stepper (desktop + mobile) ── */}
      <div className="sq-hstepper">
        <div className="sq-hstepper__top">
          <span className="sq-hstepper__eyebrow">Proposal Flow</span>
          <span className="sq-hstepper__progress">{step}/{STEPS.length}</span>
        </div>
        <div className="sq-hstepper__rail">
          {STEPS.map((s) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => void navigateTo(s.id)}
                className={`sq-hstep-chip ${active ? 'active' : ''} ${done ? 'done' : ''}`}
              >
                {done
                  ? <Check style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                  : <Icon style={{ width: 13, height: 13 }} />}
                <span className="sq-hstep-chip__label">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="sq-hstepper__bar">
          <div className="sq-hstepper__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Content + live rail, two columns on desktop ── */}
      <div className="sq-body-split">
        <div className="sq-content">
          {/* Content header */}
          <div className="sq-content-header">
            <motion.p
              key={`eyebrow-${step}`}
              className="sq-content-eyebrow"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              Step {step} of {STEPS.length}
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.h2
                key={`title-${step}`}
                className="sq-content-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {current.label}
              </motion.h2>
            </AnimatePresence>
            <button type="button" onClick={() => setShowPreview(true)} className="sq-btn-secondary sq-preview-btn">
              <Eye style={{ width: 14, height: 14 }} />
              Preview
            </button>
          </div>

          {/* Animated step body */}
          <div className="sq-content-body" style={{ overflow: 'hidden' }}>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={step}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
              >
                {step === 1 && <Step1Customer form={form} />}
                {step === 2 && <StepSizing form={form} autofillBomQuantities={autofillBomQuantities} />}
                {step === 3 && <StepBom form={form} />}
                {step === 4 && (
                  <>
                    <Step4Review form={form} />
                    {savedPublicId && quoteNumber && (
                      <SharePanel
                        quoteNumber={quoteNumber}
                        customerPhone={form.watch('customer.phone')}
                        getFormData={form.getValues}
                      />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="sq-content-nav">
            <button
              type="button"
              onClick={() => void prev()}
              disabled={step === 1}
              className="sq-btn-back"
            >
              <ChevronLeft style={{ width: 15, height: 15 }} />
              Back
            </button>

            {!isMobile && <span className="sq-step-counter">{step} / {STEPS.length}</span>}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className={`sq-btn-secondary${saving ? ' is-live' : ''}`}
            >
              {saving
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : <Save style={{ width: 14, height: 14 }} />}
              {saving ? 'Saving…' : lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : 'Save Draft'}
            </button>

            {step < 4 ? (
              <button type="button" onClick={() => void next()} className="sq-btn-primary">
                Continue
                <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            ) : (
              <button type="button" onClick={handleGenerate} disabled={generating} className={`sq-btn-primary${generating ? ' is-live' : ''}`}>
                {generating
                  ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Generating…</>
                  : <><FileText style={{ width: 14, height: 14 }} />Download PDF</>
                }
              </button>
            )}
          </div>
        </div>

        <LiveSummaryRail
          form={form}
          quoteNumber={quoteNumber}
          collapsed={railCollapsed}
          onToggleCollapsed={() => setRailCollapsed(v => !v)}
        />
      </div>

    </div>
    {showPreview && (
      <PdfPreviewModal data={form.getValues()} onClose={() => setShowPreview(false)} />
    )}
    </>
  );
}
