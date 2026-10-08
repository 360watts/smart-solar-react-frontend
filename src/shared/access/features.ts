/** Feature keys the backend returns in `user.access` (api/staff_roles.py FEATURES). Keep in sync. */
export type Feature =
  | 'dashboard' | 'sites' | 'alerts' | 'devices' | 'bookings' | 'support' | 'configuration' | 'presets'
  | 'catalog' | 'quotations' | 'users' | 'employees' | 'teams' | 'ai_chat' | 'site_billing' | 'destructive'
  | 'ota' | 'analytics' | 'site_credentials' | 'site_monitoring' | 'device_control' | 'my_sites';

/** Used only when the backend does not send `access` (older deploy): today's behaviour. */
export const LEGACY_ADMIN_ONLY: Feature[] = [
  'employees', 'teams', 'ota', 'analytics', 'users', 'quotations', 'catalog', 'ai_chat',
  'site_billing', 'destructive', 'site_credentials',
];
