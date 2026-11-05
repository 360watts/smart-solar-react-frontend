import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { useTokens, Btn, ConfirmDialog } from '../siteHardware/ui';
import { apiService, MyOperation } from '../../../services/api';
import { Avatar, FormSection, LinkButton, MobileField, Modal, ReachPicker, Row2, Segmented, SignInDot, SwitchRow, TeamCombo, TextField } from './formParts';
import {
  EMPLOYMENT_LABEL, Employment, Person, PersonForm, ROLES, RoleKey, SiteOption, Team,
  buildPayload, firstNameOf, formError, formFromPerson, friendlyError, fullName, mobileDigits, roleInfo, roleOf,
  relativeTime, savedMessage, toMobile,
} from './roles';

type Tab = 'access' | 'contact' | 'activity';
const TABS: { key: Tab; label: string }[] = [
  { key: 'access', label: 'Access' }, { key: 'contact', label: 'Contact details' }, { key: 'activity', label: 'Device activity' },
];

const sorted = (a?: string[]) => [...(a ?? [])].sort();
/** How many things differ between the saved person and the form (the footer's "N unsaved changes"). */
export function changeCount(a: PersonForm, b: PersonForm): number {
  const keys: (keyof PersonForm)[] = ['first_name', 'last_name', 'email', 'role', 'team_id', 'device_ops_enabled', 'employment_status', 'is_active'];
  let n = keys.filter((k) => (a[k] ?? '') !== (b[k] ?? '')).length;
  if (mobileDigits(a.mobile_number) !== mobileDigits(b.mobile_number)) n++;
  if (JSON.stringify(sorted(a.assigned_sites)) !== JSON.stringify(sorted(b.assigned_sites))) n++;
  if (JSON.stringify(sorted(a.assigned_devices)) !== JSON.stringify(sorted(b.assigned_devices))) n++;
  return n;
}

