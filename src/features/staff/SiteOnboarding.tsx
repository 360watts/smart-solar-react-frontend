import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { apiService, SiteProfile } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccess } from '../../shared/access/useAccess';
import SavingsBillingEditor from './SavingsBillingEditor';
import { ConfirmDialog } from './siteHardware/ui';
import { timezoneLabel, timezoneOptions } from './timezones';
import { OnboardingData, SectionKey, sectionProgress } from './onboardingProgress';

type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'select'; options?: string[]; hint?: string };
type Draft = Record<string, string>;

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: 'first_name', label: 'Customer name' },
  { key: 'email', label: 'Email', hint: 'Login and invoices go here' },
  { key: 'mobile_number', label: 'Mobile number' },
  { key: 'address', label: 'Address', hint: 'Full postal address of the property' },
];
const SITE_FIELDS: FieldDef[] = [
  { key: 'display_name', label: 'Site name' },
  { key: 'capacity_kw', label: 'Solar capacity (kW)', type: 'number' },
  { key: 'inverter_capacity_kw', label: 'Inverter capacity (kW)', type: 'number' },
  { key: 'latitude', label: 'Latitude', type: 'number', hint: 'Used for solar forecasting' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'grid_type', label: 'Grid type', type: 'select', options: ['hybrid', 'on_grid', 'off_grid'] },
  { key: 'timezone', label: 'Time zone', type: 'select', hint: 'Sets the site\'s day boundaries for energy totals' },
  { key: 'commissioned_on', label: 'Commissioning date', type: 'date', hint: 'Date net metering went live' },
];
const EB_FIELDS: FieldDef[] = [
  { key: 'eb_consumer_number', label: 'EB consumer number', hint: 'Printed on the meter and the bill' },
  { key: 'eb_registered_mobile', label: 'Mobile number registered with EB', hint: 'The number the electricity board sends bill SMS/OTP to' },
];
const APPLIANCE_FIELDS: FieldDef[] = [
  { key: 'num_ac_units', label: 'Air conditioners', type: 'number', hint: 'Enter 0 if none' },
  { key: 'num_geysers', label: 'Water heaters', type: 'number' },
  { key: 'num_ev_chargers', label: 'EV chargers', type: 'number' },
  { key: 'ac_units_on_inverter', label: 'ACs on the inverter backup circuit', type: 'number',
    hint: 'Loads wired straight to the grid are not metered by the inverter' },
  { key: 'appliance_notes', label: 'Notes', hint: 'Anything on the grid line, occupancy, etc.' },
];

const NUMERIC = new Set(['capacity_kw', 'inverter_capacity_kw', 'latitude', 'longitude',
  'num_ac_units', 'num_geysers', 'num_ev_chargers', 'ac_units_on_inverter']);

const toDraft = (src: Record<string, any> | null, defs: FieldDef[]): Draft =>
  Object.fromEntries(defs.map(d => [d.key, src?.[d.key] == null ? '' : String(src[d.key])]));

/** Only the fields whose value changed, typed for the API (numbers as numbers, blank dates omitted). */
function changedPayload(draft: Draft, saved: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    if (v === saved[k]) continue;
    if (NUMERIC.has(k)) { if (v !== '') out[k] = Number(v); } else if (v !== '' || k === 'appliance_notes') out[k] = v;
  }
  return out;
}

