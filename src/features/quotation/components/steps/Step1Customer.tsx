import { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Upload, X } from 'lucide-react';
import type { QuotationData } from '../../types/quotation';

interface Props { form: UseFormReturn<QuotationData> }

const SYSTEM_TYPES = [
  { value: 'ON-GRID',  label: 'On-Grid',  desc: 'Grid-tied, no battery' },
  { value: 'HYBRID',   label: 'Hybrid',   desc: 'Solar + battery + grid' },
  { value: 'OFF-GRID', label: 'Off-Grid', desc: 'Fully off-grid' },
];

export function Step1Customer({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form;
  const fileRef   = useRef<HTMLInputElement>(null);
  const photo     = watch('customer.sitePhotoBase64');
  const sysType   = watch('customer.systemType');

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setValue('customer.sitePhotoBase64', ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="sq-stack">

      {/* Row 1 — name + phone */}
      <div className="sq-grid-2">
        <div className="sq-field">
          <label className="sq-label">Customer Name *</label>
          <input
            className="sq-input"
            placeholder="Mr. Ramesh Kumar"
            {...register('customer.name', { required: true })}
          />
          {errors.customer?.name && <p className="sq-error">Name is required</p>}
        </div>
        <div className="sq-field">
          <label className="sq-label">Phone Number</label>
          <input
            className="sq-input"
            placeholder="+91 98765 43210"
            {...register('customer.phone')}
          />
        </div>
      </div>

      {/* Address */}
      <div className="sq-field">
        <label className="sq-label">Site Address *</label>
        <textarea
          className="sq-textarea"
          rows={3}
          placeholder="123, Main Street, Coimbatore – 641 001, Tamil Nadu"
          {...register('customer.address', { required: true })}
        />
        {errors.customer?.address && <p className="sq-error">Address is required</p>}
      </div>

      {/* System type */}
      <div className="sq-field">
        <label className="sq-label">System Type</label>
        <div className="sq-type-grid">
          {SYSTEM_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setValue('customer.systemType', t.value as any)}
              className={`sq-type-btn ${sysType === t.value ? 'selected' : ''}`}
            >
              <div className="sq-type-name">{t.label}</div>
              <div className="sq-type-desc">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Site photo */}
      <div className="sq-field">
        <label className="sq-label">
          Site Photo <span style={{ color: 'var(--sq-muted)', textTransform: 'none', letterSpacing: 0, fontSize: '0.65rem' }}>— optional</span>
        </label>

        {photo ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={photo}
              alt="Site"
              style={{ height: 130, width: 210, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(212,98,42,0.3)', display: 'block' }}
            />
            <button
              type="button"
              onClick={() => setValue('customer.sitePhotoBase64', '')}
              style={{
                position: 'absolute', top: -8, right: -8,
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--sq-raised)', border: '1px solid var(--sq-border2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--sq-muted)',
              }}
            >
              <X style={{ width: 11, height: 11 }} />
            </button>
          </div>
        ) : (
          <div
            className="sq-photo-zone"
            style={{ width: 210, height: 130 }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload style={{ width: 20, height: 20 }} />
            <span style={{ fontFamily: 'var(--sq-mono)', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Click to upload
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        <p className="sq-hint">JPG / PNG — appears on the PDF cover slide</p>
      </div>

    </div>
  );
}