/** Centred popup for one person: Access / Contact details / Device activity, one Save for all of it. */
export function PersonDialog({ isDark, person, sites, devices, teams, isSelf, onClose, onSaved, onToggleActive, onRemove, onCreateTeam, onCompareRoles }: {
  isDark: boolean; person: Person; sites: SiteOption[]; devices: SiteOption[]; teams: Team[]; isSelf: boolean;
  onClose: () => void; onSaved: (message: string) => void;
  onToggleActive: (p: Person) => void; onRemove: (p: Person) => void;
  onCreateTeam: (name: string) => Promise<Team | null>; onCompareRoles: () => void;
}) {
  const t = useTokens(isDark);
  const initial = useMemo(() => formFromPerson(person), [person]);
  const [form, setForm] = useState<PersonForm>(initial);
  const [tab, setTab] = useState<Tab>('access');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'discard' | 'admin' | null>(null);
  const name = firstNameOf(person);
  const changes = changeCount(form, initial);
  const invalid = formError(form, 'edit');
  const info = roleInfo(form.role);
  const signedIn = person.is_active !== false;
  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }));

  const requestClose = () => { if (confirm) return; if (changes) setConfirm('discard'); else onClose(); };

  const doSave = async () => {
    setConfirm(null);
    setSaving(true);
    setError(null);
    try {
      await apiService.updateEmployee(person.id, buildPayload(form, { address: person.address, clearTeam: true }));
      onSaved(savedMessage(initial, form, name));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };
  const save = () => {
    if (!changes || invalid || saving) return;
    if (form.role === 'admin' && initial.role !== 'admin') setConfirm('admin');
    else void doSave();
  };
  // Left also turns sign-in off; switching back to Working/On leave restores the saved setting.
  const setEmployment = (employment_status: Employment) =>
    set({ employment_status, is_active: employment_status === 'terminated' ? false : initial.is_active });

  return (
    <Modal isDark={isDark} label={`Access for ${fullName(person)}`} onClose={requestClose}
      header={<>
        <Avatar person={person} size={48} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: t.head, fontSize: '1.15rem', fontWeight: 700 }}>{fullName(person)}</h2>
          <div style={{ fontSize: '0.82rem', color: t.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[person.email, person.mobile_number].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: t.ink2, whiteSpace: 'nowrap' }}>
          <SignInDot on={signedIn} />{signedIn ? 'Can sign in' : "Can't sign in"}
        </span>
      </>}
      footer={<>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isSelf && <>
            <Btn isDark={isDark} variant="plain" size="sm" onClick={() => onToggleActive(person)}>{signedIn ? 'Turn off sign-in' : 'Turn on sign-in'}</Btn>
            <Btn isDark={isDark} variant="plain" size="sm" onClick={() => onRemove(person)}><span style={{ color: t.waitInk }}>Remove</span></Btn>
          </>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.82rem', color: t.ink2 }}>
            {changes ? (invalid ?? `${changes} unsaved change${changes === 1 ? '' : 's'}`) : 'No changes'}
          </span>
          <Btn isDark={isDark} variant="plain" disabled={!changes || saving} onClick={() => setForm(initial)}>Discard</Btn>
          <Btn isDark={isDark} disabled={!changes || !!invalid || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Btn>
        </span>
      </>}>
      <div role="tablist" aria-label="Sections" style={{ display: 'flex', gap: 18, padding: '0 22px', borderBottom: `1px solid ${t.line2}`, overflowX: 'auto' }}>
        {TABS.map((tb) => {
          const on = tb.key === tab;
          return (
            <button key={tb.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(tb.key)}
              style={{ padding: '11px 2px', border: 0, background: 'none', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: t.body, fontSize: '0.88rem', fontWeight: on ? 600 : 500, color: on ? t.ink : t.ink2, boxShadow: on ? `inset 0 -2px 0 ${t.good}` : 'none' }}>
              {tb.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 280 }}>
        {tab === 'access' && <>
          <FormSection isDark={isDark} title="Role" aside={<LinkButton isDark={isDark} onClick={onCompareRoles}>Compare roles</LinkButton>}>
            <Segmented<RoleKey> isDark={isDark} label="Role" value={form.role} disabled={isSelf}
              options={ROLES.map((r) => ({ value: r.key, label: r.label }))} onChange={(role) => set({ role })} />
            <span style={{ fontSize: '0.8rem', color: t.ink2 }}>
              {isSelf ? "You can't change your own role." : info.blurb}
              {roleOf(person) === 'viewer' && form.role !== 'viewer' && <span style={{ color: t.waitInk }}> Their sites and devices will be cleared.</span>}
            </span>
          </FormSection>
          {form.role === 'viewer' && (
            <FormSection isDark={isDark} title={`What ${name} can reach`}>
              <ReachPicker isDark={isDark} sites={sites} devices={devices}
                siteValue={form.assigned_sites} deviceValue={form.assigned_devices ?? []}
                onSites={(assigned_sites) => set({ assigned_sites })} onDevices={(assigned_devices) => set({ assigned_devices })} />
            </FormSection>
          )}
          <Row2>
            <TeamCombo isDark={isDark} teams={teams} value={form.team_id} onChange={(team_id) => set({ team_id })} onCreate={onCreateTeam} />
            <div />
          </Row2>
          {form.role !== 'admin' && (
            <SwitchRow isDark={isDark} checked={form.device_ops_enabled} onChange={(device_ops_enabled) => set({ device_ops_enabled })}
              label={form.role === 'viewer' ? 'Can restart and adjust these devices' : 'Can restart and adjust devices'} />
          )}
          <div className="emp-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, padding: '14px 16px', borderRadius: 14, background: t.card2, border: `1px solid ${t.line2}` }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.86rem' }}>{`${name} can`}</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {info.can.map((c) => <li key={c} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', lineHeight: 1.45 }}><Check size={14} color={t.good} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{c}</li>)}
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.86rem', color: t.ink2 }}>{`${name} can't`}</h4>
              {info.cant.length === 0 ? <p style={{ margin: 0, fontSize: '0.82rem', color: t.ink2 }}>Nothing is off limits.</p> : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  {info.cant.map((c) => <li key={c} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', lineHeight: 1.45, color: t.ink2 }}><Minus size={14} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{c}</li>)}
                </ul>
              )}
            </div>
          </div>
        </>}

        {tab === 'contact' && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row2>
            <TextField isDark={isDark} label="First name" value={form.first_name} onChange={(first_name) => set({ first_name })} />
            <TextField isDark={isDark} label="Last name" value={form.last_name} onChange={(last_name) => set({ last_name })} />
          </Row2>
          <TextField isDark={isDark} label="Work email" type="email" value={form.email} onChange={(email) => set({ email })} hint={`This is also how ${name} signs in.`} />
          <Row2>
            <MobileField isDark={isDark} value={mobileDigits(form.mobile_number)} onChange={(d) => set({ mobile_number: toMobile(d) })} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Employment</span>
              <Segmented<Employment> isDark={isDark} label="Employment" value={form.employment_status ?? 'active'} disabled={isSelf}
                options={(Object.keys(EMPLOYMENT_LABEL) as Employment[]).map((k) => ({ value: k, label: EMPLOYMENT_LABEL[k] }))} onChange={setEmployment} />
              <span style={{ minHeight: 16, fontSize: '0.75rem', color: t.ink2 }}>
                {form.employment_status === 'terminated' && initial.employment_status !== 'terminated' ? 'Sign-in turns off when you save.' : ''}
              </span>
            </div>
          </Row2>
          {form.email.trim() !== initial.email.trim() && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>
              {`You changed the email. ${name} will sign in with the new one from now on.`}
            </p>
          )}
        </div>}

        {tab === 'activity' && <ActivityList isDark={isDark} personId={person.id} name={name} />}

        {error && <div role="alert" style={{ fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
      </div>

      <ConfirmDialog isDark={isDark} open={confirm === 'discard'} title="Discard your changes?"
        body={`Your changes to ${name} won't be saved.`} confirmLabel="Discard" cancelLabel="Keep editing"
        onConfirm={() => { setConfirm(null); onClose(); }} onCancel={() => setConfirm(null)} />
      <ConfirmDialog isDark={isDark} open={confirm === 'admin'} tone="primary" title={`Make ${name} an admin?`}
        body="Admins can see billing and customer details, and change anyone's access." confirmLabel="Make admin" cancelLabel="Not now"
        onConfirm={() => void doSave()} onCancel={() => setConfirm(null)} />
    </Modal>
  );
}

// Plain words for api/views/device_detail.py OP_ACTIONS; mute/unmute and debug on/off use `action`.
const OP_TEXT: Record<string, string> = {
  reboot: 'Restarted', hard_reset: 'Hard reset', auto_reboot: 'Changed auto restart', fetch_logs: 'Turned log upload on or off',
  diagnostics: 'Ran diagnostics', ota_update: 'Sent a firmware update', rollback: 'Rolled back firmware', apn: 'Changed the APN',
  wifi: 'Changed Wi-Fi', meter_calibrate: 'Calibrated the meter', meter_interval: 'Changed the meter interval',
};
const ACTION_TEXT: Record<string, string> = { mute: 'Muted the buzzer', unmute: 'Unmuted the buzzer', telemetry_debug_on: 'Turned debug data on', telemetry_debug_off: 'Turned debug data off' };
const opText = (r: MyOperation) => ACTION_TEXT[r.action] ?? OP_TEXT[r.op] ?? r.op.replace(/_/g, ' ');

function ActivityList({ isDark, personId, name }: { isDark: boolean; personId: number; name: string }) {
  const t = useTokens(isDark);
  const [rows, setRows] = useState<MyOperation[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    apiService.getEmployeeOperations(personId, 30)
      .then((r) => { if (live) setRows(r.rows ?? []); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [personId]);
  if (failed) return <p style={{ margin: 0, fontSize: '0.86rem', color: t.ink2 }}>Couldn't load device activity. Close and open this person again to retry.</p>;
  if (rows === null) return <div aria-busy="true" style={{ display: 'grid', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 36, borderRadius: 10, background: t.idleBg }} />)}</div>;
  if (rows.length === 0) return <p style={{ margin: 0, fontSize: '0.86rem', color: t.ink2 }}>{`${name} hasn't restarted or changed any device in the last 30 days.`}</p>;
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: t.ink2 }}>{rows.length >= 200 ? 'Last 30 days · showing the latest 200' : 'Last 30 days'}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {rows.map((r, i) => (
          <li key={`${r.at}-${i}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${t.line2}` : 0, fontSize: '0.86rem' }}>
            <span style={{ minWidth: 0 }}>
              {opText(r)}{r.serial && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: t.ink2 }}> · {r.serial}</span>}
              {r.site_id && <span style={{ color: t.ink2 }}> · {r.site_id}</span>}
            </span>
            <span style={{ color: t.ink2, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{relativeTime(r.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
