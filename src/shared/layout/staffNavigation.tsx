import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Briefcase,
  Building2,
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
  staffOnly?: boolean;
  adminOnly?: boolean;
  end?: boolean;
}

export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    path: '/dashboard',
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
    label: 'Alerts',
    title: 'Alerts',
    subtitle: 'Faults, acknowledgements, and active exceptions across sites',
    group: 'Monitor',
    density: 'data-dense',
    icon: Bell,
  },
  {
    path: '/devices',
    label: 'Devices',
    title: 'Devices',
    subtitle: 'Commissioned devices, status tracking, and field configuration',
    group: 'Monitor',
    density: 'data-dense',
    icon: Monitor,
  },
  {
    path: '/sites',
    label: 'Sites',
    title: 'Sites',
    subtitle: 'Commissioning progress, performance context, and customer estates',
    group: 'Monitor',
    density: 'data-dense',
    icon: Building2,
  },
  {
    path: '/quotation',
    label: 'Quotation',
    title: 'Solar Quotations',
    subtitle: 'Create, share, and manage customer solar proposals',
    group: 'Sales & Quotations',
    density: 'workflow',
    icon: FileText,
  },
  {
    path: '/configuration',
    label: 'Configuration',
    title: 'Configuration',
    subtitle: 'Platform rules, operating defaults, and field behavior settings',
    group: 'Operations',
    density: 'admin',
    icon: Settings,
  },
  {
    path: '/equipment',
    label: 'Product Catalog',
    title: 'Product Catalog',
    subtitle: 'Manage solar panels, inverters & batteries catalog',
    group: 'Operations',
    density: 'admin',
    icon: Server,
  },
  {
    path: '/device-presets',
    label: 'Presets',
    title: 'Device Presets',
    subtitle: 'Reusable provisioning templates and hardware defaults',
    group: 'Operations',
    density: 'admin',
    icon: Star,
  },
  {
    path: '/ota',
    label: 'OTA',
    title: 'OTA Updates',
    subtitle: 'Firmware rollout history, package status, and update orchestration',
    group: 'Operations',
    density: 'admin',
    icon: Download,
    adminOnly: true,
  },
  {
    path: '/users',
    label: 'Users',
    title: 'Users',
    subtitle: 'Customer portal users, device assignments, and account controls',
    group: 'Admin',
    density: 'admin',
    icon: Users,
  },
  {
    path: '/employees',
    label: 'Employees',
    title: 'Employees',
    subtitle: 'Internal staff records, roster management, and operational ownership',
    group: 'Admin',
    density: 'admin',
    icon: Briefcase,
    adminOnly: true,
  },
  {
    path: '/departments',
    label: 'Departments',
    title: 'Departments',
    subtitle: 'Department structures, staffing visibility, and organizational setup',
    group: 'Admin',
    density: 'admin',
    icon: Users,
    adminOnly: true,
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

