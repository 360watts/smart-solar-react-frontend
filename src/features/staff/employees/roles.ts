/**
 * Role copy and rules for the Employees page.
 *
 * KEEP IN SYNC with smart-solar-django-backend/api/staff_roles.py: that file holds the real
 * access tiers. If a route's tier changes there, update `can` / `cant` here so this page never
 * promises access the backend denies.
 */

export type RoleKey = 'admin' | 'employee' | 'viewer';

export interface RoleInfo {
  key: RoleKey;
  label: string;
  blurb: string;
  can: string[];
  cant: string[];
}

export const ROLES: RoleInfo[] = [
  {
    key: 'admin',
    label: 'Admin',
    blurb: 'Everything, including team, billing and customer details.',
    can: [
      'See and change everything, including billing and customer details',
      'Add, change and remove teammates',
      'Run any device on any site',
    ],
    cant: [],
  },
  {
    key: 'employee',
    label: 'Employee',
    blurb: 'Monitor and fix systems, help customers. No billing or team settings.',
    can: [
      'Watch live power, alerts and equipment on every site',
      'Restart or adjust any device',
      'Handle support tickets and service visits (customer names and contact details stay hidden)',
      'Send firmware updates to devices',
    ],
    cant: [
      'Open the Firmware updates page',
      'See bills, savings or quotations',
      'See customer contact details or Wi-Fi passwords',
      "Change team settings or other people's roles",
      'Remove devices for good',
    ],
  },
  {
    key: 'viewer',
    label: 'Viewer',
    blurb: 'See and run devices on chosen sites only.',
    can: [
      'Watch live power, alerts and equipment on their sites',
      'Restart or adjust devices on those sites',
      'Check battery and appliance settings',
    ],
    cant: [
      'See customer names, phone numbers or bills',
      "Open any site that wasn't picked",
      "Change team settings or other people's roles",
    ],
  },
];

/** Unknown roles are treated as viewer, the same as the backend (fail closed). */
export function roleInfo(key?: string): RoleInfo {
  return ROLES.find((r) => r.key === key) ?? ROLES[2];
}

export interface Team { id: number; name: string }

/** The Compare roles table. KEEP IN SYNC with staff_roles.py, like `can` / `cant` above. */
export const ROLE_MATRIX: { what: string; admin: string; employee: string; viewer: string }[] = [
  { what: 'Sites', admin: 'All', employee: 'All', viewer: 'Picked only' },
  { what: 'Live power and alerts', admin: 'Yes', employee: 'Yes', viewer: 'Yes' },
  { what: 'Restart or adjust devices', admin: 'Yes', employee: 'If switched on', viewer: 'If switched on' },
  { what: 'Send firmware updates', admin: 'Yes', employee: 'Yes', viewer: 'Own devices, if switched on' },
  { what: 'Firmware updates page', admin: 'Yes', employee: 'No', viewer: 'No' },
  { what: 'Bills, savings, quotations', admin: 'Yes', employee: 'No', viewer: 'No' },
  { what: 'Customer contact details', admin: 'Yes', employee: 'No', viewer: 'No' },
  { what: 'Manage the team', admin: 'Yes', employee: 'No', viewer: 'No' },
];

export type Employment = 'active' | 'on_leave' | 'terminated';
export const EMPLOYMENT_LABEL: Record<Employment, string> = { active: 'Working', on_leave: 'On leave', terminated: 'Left' };

