import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  Download,
  FileText,
  LayoutDashboard,
  Monitor,
  Server,
  Settings,
  Star,
  User,
  Users,
} from 'lucide-react';
import { matchPath } from 'react-router-dom';
import type { Feature } from '../access/features';

export type StaffDensityMode = 'data-dense' | 'workflow' | 'admin';
export type StaffWorkspaceGroup = 'Monitor' | 'Sales & Quotations' | 'Operations' | 'Admin';

export interface StaffRouteMeta {
  title: string;
  subtitle: string;
  group: StaffWorkspaceGroup;
  density: StaffDensityMode;
  mobileTitle?: string;
  emptyStateLabel?: string;
}

export interface StaffNavItem extends StaffRouteMeta {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Backend feature key that must be in the user's access list; none = always shown. */
  feature?: Feature;
  end?: boolean;
}

export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    path: '/dashboard',
    feature: 'dashboard',
    label: 'Dashboard',
    title: 'Operations Dashboard',
    subtitle: 'Live estate status, health signals, and active site conditions',
    group: 'Monitor',
    density: 'data-dense',
    icon: LayoutDashboard,
    end: true,
  },
  {
    path: '/alerts',
    feature: 'alerts',
    label: 'Alerts',
    title: 'Alerts',
    subtitle: 'Faults, acknowledgements, and active exceptions across sites',
    group: 'Monitor',
    density: 'data-dense',
    icon: Bell,
  },
  {
    path: '/devices',
    feature: 'devices',
    label: 'Devices',
    title: 'Devices',
    subtitle: 'Commissioned devices, status tracking, and field configuration',
    group: 'Monitor',
    density: 'data-dense',
    icon: Monitor,
  },
  {
    path: '/sites',
    feature: 'sites',
    label: 'Sites',
    title: 'Sites',
    subtitle: 'Commissioning progress, performance context, and customer estates',
    group: 'Monitor',
    density: 'data-dense',
    icon: Building2,
  },
  {
    path: '/quotation',
    feature: 'quotations',
    label: 'Quotation',
    title: 'Solar Quotations',
    subtitle: 'Create, share, and manage customer solar proposals',
    group: 'Sales & Quotations',
    density: 'workflow',
    icon: FileText,
  },
  {
    path: '/service-bookings',
    feature: 'bookings',
    label: '360Care Bookings',
    title: '360Care Service Bookings',
    subtitle: 'Assign vendors, schedule visits, and track jobs through completion',
    group: 'Operations',
    density: 'workflow',
    icon: CalendarCheck,
  },
  {
    path: '/configuration',
    feature: 'configuration',
    label: 'Configuration',
    title: 'Configuration',
    subtitle: 'Platform rules, operating defaults, and field behavior settings',
    group: 'Operations',
    density: 'admin',
    icon: Settings,
  },
  {
    path: '/equipment',
    feature: 'catalog',
    label: 'Product Catalog',
    title: 'Product Catalog',
    subtitle: 'Manage solar panels, inverters & batteries catalog',
    group: 'Operations',
    density: 'admin',
    icon: Server,
  },
  {
    path: '/device-presets',
    feature: 'presets',
    label: 'Presets',
    title: 'Device Presets',
    subtitle: 'Reusable provisioning templates and hardware defaults',
    group: 'Operations',
    density: 'admin',
    icon: Star,
  },
  {
    path: '/ota',
    feature: 'ota',
    label: 'OTA',
    title: 'OTA Updates',
    subtitle: 'Firmware rollout history, package status, and update orchestration',
    group: 'Operations',
    density: 'admin',
    icon: Download,
  },
  {
    path: '/users',
    feature: 'users',
    label: 'Users',
    title: 'Users',
    subtitle: 'Customer portal users, device assignments, and account controls',
    group: 'Admin',
    density: 'admin',
    icon: Users,
  },
  {
    path: '/employees',
    feature: 'employees',
    label: 'Employees',
    title: 'Employees',
    subtitle: 'Internal staff records, roster management, and operational ownership',
    group: 'Admin',
    density: 'admin',
    icon: Briefcase,
  },
  {
    path: '/teams',
    feature: 'teams',
    label: 'Teams',
    title: 'Teams',
    subtitle: 'Teams, who is on them, and how the group is organised',
    group: 'Admin',
    density: 'admin',
    icon: Users,
  },
  {
    path: '/my-sites',
    label: 'My sites',
    title: 'My sites',
    subtitle: 'The sites you have been given access to',
    group: 'Monitor',
    density: 'workflow',
    icon: Building2,
    feature: 'my_sites',
  },
  {
    path: '/profile',
    label: 'Profile',
    title: 'Profile',
    subtitle: 'Personal account preferences, access details, and appearance settings',
    group: 'Admin',
    density: 'admin',
    icon: User,
  },
];

const STAFF_ROUTE_MATCHERS: Array<{ pattern: string; meta: StaffRouteMeta }> = [
  {
    pattern: '/my-sites/:siteId',
    meta: {
      title: 'Site',
      subtitle: 'Live performance for one of your sites',
      group: 'Monitor',
      density: 'data-dense',
    },
  },
  {
    pattern: '/sites/onboarding',
    meta: {
      title: 'Site setup',
      subtitle: 'Fill in customer, system and billing details for a site',
      group: 'Monitor',
      density: 'workflow',
    },
  },
  {
    pattern: '/sites/commissioning',
    meta: {
      title: 'Site Commissioning',
      subtitle: 'Activate, configure, and verify new sites with guided controls',
      group: 'Monitor',
      density: 'workflow',
    },
  },
  {
    pattern: '/sites/:siteId',
    meta: {
      title: 'Site Detail',
      subtitle: 'Performance, configuration, and fault context for a selected site',
      group: 'Monitor',
      density: 'data-dense',
    },
  },
];

export const STAFF_WORKSPACE_GROUPS: StaffWorkspaceGroup[] = [
  'Monitor',
  'Sales & Quotations',
  'Operations',
  'Admin',
];

export function getStaffRouteMeta(pathname: string): StaffRouteMeta | undefined {
  const direct = STAFF_NAV_ITEMS.find((item) =>
    item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
  if (direct) return direct;

  const matched = STAFF_ROUTE_MATCHERS.find(({ pattern }) => !!matchPath({ path: pattern, end: true }, pathname));
  return matched?.meta;
}

/** Nav items the person may see: no feature = always, else `can(feature)`. */
export function visibleNavItems<T extends { feature?: Feature }>(
  items: T[],
  can: (feature: Feature) => boolean,
): T[] {
  return items.filter((item) => !item.feature || can(item.feature));
}
