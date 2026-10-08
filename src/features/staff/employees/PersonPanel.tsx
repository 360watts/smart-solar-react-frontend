import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, Minus, X } from 'lucide-react';
import {
  useTokens, StatusChip, Btn, Field, controlStyle, DetailsToggle, ConfirmDialog,
} from '../siteHardware/ui';
import { apiService } from '../../../services/api';
import { useDialogBehavior } from './useDialogBehavior';
import { Avatar, DeviceOpsSwitch } from './parts';
import { RoleCards } from './RoleCards';
import { SitePicker } from './SitePicker';
import {
  Person, PersonForm, SiteOption, Team, buildPayload, formError, formFromPerson, friendlyError,
  firstNameOf, fullName, roleInfo, roleOf, savedMessage, statusOf,
} from './roles';

const canon = (f: PersonForm) => JSON.stringify({ ...f, assigned_sites: [...f.assigned_sites].sort() });

export function PersonPanel({ isDark, person, sites, teams, isSelf, onClose, onSaved }: {
  isDark: boolean; person: Person; sites: SiteOption[]; teams: Team[]; isSelf: boolean;
  onClose: () => void; onSaved: (message: string) => void;
}) {
  const t = useTokens(isDark);
  const control = controlStyle(isDark);
  const initial = useMemo(() => formFromPerson(person), [person]);
  const [form, setForm] = useState<PersonForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const name = firstNameOf(person);
  const dirty = canon(form) !== canon(initial);
  const invalid = formError(form, 'edit');
  const wasViewer = roleOf(person) === 'viewer';
  const info = roleInfo(form.role);
  const st = statusOf(person);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  const ref = useDialogBehavior(requestClose);

  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!dirty || invalid || saving) return;
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

  const joined = person.date_joined ? new Date(person.date_joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return ReactDOM.createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', justifyContent: 'flex-end', background: isDark ? 'rgba(6,8,11,0.6)' : 'rgba(17,24,39,0.4)' }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label={`Access for ${fullName(person)}`}
        style={{
          width: 'min(560px, 100%)', height: '100%', background: t.card, color: t.ink, fontFamily: t.body,
          display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px', borderBottom: `1px solid ${t.line2}` }}>
          <Avatar person={person} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: t.head, fontSize: '1.2rem', fontWeight: 700 }}>{fullName(person)}</h2>
            <div style={{ fontSize: '0.84rem', color: t.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {person.email}{person.team ? ` · ${person.team.name}` : ''}{joined ? ` · Joined ${joined}` : ''}
            </div>
          </div>
          <StatusChip isDark={isDark} state={st.key === 'active' ? 'good' : st.key === 'on_leave' ? 'wait' : 'idle'}>{st.label}</StatusChip>
          <button type="button" aria-label="Close" onClick={requestClose}
            style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <section>
            <h3 style={{ margin: '0 0 4px', fontFamily: t.head, fontSize: '1.02rem' }}>{`What should ${name} be able to do?`}</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: t.ink2 }}>
              {isSelf ? "You can't change your own role." : 'Pick a role. You can change it any time.'}
            </p>
            <RoleCards isDark={isDark} value={form.role} onChange={(role) => set({ role })} disabled={isSelf} />
            {wasViewer && form.role !== 'viewer' && (
              <p style={{ margin: '10px 0 0', fontSize: '0.84rem', color: t.waitInk }}>Their site list will be cleared.</p>
            )}
            {form.role !== 'admin' && (
              <div style={{ marginTop: 12 }}>
                <DeviceOpsSwitch isDark={isDark} checked={form.device_ops_enabled} onChange={(device_ops_enabled) => set({ device_ops_enabled })} />
              </div>
            )}
          </section>

          {form.role === 'viewer' && (
            <section>
              <h3 style={{ margin: '0 0 4px', fontFamily: t.head, fontSize: '1.02rem' }}>{`Which sites can ${name} work on?`}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: t.ink2 }}>They see only these, and their devices.</p>
              <SitePicker isDark={isDark} sites={sites} value={form.assigned_sites} onChange={(assigned_sites) => set({ assigned_sites })} />
            </section>
          )}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 22 }}>
            <div>
              <h3 style={{ margin: '0 0 10px', fontFamily: t.head, fontSize: '0.98rem', color: t.goodInk }}>{`What ${name} can do`}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
                {info.can.map((c) => (
                  <li key={c} style={{ display: 'flex', gap: 9, fontSize: '0.88rem', lineHeight: 1.45 }}>
                    <Check size={16} color={t.good} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ margin: '0 0 10px', fontFamily: t.head, fontSize: '0.98rem', color: t.ink2 }}>{`What ${name} can't do`}</h3>
              {info.cant.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>Nothing is off limits.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
                  {info.cant.map((c) => (
                    <li key={c} style={{ display: 'flex', gap: 9, fontSize: '0.88rem', lineHeight: 1.45, color: t.ink2 }}>
                      <Minus size={16} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <DetailsToggle isDark={isDark} open={showContact} onToggle={() => setShowContact((v) => !v)} label="Contact details" />
            {showContact && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 14 }}>
                <Field isDark={isDark} label="First name"><input style={control} value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
                <Field isDark={isDark} label="Last name"><input style={control} value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
                <Field isDark={isDark} label="Email"><input style={control} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                <Field isDark={isDark} label="Mobile number"><input style={control} type="tel" value={form.mobile_number} onChange={(e) => set({ mobile_number: e.target.value })} /></Field>
                <Field isDark={isDark} label="Team">
                  <select
                    style={control} value={form.team_id ?? ''}
                    onChange={(e) => set({ team_id: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">No team</option>
                    {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </section>
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${t.line2}`, background: t.card2, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(error || (dirty && invalid)) && (
            <div role="alert" style={{ fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>
              {error ?? invalid}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn isDark={isDark} variant="plain" disabled={!dirty || saving} onClick={() => { setForm(initial); setError(null); }}>Discard changes</Btn>
            <Btn isDark={isDark} disabled={!dirty || !!invalid || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Btn>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isDark={isDark} open={confirmDiscard} tone="primary" title="Discard your changes?"
        body={`Your edits to ${name} won't be saved.`} confirmLabel="Discard" cancelLabel="Keep editing"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }} onCancel={() => setConfirmDiscard(false)}
      />
    </div>,
    document.body,
  );
}
