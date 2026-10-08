import { useAuth } from '../../contexts/AuthContext';
import { Feature, LEGACY_ADMIN_ONLY } from './features';

export function useAccess() {
  const { user, isAdmin, isStaff } = useAuth();
  const isViewer = user?.role === 'viewer';
  const can = (feature: Feature): boolean => {
    if (!user || !isStaff) return false;
    if (user.access) return user.access.includes(feature);
    if (feature === 'my_sites') return false;               // legacy backend has no viewers
    if (isViewer) return false;                             // a viewer with no access list gets nothing (fail closed)
    return isAdmin || !LEGACY_ADMIN_ONLY.includes(feature);
  };
  const home = can('dashboard') ? '/dashboard' : can('my_sites') ? '/my-sites' : '/profile';
  return { can, isViewer, home };
}
