import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { apiService } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, FileText, User, Zap, Package, Loader2, Save, Eye, Send, CheckCircle, XCircle, MessageCircle, Mail, Copy, CheckCheck } from 'lucide-react';
import { Step1Customer } from './components/steps/Step1Customer';
import { Step2EbBill } from './components/steps/Step2EbBill';
import { Step3Bom, newRows } from './components/steps/Step3Bom';
import { Step4Review } from './components/steps/Step4Review';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { usePdfExport } from './hooks/usePdfExport';
import { useSaveDraft } from './hooks/useSaveDraft';
import { calcEbBill } from './utils/roiCalculator';
import type { QuotationData } from './types/quotation';

function formatRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Share + Status panel (shown on Step 4 when quote is saved) ──────────────
interface SharePanelProps {
  publicId: string;
  quoteNumber: string;
  customerPhone?: string;
  status: string;
  onStatusChange: (newStatus: string) => void;
}

function SharePanel({ publicId, quoteNumber, customerPhone }: Omit<SharePanelProps, 'status' | 'onStatusChange'>) {
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const quoteUrl = `${baseUrl}/quotation/${publicId}`;
  const phoneClean = (customerPhone ?? '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Hi, please find your solar proposal ${quoteNumber} here: ${quoteUrl}`);
  const mailSubject = encodeURIComponent(`Solar Proposal — ${quoteNumber}`);
  const mailBody = encodeURIComponent(`Dear Customer,\n\nPlease find your solar proposal (${quoteNumber}) at:\n${quoteUrl}\n\nRegards,\n360Watts Energy Solutions`);

  function copyLink() {
    navigator.clipboard.writeText(quoteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="sq-share-panel">
      {/* Share options — side-by-side cards */}
      <div className="sq-share-section">
        <p className="sq-share-section-label">Share Proposal</p>
        <div className="sq-share-actions">
          {phoneClean && (
            <a
              href={`https://wa.me/${phoneClean}?text=${waMsg}`}
              target="_blank"
              rel="noreferrer"
              className="sq-share-btn sq-share-btn-wa"
            >
              {/* WhatsApp brand icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          )}
          <a
            href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
            className="sq-share-btn sq-share-btn-email"
          >
            {/* Gmail official multicolor icon (Wikimedia) */}
            <svg width="16" height="12" viewBox="52 42 88 66">
              <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
              <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
              <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
              <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
              <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
            </svg>
            Email
          </a>
          <button className="sq-share-btn sq-share-btn-copy" onClick={copyLink}>
            {copied
              ? <CheckCheck style={{ width: 14, height: 14 }} />
              : <Copy style={{ width: 14, height: 14 }} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 1, num: 'I',   label: 'Customer & Site',  desc: 'Customer details and site photo',         icon: User },
  { id: 2, num: 'II',  label: 'EB Bill Analysis',  desc: 'Electricity consumption & system size',   icon: Zap },
  { id: 3, num: 'III', label: 'System BoM',         desc: 'Bill of materials and pricing',           icon: Package },
  { id: 4, num: 'IV',  label: 'Review & Generate',  desc: 'ROI analysis and PDF download',           icon: FileText },
];

const DEFAULT_NOT_INCLUDED =
  'Civil works\nTANGEDCO payment for sanctioned load extension + solar net meter\nReflective paints';

function getDefaults(): QuotationData {
  return {
    customer: { name: '', address: '', phone: '', sitePhotoBase64: '', systemType: 'ON-GRID', customerType: 'residential' },
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
    },
    optionA: {
      rows: newRows(),
      subsidy: 78000,
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
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [loadingDraft, setLoadingDraft] = useState(!!publicId);
  const [showPreview, setShowPreview] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string>('draft');
  const form = useForm<QuotationData>({ defaultValues: getDefaults() });
  const { containerRef, slideRefs, generating, generate } = usePdfExport();
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
      function applyPrices(rows: ReturnType<typeof newRows>) {
        return rows.map(r => {
          if (CATALOG_ITEMS.has(r.item.toLowerCase())) return r;
          const p = priceMap.get(r.item.toLowerCase());
          if (!p) return r;
          return {
            ...r,
            brand: p.brand || r.brand,
            unitPrice: parseFloat(p.unit_price) || r.unitPrice,
            marginPct: parseFloat(p.margin_pct) ?? r.marginPct,
            gstPct: parseFloat(p.gst_pct) ?? r.gstPct,
          };
        });
      }
      form.setValue('optionA.rows', applyPrices(form.getValues('optionA.rows')));
      const optionB = form.getValues('optionB');
      if (optionB) form.setValue('optionB.rows', applyPrices(optionB.rows));
    }).catch(() => { /* prices unavailable — keep zeros */ });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(n: number) {
    setDir(n > step ? 1 : -1);
    setStep(n);
  }

  function autofillBomQuantities() {
    const { ebBill } = form.getValues();
    const { inverterKw, recommendedSystemKw } = calcEbBill({ ...ebBill });
    const dcKw = recommendedSystemKw;   // inverterKw × dcAcRatio
    const acKw = inverterKw;
    if (acKw <= 0) return;

    function applyQtys(rows: ReturnType<typeof newRows>) {
      return rows.map(r => {
        const item = r.item.toLowerCase();
        if (item === 'panels') {
          const wpMatch = r.description.match(/(\d+)\s*[Ww]p/);
          const panelWp = wpMatch ? parseInt(wpMatch[1], 10) : 615;
          return { ...r, qty: Math.ceil((dcKw * 1000) / panelWp) };
        }
        if (item === 'mc4 connectors') {
          const wpMatch = (rows.find(x => x.item.toLowerCase() === 'panels')?.description ?? '').match(/(\d+)\s*[Ww]p/);
          const panelWp = wpMatch ? parseInt(wpMatch[1], 10) : 615;
          const panelQty = Math.ceil((dcKw * 1000) / panelWp);
          return { ...r, qty: panelQty * 2 };
        }
        if (item === 'mounting structure') {
          const ratePerKw = r.unitPrice > 0 && r.unitPrice <= 10000 ? r.unitPrice : 4000;
          return { ...r, unitPrice: Math.round(ratePerKw * acKw) };
        }
        if (item === 'installation') {
          const ratePerKw = r.unitPrice > 0 && r.unitPrice <= 10000 ? r.unitPrice : 3000;
          return { ...r, unitPrice: Math.round(ratePerKw * acKw) };
        }
        return r;
      });
    }

    form.setValue('optionA.rows', applyQtys(form.getValues('optionA.rows')));
    const optionB = form.getValues('optionB');
    if (optionB) form.setValue('optionB.rows', applyQtys(optionB.rows));
  }

  function next() {
    if (step === 2) autofillBomQuantities();
    goTo(Math.min(step + 1, 4));
  }
  function prev() { goTo(Math.max(step - 1, 1)); }

  async function handleGenerate() { await generate(form.getValues()); }

  async function handleSaveDraft() {
    try {
      await saveDraft(form.getValues());
      onSaved?.();
    } catch (err) {
      console.error('Failed to save draft', err);
    }
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
    <div className="sq-layout">

      {/* ── Sidebar ── */}
      <aside className="sq-sidebar">
        <p className="sq-sidebar-label">Steps</p>

        {/* Vertical spine */}
        <div className="sq-spine" />

        {STEPS.map((s) => {
          const done   = step > s.id;
          const active = step === s.id;
          const Icon   = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              className={`sq-step-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
            >
              <span className="sq-step-num">{s.num}</span>
              <span className="sq-step-meta">
                <span className="sq-step-name">{s.label}</span>
                <span className="sq-step-desc">{s.desc}</span>
              </span>
              {done && (
                <span className="sq-step-check">
                  <Check style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                </span>
              )}
              {!done && !active && (
                <span style={{ marginTop: 3, flexShrink: 0 }}>
                  <Icon style={{ width: 13, height: 13, color: 'var(--fg-muted, #94a3b8)' }} />
                </span>
              )}
            </button>
          );
        })}

        <div className="sq-sidebar-footer">
          <div className="sq-progress-label">
            <span>Progress</span>
            <span>{step}/{STEPS.length}</span>
          </div>
          <div className="sq-progress-bar">
            <div className="sq-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </aside>

      {/* ── Content ── */}
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
          {quoteNumber && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--fg-muted)', fontFamily: 'var(--mono)' }}>
              {quoteNumber}
            </span>
          )}
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
              {step === 2 && <Step2EbBill form={form} />}
              {step === 3 && <Step3Bom form={form} />}
              {step === 4 && (
                <>
                  <Step4Review form={form} />
                  {savedPublicId && quoteNumber && (
                    <SharePanel
                      publicId={savedPublicId}
                      quoteNumber={quoteNumber}
                      customerPhone={form.watch('customer.phone')}
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
            onClick={prev}
            disabled={step === 1}
            className="sq-btn-back"
          >
            <ChevronLeft style={{ width: 15, height: 15 }} />
            Back
          </button>

          <span className="sq-step-counter">{step} / {STEPS.length}</span>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="sq-btn-secondary"
          >
            {saving
              ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              : <Save style={{ width: 14, height: 14 }} />}
            {saving ? 'Saving…' : lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : 'Save Draft'}
          </button>

          {step < 4 ? (
            <button type="button" onClick={next} className="sq-btn-primary">
              Continue
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setShowPreview(true)} className="sq-btn-secondary">
                <Eye style={{ width: 14, height: 14 }} />
                Preview
              </button>
              <button type="button" onClick={handleGenerate} disabled={generating} className="sq-btn-primary">
                {generating
                  ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Generating…</>
                  : <><FileText style={{ width: 14, height: 14 }} />Download PDF</>
                }
              </button>
            </>
          )}
        </div>
      </div>

    </div>
    {showPreview && (
      <PdfPreviewModal data={form.getValues()} onClose={() => setShowPreview(false)} />
    )}
    </>
  );
}
