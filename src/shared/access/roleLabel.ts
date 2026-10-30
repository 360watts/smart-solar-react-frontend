const NAMES: Record<string, string> = { admin: 'Administrator', employee: 'Employee', viewer: 'Viewer' };

/** What to call a signed-in person. Employees and viewers both have is_staff, so the role decides; the flags are only the fallback for an older server. */
export function roleLabel(role?: string | null, isSuperuser?: boolean, isStaff?: boolean): string {
  if (isSuperuser) return NAMES.admin;
  return NAMES[String(role ?? '').toLowerCase()] ?? (isStaff ? 'Staff Member' : 'User');
}
