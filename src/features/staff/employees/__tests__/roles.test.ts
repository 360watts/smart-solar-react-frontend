import {
  ROLES, roleOf, roleInfo, worksOn, statusOf, formError, buildPayload,
  formFromPerson, friendlyError, savedMessage, firstNameOf, Person,
} from '../roles';

const person = (over: Partial<Person> = {}): Person => ({
  id: 1, email: 'meera.iyer@example.com', first_name: 'Meera', last_name: 'Iyer',
  role: 'viewer', assigned_sites: ['s1', 's2', 's3'], is_active: true, ...over,
});

describe('roleOf / roleInfo', () => {
  it('falls back to is_superuser when role is missing', () => {
    expect(roleOf(person({ role: undefined, is_superuser: true }))).toBe('admin');
    expect(roleOf(person({ role: undefined, is_superuser: false }))).toBe('employee');
  });
  it('treats a superuser as admin even when role says otherwise', () => {
    expect(roleOf(person({ role: 'employee', is_superuser: true }))).toBe('admin');
    expect(roleOf(person({ role: 'viewer', is_superuser: false }))).toBe('viewer');
  });
  it('treats an unknown role like the backend does (viewer)', () => {
    expect(roleInfo('intern').key).toBe('viewer');
  });
  it('lists three roles', () => {
    expect(ROLES.map((r) => r.key)).toEqual(['admin', 'employee', 'viewer']);
  });
});

describe('worksOn', () => {
  const names = { s1: 'Coimbatore 02', s2: 'Erode 01', s3: 'Pollachi 03' };
  it('summarises a viewer', () => {
    expect(worksOn(person(), names)).toEqual({ headline: '3 sites', note: 'Coimbatore 02, Erode 01 +1 more' });
  });
  it('handles no sites, one site, admins and employees', () => {
    expect(worksOn(person({ assigned_sites: [] }), names).headline).toBe('No sites yet');
    expect(worksOn(person({ assigned_sites: ['s2'] }), names)).toEqual({ headline: '1 site', note: 'Erode 01' });
    expect(worksOn(person({ role: 'admin' }), names).headline).toBe('Everything');
    expect(worksOn(person({ role: 'employee' }), names).headline).toBe('All sites');
  });
});

describe('statusOf', () => {
  it('maps flags to a calm vocabulary', () => {
    expect(statusOf(person({ is_active: false })).label).toBe('Inactive');
    expect(statusOf(person({ employment_status: 'on_leave' })).label).toBe('On leave');
    expect(statusOf(person()).label).toBe('Active');
  });
});

describe('formError / buildPayload', () => {
  const form = { first_name: 'Meera', last_name: 'Iyer', email: 'Meera@Example.com', mobile_number: '+91 90000 00002', role: 'viewer' as const, assigned_sites: [] as string[], device_ops_enabled: true };
  it('asks a viewer for at least one site', () => {
    expect(formError(form, 'create')).toMatch(/at least one site/i);
    expect(formError({ ...form, assigned_sites: ['s1'] }, 'create')).toBeNull();
  });
  it('requires a mobile number only when creating', () => {
    expect(formError({ ...form, role: 'employee', mobile_number: '' }, 'create')).toMatch(/mobile/i);
    expect(formError({ ...form, role: 'employee', mobile_number: '' }, 'edit')).toBeNull();
  });
  it('sends sites only for viewers', () => {
    expect(buildPayload({ ...form, assigned_sites: ['s1'] }).assigned_sites).toEqual(['s1']);
    const p = buildPayload({ ...form, role: 'employee', assigned_sites: ['s1'] });
    expect(p.assigned_sites).toEqual([]);
  });
  it('keeps the email as typed unless creating (login matches exactly)', () => {
    expect(buildPayload(form).email).toBe('Meera@Example.com');
    expect(buildPayload(form, { lowercaseEmail: true }).email).toBe('meera@example.com');
  });
  it('omits team_id when no team, keeps it when chosen', () => {
    expect('team_id' in buildPayload(form)).toBe(false);
    expect(buildPayload({ ...form, team_id: 4 }).team_id).toBe(4);
  });
  it('sends team_id null only when clearTeam is set and no team is chosen', () => {
    expect(buildPayload(form, { clearTeam: true }).team_id).toBeNull();
    expect(buildPayload({ ...form, team_id: 4 }, { clearTeam: true }).team_id).toBe(4);
  });
  it('carries the address through on edits so the API does not blank it', () => {
    expect(buildPayload(form, { address: '12 Main St' }).address).toBe('12 Main St');
    expect(buildPayload(form, { address: null }).address).toBe('');
  });
});