export default function SiteOnboarding() {
  const { can } = useAccess();
  const canBilling = can('site_billing');
  const canUsers = can('users');
  const { isDark } = useTheme();
  const [params, setParams] = useSearchParams();
  const siteId = params.get('site') ?? '';

  const [sites, setSites] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);   // site the user asked for while dirty
  const [open, setOpen] = useState<SectionKey>('billing');

  const [site, setSite] = useState<any | null>(null);
  const [owner, setOwner] = useState<any | null>(null);
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const [savings, setSavings] = useState<any | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [busy, setBusy] = useState<SectionKey | null>(null);

  const [drafts, setDrafts] = useState<Record<'customer' | 'site' | 'appliances', Draft>>({ customer: {}, site: {}, appliances: {} });
  const [saved, setSaved] = useState<Record<'customer' | 'site' | 'appliances', Draft>>({ customer: {}, site: {}, appliances: {} });

  useEffect(() => { apiService.getSitesList({ includeInactive: true }).then(setSites).catch(() => setSites([])); }, []);

  const load = useCallback(async (id: string) => {
    setErrors({});
    setSite(null); setOwner(null); setProfile(null); setSavings(null);
    const [s, p, sv] = await Promise.allSettled([
      apiService.getSiteStaffDetail(id), apiService.getSiteProfile(id),
      canBilling ? apiService.getSiteSavings(id) : Promise.resolve(null),
    ]);
    const errs: Partial<Record<SectionKey, string>> = {};
    let o: any = null;
    if (s.status === 'fulfilled') {
      setSite(s.value);
      if (canUsers && s.value.owner_user != null) o = await apiService.getUserById(s.value.owner_user).catch(() => null);
      setOwner(o);
    } else errs.site = 'Could not load site details.';
    if (p.status === 'fulfilled') setProfile(p.value); else errs.appliances = 'Could not load appliance details.';
    if (sv.status === 'fulfilled') setSavings(sv.value); else if (canBilling) errs.billing = 'Could not load billing details.';
    setErrors(errs);
    const next = {
      customer: toDraft(o, CUSTOMER_FIELDS),
      site: toDraft(s.status === 'fulfilled' ? s.value : null, [...SITE_FIELDS, ...EB_FIELDS]),
      appliances: toDraft(p.status === 'fulfilled' ? p.value : null, APPLIANCE_FIELDS),
    };
    setDrafts(next); setSaved(next);
  }, [canBilling, canUsers]);

  useEffect(() => { if (siteId) load(siteId); }, [siteId, load]);

  const dirty = (k: 'customer' | 'site' | 'appliances') => JSON.stringify(drafts[k]) !== JSON.stringify(saved[k]);
  const anyDirty = dirty('customer') || dirty('site') || dirty('appliances');

  const pick = (id: string) => (anyDirty && id !== siteId ? setPending(id) : setParams(id ? { site: id } : {}));

  const save = async (k: 'customer' | 'site' | 'appliances') => {
    const payload = changedPayload(drafts[k], saved[k]);
    if (!Object.keys(payload).length) return;
    setBusy(k);
    try {
      if (k === 'customer') await apiService.updateUser(owner.id, payload);
      if (k === 'site') await apiService.patchSiteStaff(siteId, payload);
      if (k === 'appliances') await apiService.updateSiteProfile(siteId, payload as Partial<SiteProfile>);
      setSaved(s => ({ ...s, [k]: drafts[k] }));
      setErrors(e => ({ ...e, [k]: undefined }));
    } catch (e: any) {
      setErrors(er => ({ ...er, [k]: e?.message || 'Save failed' }));
    } finally { setBusy(null); }
  };

  const progress = useMemo(() => sectionProgress({
    owner: owner && { ...owner, ...drafts.customer },
    site: site && { ...site, ...drafts.site },
    profile: profile && { ...profile, ...Object.fromEntries(Object.entries(drafts.appliances).map(([k, v]) => [k, v === '' ? null : v])) },
    savings, billingAnchor: savings?.billingAnchor ?? null,
  } as OnboardingData, canBilling), [owner, site, profile, savings, drafts, canBilling]);

  const filteredSites = sites.filter(s =>
    `${s.site_id} ${s.display_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  const sectionList: { key: SectionKey; title: string }[] = [
    { key: 'customer', title: 'Customer' },
    { key: 'site', title: 'Site and system' },
    { key: 'appliances', title: 'Appliances' },
    { key: 'billing', title: 'Billing' },
  ];
  const totals = Object.values(progress).reduce((a, p) => ({ filled: a.filled + p.filled, total: a.total + p.total }), { filled: 0, total: 0 });
  const pct = totals.total ? Math.round((totals.filled / totals.total) * 100) : 0;
  const firstGap = sectionList.find(x => progress[x.key].filled < progress[x.key].total);

  // Progress ring draws in; reduced motion just sets the final value.
  const ringRef = useRef<SVGCircleElement>(null);
  const C = 2 * Math.PI * 50;
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(ringRef.current, { strokeDashoffset: C }, { strokeDashoffset: C * (1 - pct / 100), duration: 0.7, ease: 'power2.out' });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => { gsap.set(ringRef.current, { strokeDashoffset: C * (1 - pct / 100) }); });
    return () => mm.revert();
  }, [pct, C, siteId]);

  const control = 'min-h-11 w-full rounded-xl border bg-card px-3.5 py-3 text-[15px] text-foreground outline-none transition-shadow focus-visible:border-done focus-visible:ring-4 focus-visible:ring-done/20';

  const renderFields = (k: 'customer' | 'site' | 'appliances', defs: FieldDef[]) => (
    <div className="[display:grid] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-7 gap-y-5">
      {defs.map(d => {
        const val = drafts[k][d.key] ?? '';
        const needed = val === '' && d.type !== 'select';
        const set = (v: string) => setDrafts(x => ({ ...x, [k]: { ...x[k], [d.key]: v } }));
        return (
          <label key={d.key} className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              {d.label}
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${needed ? 'bg-needed-soft text-needed-ink' : 'bg-done-soft text-done-ink'}`}>
                {needed ? 'Needed' : 'Done'}
              </span>
            </span>
            {d.type === 'select' ? (
              <select className={`${control} border-input`} value={val} onChange={e => set(e.target.value)}>
                {(d.key === 'timezone' ? timezoneOptions(val) : d.options!).map(o => (
                  <option key={o} value={o}>{d.key === 'grid_type' ? o.replace('_', '-') : timezoneLabel(o)}</option>
                ))}
              </select>
            ) : (
              <input className={`${control} ${needed ? 'border-needed bg-needed-soft/30' : 'border-input'}`}
                type={d.type ?? 'text'} step={d.type === 'number' ? 'any' : undefined} min={d.type === 'number' ? 0 : undefined}
                value={val} onChange={e => set(e.target.value)} />
            )}
            {d.hint && <span className="mt-1.5 block text-[0.8125rem] text-muted-foreground">{d.hint}</span>}
          </label>
        );
      })}
    </div>
  );

  const saveBtn = (k: 'customer' | 'site' | 'appliances', label = 'Save') => (
    <button type="button" onClick={() => save(k)} disabled={!dirty(k) || busy === k}
      className="min-h-11 rounded-xl bg-foreground px-6 text-[15px] font-semibold text-background transition-opacity disabled:opacity-40">
      {busy === k ? 'Saving…' : label}
    </button>
  );

  const body: Record<SectionKey, React.ReactNode> = {
    customer: !canUsers ? <p className="text-muted-foreground">Customer details are managed by an admin.</p>
      : owner ? <>{renderFields('customer', CUSTOMER_FIELDS)}<div className="mt-7">{saveBtn('customer')}</div></>
      : <p className="text-muted-foreground">No customer is linked to this site yet. Link one from <Link className="underline" to={`/sites/${siteId}`}>the site page</Link>.</p>,
    site: <>{renderFields('site', SITE_FIELDS)}<div className="mt-7">{saveBtn('site')}</div></>,
    appliances: <>{renderFields('appliances', APPLIANCE_FIELDS)}<div className="mt-7">{saveBtn('appliances')}</div></>,
    billing: <>
      {renderFields('site', EB_FIELDS)}
      <div className="my-5">{saveBtn('site', 'Save EB account')}</div>
      {canBilling && <SavingsBillingEditor key={siteId} siteId={siteId} />}
    </>,
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pb-12 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Site" className={`${control} max-w-sm flex-1 border-input`} value={siteId} onChange={e => pick(e.target.value)}>
          <option value="">Select a site…</option>
          {filteredSites.map(s => <option key={s.site_id} value={s.site_id}>{s.display_name || s.site_id} ({s.site_id})</option>)}
        </select>
        <input aria-label="Search sites" placeholder="Search sites" className={`${control} max-w-56 border-input`} value={query} onChange={e => setQuery(e.target.value)} />
        <Link to="/sites/commissioning" className="text-sm text-muted-foreground underline">New site</Link>
      </div>

      {!siteId && <p className="text-muted-foreground">Choose a site to begin.</p>}

      {siteId && site && (
        <>
          <section className="flex flex-wrap items-center gap-7 rounded-3xl bg-forest p-7 text-white shadow-[0_18px_40px_-22px_rgba(12,26,20,0.8)]">
            <div className="relative h-[104px] w-[104px] shrink-0">
              <svg viewBox="0 0 120 120" width="104" height="104" role="img" aria-label={`${pct}% complete`}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
                <circle ref={ringRef} cx="60" cy="60" r="50" fill="none" stroke="var(--done)" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 60 60)" />
              </svg>
              <div className="absolute inset-0 [display:grid] place-items-center text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{pct}%</div>
            </div>
            <div className="min-w-[240px] flex-1">
              <h1 className="m-0 text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{site.display_name || siteId}</h1>
              <p className="mt-1.5 text-[15px] text-white/70">
                {totals.filled} of {totals.total} details filled. Fill the rest in any order; each section saves on its own.
              </p>
            </div>
            {firstGap && (
              <button type="button" onClick={() => setOpen(firstGap.key)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-done px-5 text-[15px] font-semibold text-[#06210F]">
                Next: {firstGap.title.toLowerCase()} <ArrowRight size={16} />
              </button>
            )}
          </section>

          <div className="flex flex-wrap items-start gap-6">
            <nav aria-label="Setup sections" className="flex w-full flex-col gap-1.5 md:w-[270px]">
              {sectionList.map(x => {
                const p = progress[x.key];
                const done = p.filled === p.total;
                const on = open === x.key;
                return (
                  <button key={x.key} type="button" aria-current={on} onClick={() => setOpen(x.key)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors ${on ? 'bg-card shadow-[0_0_0_1.5px_var(--foreground)]' : 'hover:bg-muted'}`}>
                    <span className={`[display:grid] h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[13px] font-bold ${done ? 'bg-done text-[#06210F]' : 'bg-needed text-[#3D2400]'}`}>
                      {done ? <Check size={15} strokeWidth={3} /> : '!'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-foreground">{x.title}</span>
                      <span className="block text-[0.8125rem] tabular-nums text-muted-foreground">
                        {x.key === 'customer' && !canUsers ? 'Admin only' : `${p.filled} of ${p.total} filled`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <section className="min-w-0 flex-1 basis-[520px] rounded-3xl border border-border bg-card p-7 shadow-sm">
              <h2 className="m-0 text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {sectionList.find(x => x.key === open)!.title}
              </h2>
              {errors[open] && <p role="alert" className="mt-3 rounded-lg bg-needed-soft px-3 py-2 text-needed-ink">{errors[open]}</p>}
              <div className="mt-6">{body[open]}</div>
            </section>
          </div>
        </>
      )}

      <ConfirmDialog isDark={isDark} open={pending !== null} tone="primary"
        title="Discard unsaved changes?" body="You have edits on this site that haven't been saved."
        confirmLabel="Discard and switch" cancelLabel="Keep editing"
        onConfirm={() => { setParams(pending ? { site: pending } : {}); setPending(null); }}
        onCancel={() => setPending(null)} />
    </div>
  );
}
