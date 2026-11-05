import React, { useState } from 'react';
import { useTokens, Btn } from '../siteHardware/ui';
import { apiService } from '../../../services/api';
import { FormSection, LinkButton, MobileField, Modal, ReachPicker, RoleList, Row2, SwitchRow, TeamCombo, TextField } from './formParts';
import { PersonForm, RoleKey, SiteOption, Team, buildPayload, formError, friendlyError, mobileDigits, toMobile } from './roles';

/** "Invite a teammate": Who, then Access; the footer says what will happen. */
export function InviteDialog({ isDark, sites, devices, teams, defaultRole = 'employee', onClose, onCreated, onCreateTeam, onCompareRoles }: {
  isDark: boolean; sites: SiteOption[]; devices: SiteOption[]; teams: Team[]; defaultRole?: RoleKey;
  onClose: () => void; onCreated: (firstName: string, email: string) => void;
  onCreateTeam: (name: string) => Promise<Team | null>; onCompareRoles: () => void;
}) {
  const t = useTokens(isDark);
  const [form, setForm] = useState<PersonForm>({
    first_name: '', last_name: '', email: '', mobile_number: '', role: defaultRole, assigned_sites: [], assigned_devices: [], device_ops_enabled: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }));
  const invalid = formError(form, 'create');
  const who = form.first_name.trim() || 'They';
  const nSites = form.assigned_sites.length;
  const nDev = form.assigned_devices?.length ?? 0;
  const reach = [nSites ? `${nSites} site${nSites === 1 ? '' : 's'}` : '', nDev ? `${nDev} device${nDev === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  const summary = form.role === 'viewer' && reach
    ? `${who} gets a welcome email with sign-in details, and will see ${reach}.`
    : `${who} gets a welcome email with sign-in details.`;

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

  return (
    <Modal isDark={isDark} label="Invite a teammate" onClose={onClose}
      header={<h2 style={{ margin: 0, fontFamily: t.head, fontSize: '1.15rem', fontWeight: 700 }}>Invite a teammate</h2>}
      footer={<>
        <span style={{ fontSize: '0.84rem', color: t.ink2, minWidth: 0, flex: '1 1 220px' }}>{invalid ?? summary}</span>
        <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn isDark={isDark} variant="plain" onClick={onClose}>Cancel</Btn>
          <Btn isDark={isDark} disabled={!!invalid || busy} onClick={submit}>{busy ? 'Sending…' : 'Send invite'}</Btn>
        </span>
      </>}>
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <FormSection isDark={isDark} title="Who">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row2>
              <TextField isDark={isDark} label="First name" value={form.first_name} onChange={(first_name) => set({ first_name })} autoFocus />
              <TextField isDark={isDark} label="Last name" value={form.last_name} onChange={(last_name) => set({ last_name })} />
            </Row2>
            <TextField isDark={isDark} label="Work email" type="email" value={form.email} onChange={(email) => set({ email })} hint="The welcome email goes here." />
            <Row2>
              <MobileField isDark={isDark} value={mobileDigits(form.mobile_number)} onChange={(d) => set({ mobile_number: toMobile(d) })} />
              <TeamCombo isDark={isDark} teams={teams} value={form.team_id} onChange={(team_id) => set({ team_id })} onCreate={onCreateTeam} />
            </Row2>
          </div>
        </FormSection>
        <div style={{ height: 1, background: t.line2 }} />
        <FormSection isDark={isDark} title="Access" aside={<LinkButton isDark={isDark} onClick={onCompareRoles}>Compare roles</LinkButton>}>
          <RoleList isDark={isDark} value={form.role} onChange={(role) => set({ role })} />
          {form.role === 'admin' && (
            <p style={{ margin: 0, fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>
              Admins can see billing and customer details.
            </p>
          )}
          {form.role === 'viewer' && (
            <>
              <ReachPicker isDark={isDark} sites={sites} devices={devices}
                siteValue={form.assigned_sites} deviceValue={form.assigned_devices ?? []}
                onSites={(assigned_sites) => set({ assigned_sites })} onDevices={(assigned_devices) => set({ assigned_devices })} />
              <span style={{ fontSize: '0.78rem', color: t.ink2 }}>A site gives every device on it. A single device gives its dashboard and only that device's controls.</span>
            </>
          )}
          {form.role !== 'admin' && (
            <SwitchRow isDark={isDark} checked={form.device_ops_enabled} onChange={(device_ops_enabled) => set({ device_ops_enabled })}
              label={form.role === 'viewer' ? 'Can restart and adjust these devices' : 'Can restart and adjust devices'} />
          )}
        </FormSection>
        {error && <div role="alert" style={{ fontSize: '0.84rem', color: t.waitInk, background: t.waitBg, borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
      </div>
    </Modal>
  );
}
