import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { apiService, SiteProfile } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import PageHeader from '../../shared/layout/PageHeader';
import SavingsBillingEditor from './SavingsBillingEditor';
import { Btn, ConfirmDialog, Field, StatusChip, controlStyle, useTokens } from './siteHardware/ui';
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
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const input = controlStyle(isDark);
  const [params, setParams] = useSearchParams();
  const siteId = params.get('site') ?? '';

  const [sites, setSites] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);   // site the user asked for while dirty
  const [open, setOpen] = useState<SectionKey | null>(null);

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
      apiService.getSiteStaffDetail(id), apiService.getSiteProfile(id), apiService.getSiteSavings(id),
    ]);
    const errs: Partial<Record<SectionKey, string>> = {};
    let o: any = null;
    if (s.status === 'fulfilled') {
      setSite(s.value);
      if (s.value.owner_user != null) o = await apiService.getUserById(s.value.owner_user).catch(() => null);
      setOwner(o);
    } else errs.site = 'Could not load site details.';
    if (p.status === 'fulfilled') setProfile(p.value); else errs.appliances = 'Could not load appliance details.';
    if (sv.status === 'fulfilled') setSavings(sv.value); else errs.billing = 'Could not load billing details.';
    setErrors(errs);
    const next = {
      customer: toDraft(o, CUSTOMER_FIELDS),
      site: toDraft(s.status === 'fulfilled' ? s.value : null, [...SITE_FIELDS, ...EB_FIELDS]),
      appliances: toDraft(p.status === 'fulfilled' ? p.value : null, APPLIANCE_FIELDS),
    };
    setDrafts(next); setSaved(next);
  }, []);

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
  } as OnboardingData), [owner, site, profile, savings, drafts]);

  const filteredSites = sites.filter(s =>
    `${s.site_id} ${s.display_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  const renderFields = (k: 'customer' | 'site' | 'appliances', defs: FieldDef[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
      {defs.map(d => (
        <Field key={d.key} isDark={isDark} label={d.label} hint={d.hint}>
          {d.type === 'select' ? (
            <select style={input} value={drafts[k][d.key] ?? ''} onChange={e => setDrafts(x => ({ ...x, [k]: { ...x[k], [d.key]: e.target.value } }))}>
              {d.options!.map(o => <option key={o} value={o}>{o.replace('_', '-')}</option>)}
            </select>
          ) : (
            <input style={input} type={d.type ?? 'text'} step={d.type === 'number' ? 'any' : undefined} min={d.type === 'number' ? 0 : undefined}
              value={drafts[k][d.key] ?? ''} onChange={e => setDrafts(x => ({ ...x, [k]: { ...x[k], [d.key]: e.target.value } }))} />
          )}
        </Field>
      ))}
    </div>
  );

  const section = (key: SectionKey, title: string, body: React.ReactNode, saveKey?: 'customer' | 'site' | 'appliances') => {
    const p = progress[key];
    const done = p.filled === p.total;
    const isOpen = open === key;
    return (
      <div key={key} style={{ border: `1px solid ${t.line}`, borderRadius: 14, background: t.card, marginBottom: 12 }}>
        <button type="button" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}
          style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span style={{ fontWeight: 700, color: t.ink, flex: 1 }}>{title}</span>
          <StatusChip isDark={isDark} state={done ? 'good' : 'wait'}>{done ? 'Complete' : `${p.filled} of ${p.total} filled`}</StatusChip>
        </button>
        {isOpen && (
          <div style={{ padding: '4px 16px 16px' }}>
            {errors[key] && <p role="alert" style={{ color: t.waitInk, margin: '0 0 12px' }}>{errors[key]}</p>}
            {body}
            {saveKey && (
              <div style={{ marginTop: 16 }}>
                <Btn isDark={isDark} onClick={() => save(saveKey)} disabled={!dirty(saveKey) || busy === saveKey}>
                  {busy === saveKey ? 'Saving…' : 'Save'}
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader title="Site onboarding" subtitle="Pick a site and fill in what's still missing. To add a new site, use the commissioning wizard." />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
        <input style={{ ...input, flex: '1 1 200px' }} placeholder="Search sites…" aria-label="Search sites" value={query} onChange={e => setQuery(e.target.value)} />
        <select style={{ ...input, flex: '2 1 280px' }} aria-label="Site" value={siteId} onChange={e => pick(e.target.value)}>
          <option value="">Select a site…</option>
          {filteredSites.map(s => <option key={s.site_id} value={s.site_id}>{s.display_name || s.site_id} ({s.site_id})</option>)}
        </select>
        <Link to="/sites/commissioning" style={{ alignSelf: 'center', color: t.ink2, fontSize: '0.88rem' }}>New site →</Link>
      </div>

      {!siteId && <p style={{ color: t.ink2 }}>Choose a site to begin.</p>}

      {siteId && (
        <>
          {section('customer', 'Customer',
            owner ? renderFields('customer', CUSTOMER_FIELDS)
              : <p style={{ color: t.ink2 }}>No customer is linked to this site yet. Link one from <Link to={`/sites/${siteId}`}>the site page</Link>.</p>,
            owner ? 'customer' : undefined)}
          {section('site', 'Site & system', renderFields('site', SITE_FIELDS), 'site')}
          {section('appliances', 'Appliances & metering', renderFields('appliances', APPLIANCE_FIELDS), 'appliances')}
          {section('billing', 'Billing & energy wallet', <>
            {renderFields('site', EB_FIELDS)}
            <div style={{ margin: '12px 0 20px' }}>
              <Btn isDark={isDark} onClick={() => save('site')} disabled={!dirty('site') || busy === 'site'}>
                {busy === 'site' ? 'Saving…' : 'Save EB account'}
              </Btn>
            </div>
            <SavingsBillingEditor key={siteId} siteId={siteId} />
          </>)}
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
