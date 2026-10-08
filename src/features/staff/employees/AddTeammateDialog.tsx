import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useTokens, Btn, Field, controlStyle } from '../siteHardware/ui';
import { apiService } from '../../../services/api';
import { useDialogBehavior } from './useDialogBehavior';
import { RoleCards } from './RoleCards';
import { SitePicker } from './SitePicker';
import { PersonForm, RoleKey, SiteOption, Team, buildPayload, formError, friendlyError } from './roles';

export function AddTeammateDialog({ isDark, sites, teams, defaultRole = 'employee', onClose, onCreated, onTeamAdded }: {
  isDark: boolean; sites: SiteOption[]; teams: Team[]; defaultRole?: RoleKey;
  onClose: () => void; onCreated: (firstName: string, email: string) => void; onTeamAdded: (team: Team) => void;
}) {
  const t = useTokens(isDark);
  const control = controlStyle(isDark);
  const ref = useDialogBehavior(onClose);
  const [form, setForm] = useState<PersonForm>({
    first_name: '', last_name: '', email: '', mobile_number: '', role: defaultRole, assigned_sites: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamName, setTeamName] = useState('');

  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }));
  const invalid = formError(form, 'create');
  const who = form.first_name.trim() || 'They';

  const submit = async () => {
    if (invalid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.createEmployee(buildPayload(form, { lowercaseEmail: true }));
      onCreated(form.first_name.trim(), form.email.trim().toLowerCase());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const addTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    try {
      const created = await apiService.createTeam({ name });
      const team = { id: created.id, name: created.name } as Team;
      onTeamAdded(team);
      set({ team_id: team.id });
      setAddingTeam(false);
      setTeamName('');
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const summary = form.role === 'viewer'
    ? `${who} will see ${form.assigned_sites.length} site${form.assigned_sites.length === 1 ? '' : 's'} and nothing else.`
    : form.role === 'admin' ? `${who} will have full access.` : `${who} can monitor and fix every site.`;

  return ReactDOM.createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', background: isDark ? 'rgba(6,8,11,0.66)' : 'rgba(17,24,39,0.5)', overflowY: 'auto' }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="add-teammate-title"
        style={{ width: 'min(680px, 100%)', background: t.card, color: t.ink, fontFamily: t.body, borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '22px 24px 8px' }}>
          <div>
            <h2 id="add-teammate-title" style={{ margin: '0 0 4px', fontFamily: t.head, fontSize: '1.3rem', fontWeight: 700 }}>Add a teammate</h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>We'll email them a sign-in. They can use it right away.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 8px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field isDark={isDark} label="First name"><input style={control} value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} autoComplete="off" /></Field>
            <Field isDark={isDark} label="Last name"><input style={control} value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} autoComplete="off" /></Field>
            <Field isDark={isDark} label="Email"><input style={control} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" /></Field>
            <Field isDark={isDark} label="Mobile number"><input style={control} type="tel" value={form.mobile_number} onChange={(e) => set({ mobile_number: e.target.value })} autoComplete="off" /></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field isDark={isDark} label="Team">
                <select style={control} value={form.team_id ?? ''} onChange={(e) => set({ team_id: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">No team</option>
                  {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
              </Field>
              {addingTeam ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
                  <label style={{ flex: '1 1 200px' }}>
                    <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>New team name</span>
                    <input style={control} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                  </label>
                  <Btn isDark={isDark} variant="soft" onClick={addTeam}>Add team</Btn>
                  <Btn isDark={isDark} variant="plain" onClick={() => setAddingTeam(false)}>Cancel</Btn>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingTeam(true)}
                  style={{ marginTop: 8, background: 'none', border: 0, padding: 0, minHeight: 32, color: t.goodInk, fontFamily: t.body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Add a team
                </button>
              )}
            </div>
          </div>

          <section>
            <h3 style={{ margin: '0 0 10px', fontFamily: t.head, fontSize: '1.02rem' }}>What can they do?</h3>
            <RoleCards isDark={isDark} value={form.role} onChange={(role) => set({ role })} />
            {form.role === 'admin' && (
              <p style={{ margin: '10px 0 0', fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>
                Admins can see billing and customer details.
              </p>
            )}
          </section>

          {form.role === 'viewer' && (
            <section style={{ padding: 16, borderRadius: 16, background: t.card2, border: `1px solid ${t.line}` }}>
              <h3 style={{ margin: '0 0 4px', fontFamily: t.head, fontSize: '1rem' }}>{`Which sites can ${who === 'They' ? 'they' : who} work on?`}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: t.ink2 }}>Viewers see only the sites you pick.</p>
              <SitePicker isDark={isDark} sites={sites} value={form.assigned_sites} onChange={(assigned_sites) => set({ assigned_sites })} />
            </section>
          )}
        </div>

        <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${t.line2}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div role="alert" style={{ fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: '0.84rem', color: t.ink2 }}>{invalid ?? summary}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn isDark={isDark} variant="plain" onClick={onClose}>Cancel</Btn>
              <Btn isDark={isDark} disabled={!!invalid || busy} onClick={submit}>{busy ? 'Sending…' : 'Send invite'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
