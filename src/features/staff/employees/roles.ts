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
      'Push firmware updates',
    ],
    cant: [
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
  team?: Team | null;
  date_joined?: string;
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

export function worksOn(p: Person, siteNames: Record<string, string>): { headline: string; note: string } {
  const role = roleOf(p);
  if (role === 'admin') return { headline: 'Everything', note: 'Including team and billing' };
  const watchOnly = (note: string) => (p.device_ops_enabled === false ? (note ? `${note}. Watch only` : 'Watch only') : note);
  if (role === 'employee') return { headline: 'All sites', note: watchOnly('Monitors and fixes systems') };
  const ids = p.assigned_sites ?? [];
  const names = ids.map((id) => siteNames[id] ?? id);
  const headline = ids.length === 0 ? 'No sites yet' : ids.length === 1 ? '1 site' : `${ids.length} sites`;
  const note = names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2} more` : '');
  return { headline, note: watchOnly(note) };
}

export type StatusKey = 'active' | 'on_leave' | 'inactive';
export function statusOf(p: Person): { key: StatusKey; label: string } {
  if (p.is_active === false || p.employment_status === 'terminated') return { key: 'inactive', label: 'Inactive' };
  if (p.employment_status === 'on_leave') return { key: 'on_leave', label: 'On leave' };
  return { key: 'active', label: 'Active' };
}

export interface PersonForm {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  team_id?: number;
  role: RoleKey;
  assigned_sites: string[];
  device_ops_enabled: boolean;
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
    device_ops_enabled: p.device_ops_enabled !== false,
  };
}

/** A plain-language reason the form can't be saved yet, or null. */
export function formError(f: PersonForm, mode: 'create' | 'edit'): string | null {
  if (!f.first_name.trim() || !f.last_name.trim()) return 'Add a first and last name.';
  if (!f.email.trim()) return 'Add an email address.';
  if (mode === 'create' && !f.mobile_number.trim()) return 'Add a mobile number.';
  if (f.role === 'viewer' && f.assigned_sites.length === 0) {
    return `Pick at least one site, or ${f.first_name.trim() || 'they'} won't see anything.`;
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
  };
  // Admins always have device operations; the backend ignores the key for them, so don't send it.
  if (f.role !== 'admin') payload.device_ops_enabled = f.device_ops_enabled;
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