describe('device operations switch', () => {
  const form = { first_name: 'Meera', last_name: 'Iyer', email: 'm@example.com', mobile_number: '1', role: 'employee' as const, assigned_sites: [] as string[], device_ops_enabled: true };
  it('treats a missing flag as on and reads an explicit off', () => {
    expect(formFromPerson(person()).device_ops_enabled).toBe(true);
    expect(formFromPerson(person({ device_ops_enabled: false })).device_ops_enabled).toBe(false);
  });
  it('sends the flag for employees and viewers, never for admins', () => {
    expect(buildPayload(form).device_ops_enabled).toBe(true);
    expect(buildPayload({ ...form, device_ops_enabled: false }).device_ops_enabled).toBe(false);
    expect(buildPayload({ ...form, role: 'viewer', device_ops_enabled: false }).device_ops_enabled).toBe(false);
    expect('device_ops_enabled' in buildPayload({ ...form, role: 'admin' })).toBe(false);
  });
  it('adds Watch only to the note when off, leaving the headline alone', () => {
    const names = { s1: 'Coimbatore 02' };
    expect(worksOn(person({ role: 'employee', device_ops_enabled: false }), names)).toEqual({ headline: 'All sites', note: 'Monitors and fixes systems. Watch only' });
    expect(worksOn(person({ assigned_sites: ['s1'], device_ops_enabled: false }), names)).toEqual({ headline: '1 site', note: 'Coimbatore 02. Watch only' });
    expect(worksOn(person({ assigned_sites: [], device_ops_enabled: false }), names)).toEqual({ headline: 'No sites yet', note: 'Watch only' });
    expect(worksOn(person({ role: 'admin', device_ops_enabled: false }), names).note).toBe('Including team and billing');
  });
});

describe('formFromPerson / names / savedMessage', () => {
  it('builds a form from a person', () => {
    const f = formFromPerson(person({ team: { id: 3, name: 'Partners' } }));
    expect(f).toMatchObject({ first_name: 'Meera', role: 'viewer', team_id: 3, assigned_sites: ['s1', 's2', 's3'] });
  });
  it('uses the first name, falling back to the email name', () => {
    expect(firstNameOf(person())).toBe('Meera');
    expect(firstNameOf(person({ first_name: '' }))).toBe('meera.iyer');
  });
  it('words the success toast by what changed', () => {
    const before = formFromPerson(person());
    expect(savedMessage(before, { ...before, assigned_sites: ['s1'] }, 'Meera')).toBe('Saved. Meera now sees 1 site.');
    expect(savedMessage(before, { ...before, role: 'admin' }, 'Meera')).toBe('Saved. Meera is now an admin.');
    expect(savedMessage(before, { ...before, first_name: 'Mira' }, 'Meera')).toBe('Saved.');
  });
});

describe('friendlyError', () => {
  const cases: [string, RegExp][] = [
    ['Email already registered. Please use a different email.', /email already has an account/i],
    ['Phone number already registered. Please use a different number.', /number is already used/i],
    ['Cannot demote the last admin', /at least one admin/i],
    ['Unknown site(s): nope', /no longer exists/i],
    ['Your role does not have access to this resource.', /permission/i],
    ['First name is required', /name and email/i],
    ['Team not found', /team is no longer available/i],
    ['Device operations are turned off for your account.', /device operations are turned off.*ask an admin/i],
    ['something odd', /couldn't save that/i],
  ];
  it.each(cases)('maps %s', (msg, expected) => {
    expect(friendlyError(new Error(msg))).toMatch(expected);
  });
});
