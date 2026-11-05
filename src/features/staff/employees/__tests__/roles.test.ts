import {
  ROLES, roleOf, roleInfo, statusOf, formError, buildPayload, employmentTag, mobileDigits, toMobile, mobileError, relativeTime,
  formFromPerson, friendlyError, savedMessage, firstNameOf, Person, ROLE_MATRIX,
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

describe('statusOf', () => {
  it('maps flags to a calm vocabulary', () => {
    expect(statusOf(person({ is_active: false })).label).toBe("Can't sign in");
    expect(statusOf(person({ employment_status: 'on_leave' })).label).toBe('On leave');
    expect(statusOf(person()).label).toBe('Can sign in');
  });
  it('keeps sign-in and employment apart: Left but still allowed in reads "Can sign in" with a Left tag', () => {
    const left = person({ employment_status: 'terminated' });
    expect(statusOf(left).key).toBe('active');
    expect(employmentTag(left)).toBe('Left');
    expect(employmentTag(person())).toBeNull();
  });
});

describe('mobile helpers', () => {
  it('reads the 10 digits however the number was stored', () => {
    expect(mobileDigits('+91-98400 12345')).toBe('9840012345');
    expect(mobileDigits('9840012345')).toBe('9840012345');
    expect(mobileDigits(null)).toBe('');
  });
  it('sends +91 and the digits, and checks for 10 digits', () => {
    expect(toMobile('9840012345')).toBe('+919840012345');
    expect(toMobile('')).toBe('');
    expect(mobileError('98400')).toBe('Enter all 10 digits');
    expect(mobileError('9840012345')).toBeNull();
    expect(mobileError('')).toBeNull();
  });
  it('blocks an invite with a short mobile number', () => {
    const f = { first_name: 'A', last_name: 'B', email: 'a@b.in', mobile_number: '+9198400', role: 'employee' as const, assigned_sites: [] as string[], device_ops_enabled: true };
    expect(formError(f, 'create')).toBe('Enter all 10 digits of the mobile number.');
    expect(formError({ ...f, mobile_number: '+919840012345' }, 'create')).toBeNull();
  });
});

describe('employment and sign-in in the payload', () => {
  it('reads both from the person and sends them on edit', () => {
    const f = formFromPerson(person({ employment_status: 'on_leave', is_active: false }));
    expect(f.employment_status).toBe('on_leave');
    expect(f.is_active).toBe(false);
    const body = buildPayload(f);
    expect(body.employment_status).toBe('on_leave');
    expect(body.is_active).toBe(false);
  });
  it('lets the sign-in toggle override the form', () => {
    expect(buildPayload(formFromPerson(person()), { is_active: false }).is_active).toBe(false);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  it('words last sign-in plainly', () => {
    expect(relativeTime(null, now)).toBe('Not yet recorded');
    expect(relativeTime('2026-11-05T11:59:30Z', now)).toBe('Just now');
    expect(relativeTime('2026-11-05T11:20:00Z', now)).toBe('40 min ago');
    expect(relativeTime('2026-11-05T09:00:00Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-11-04T10:00:00Z', now)).toBe('Yesterday');
    expect(relativeTime('2026-10-30T12:00:00Z', now)).toBe('6 days ago');
  });
});

describe('Compare roles table', () => {
  it('matches the backend: the Firmware updates page is admin only, sending updates is not', () => {
    const page = ROLE_MATRIX.find((r) => r.what === 'Firmware updates page')!;
    expect([page.admin, page.employee, page.viewer]).toEqual(['Yes', 'No', 'No']);
    expect(ROLE_MATRIX.find((r) => r.what === 'Send firmware updates')!.employee).toBe('Yes');
    expect(roleInfo('employee').cant).toContain('Open the Firmware updates page');
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