/** The 10 local digits of an Indian mobile number however it was stored ("+91-98400 12345" -> "9840012345"). */
export function mobileDigits(raw?: string | null): string {
  const d = (raw ?? '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
}
/** What the forms send: "+91" and the 10 digits; empty stays empty. */
export const toMobile = (digits: string) => (digits ? `+91${digits}` : '');
export const mobileError = (digits: string) => (digits && digits.length !== 10 ? 'Enter all 10 digits' : null);

export interface Person {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string | null;
  address?: string | null;
  role?: string;
  is_superuser?: boolean;
  is_active?: boolean;
  employment_status?: 'active' | 'on_leave' | 'terminated';
  assigned_sites?: string[];
  assigned_devices?: number[];
  team?: Team | null;
  date_joined?: string;
  last_login?: string | null;
  /** Missing counts as on. Always true for admins. */
  device_ops_enabled?: boolean;
}

export interface SiteOption { site_id: string; display_name: string }

export function roleOf(p: Person): RoleKey {
  if (p.is_superuser) return 'admin';
  if (p.role === 'admin' || p.role === 'employee' || p.role === 'viewer') return p.role;
  return 'employee';
}

export function firstNameOf(p: Pick<Person, 'first_name' | 'email'>): string {
  return p.first_name?.trim() || p.email.split('@')[0];
}

export function fullName(p: Pick<Person, 'first_name' | 'last_name' | 'email'>): string {
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email;
}

export function initialsOf(p: Pick<Person, 'first_name' | 'last_name' | 'email'>): string {
  const a = (p.first_name?.trim()[0] ?? '') + (p.last_name?.trim()[0] ?? '');
  return (a || p.email.slice(0, 2)).toUpperCase();
}

export type StatusKey = 'active' | 'on_leave' | 'inactive';
/** Sign-in on/off is `is_active`; employment (On leave / Left) is a tag beside it, never the same thing. */
export function statusOf(p: Person): { key: StatusKey; label: string } {
  if (p.is_active === false) return { key: 'inactive', label: "Can't sign in" };
  if (p.employment_status === 'on_leave') return { key: 'on_leave', label: 'On leave' };
  return { key: 'active', label: 'Can sign in' };
}
/** "On leave" / "Left", or null when working. */
export const employmentTag = (p: Person): string | null =>
  p.employment_status && p.employment_status !== 'active' ? EMPLOYMENT_LABEL[p.employment_status] : null;

/** "Just now", "3 h ago", "Yesterday", "5 days ago", then a date; null = "Not yet recorded". */
export function relativeTime(iso?: string | null, now = Date.now()): string {
  if (!iso) return 'Not yet recorded';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface PersonForm {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  team_id?: number;
  role: RoleKey;
  assigned_sites: string[];
  /** Device ids as strings (the picker's value type). */
  assigned_devices?: string[];
  device_ops_enabled: boolean;
  /** Edit only. Left also turns sign-in off (owner decision 2026-11-05). */
  employment_status?: Employment;
  is_active?: boolean;
}

export function formFromPerson(p: Person): PersonForm {
  return {
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    email: p.email ?? '',
    mobile_number: p.mobile_number ?? '',
    team_id: p.team?.id,
    role: roleOf(p),
    assigned_sites: [...(p.assigned_sites ?? [])],
    assigned_devices: (p.assigned_devices ?? []).map(String),
    device_ops_enabled: p.device_ops_enabled !== false,
    employment_status: p.employment_status ?? 'active',
    is_active: p.is_active !== false,
  };
}

/** A plain-language reason the form can't be saved yet, or null. */
export function formError(f: PersonForm, mode: 'create' | 'edit'): string | null {
  if (!f.first_name.trim() || !f.last_name.trim()) return 'Add a first and last name.';
  if (!f.email.trim()) return 'Add an email address.';
  if (mode === 'create' && !f.mobile_number.trim()) return 'Add a mobile number.';
  if (mode === 'create' && mobileError(mobileDigits(f.mobile_number))) return 'Enter all 10 digits of the mobile number.';
  if (f.role === 'viewer' && f.assigned_sites.length === 0 && !f.assigned_devices?.length) {
    return `Pick at least one site or device, or ${f.first_name.trim() || 'they'} won't see anything.`;
  }
  return null;
}

/**
 * `team_id` is sent when a team is chosen. With no team it is omitted (backend keeps the current
 * team: create, sign-in toggle) unless `clearTeam` is set, which sends `null` to remove the team.
 */
export function buildPayload(
  f: PersonForm,
  extra: { address?: string | null; is_active?: boolean; clearTeam?: boolean; lowercaseEmail?: boolean } = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    // Lowercase only when creating: login matches the stored email exactly, so edits keep it as is.
    email: extra.lowercaseEmail ? f.email.trim().toLowerCase() : f.email.trim(),
    mobile_number: f.mobile_number.trim(),
    role: f.role,
    assigned_sites: f.role === 'viewer' ? f.assigned_sites : [],
    assigned_devices: f.role === 'viewer' ? (f.assigned_devices ?? []).map(Number) : [],
  };
  // Admins always have device operations; the backend ignores the key for them, so don't send it.
  if (f.role !== 'admin') payload.device_ops_enabled = f.device_ops_enabled;
  if (f.employment_status) payload.employment_status = f.employment_status;
  if (f.is_active !== undefined) payload.is_active = f.is_active;
  if (f.team_id != null) payload.team_id = f.team_id;
  else if (extra.clearTeam) payload.team_id = null;
  // The update endpoint blanks `address` when it is missing, so edits always carry it through.
  if (extra.address !== undefined) payload.address = extra.address ?? '';
  if (extra.is_active !== undefined) payload.is_active = extra.is_active;
  return payload;
}

export function savedMessage(before: PersonForm, after: PersonForm, name: string): string {
  const sameSites = JSON.stringify([...before.assigned_sites].sort()) === JSON.stringify([...after.assigned_sites].sort());
  if (before.role === after.role && (after.role !== 'viewer' || sameSites)) return 'Saved.';
  if (after.role === 'viewer') {
    const n = after.assigned_sites.length;
    return `Saved. ${name} now sees ${n} site${n === 1 ? '' : 's'}.`;
  }
  return `Saved. ${name} is now ${after.role === 'admin' ? 'an admin' : 'an employee'}.`;
}

const GENERIC = "Couldn't save that. Check the details and try again.";

/** Backend messages become plain sentences. Raw strings are never shown. */
export function friendlyError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (msg.includes('email already registered') || msg.includes('email already in use')) return 'That email already has an account.';
  if (msg.includes('phone number already')) return 'That number is already used by someone on the team.';
  if (msg.includes('last admin')) return 'You need at least one admin. Make someone else an admin first.';
  if (msg.includes('cannot demote a superuser')) return "You can't change your own role.";
  if (msg.includes('unknown site')) return 'One of those sites no longer exists. Refresh and pick again.';
  if (msg.includes('does not have access')) return "You don't have permission to do that.";
  if (msg.includes('team not found')) return 'That team is no longer available. Pick another team or choose No team.';
  if (msg.includes('device operations are turned off')) return 'Device operations are turned off for your account. Ask an admin.';
  if (msg.includes('is required')) return 'A name and email are needed first. Open Edit access to add them.';
  return GENERIC;
}
