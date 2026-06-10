import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Settings, Bell, Users, Briefcase,
  Star, Download, Building2, Server, FileText, User,
  LogOut, Sun, Moon, Menu, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';
import { getDesignTokens } from '../theme';

// ─── Nav groups ───────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const NAV_CONFIG = [
  { path: '/devices',        label: 'Devices',       icon: Monitor  },
  { path: '/alerts',         label: 'Alerts',         icon: Bell     },
  { path: '/configuration',  label: 'Configuration',  icon: Settings },
  { path: '/users',          label: 'Users',          icon: Users    },
  { path: '/device-presets', label: 'Device Presets', icon: Star     },
];

const NAV_STAFF = [
  { path: '/sites',      label: 'Sites',      icon: Building2 },
  { path: '/equipment',  label: 'Equipment',  icon: Server    },
  { path: '/quotation',  label: 'Quotation',  icon: FileText  },
  { path: '/ota',        label: 'OTA Updates', icon: Download },
];

const NAV_ADMIN = [
  { path: '/employees', label: 'Employees', icon: Briefcase },
];

// ─── Staff layout styles (injected once) ─────────────────────────────────────

const STAFF_STYLES = `
  @keyframes staff-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  .staff-fade-in { animation: staff-fade-in 0.3s ease both; }

  .staff-nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 9px;
    text-decoration: none;
    font-size: 13px;
    font-family: var(--font-body);
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    transition: all 0.15s ease;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }
  .staff-nav-link:hover { color: inherit; }
  .staff-nav-link.active {
    color: var(--primary);
    background: var(--green-soft);
    font-weight: 600;
  }
  .staff-nav-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: transparent;
    margin-left: auto;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .staff-nav-link.active .staff-nav-dot {
    background: var(--primary);
    box-shadow: 0 0 8px var(--green-soft);
  }

  /* Light mode overrides */
  body:not(.dark-mode) .staff-nav-link { color: var(--muted-foreground); }
  body:not(.dark-mode) .staff-nav-link:hover { color: inherit; }
  body:not(.dark-mode) .staff-nav-link.active { color: var(--primary); background: var(--green-soft); }
  body:not(.dark-mode) .staff-nav-link.active .staff-nav-dot { background: var(--primary); box-shadow: 0 0 6px var(--green-soft); }

  .staff-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; border-radius: 9px; border: none;
    background: transparent; cursor: pointer; font-size: 13px;
    font-family: var(--font-body); font-weight: 500;
    transition: all 0.15s ease; width: 100%; text-align: left;
    color: var(--muted-foreground);
  }
  .staff-btn:hover { background: var(--green-soft); color: var(--foreground); }
  .staff-btn.danger { color: var(--destructive); }
  .staff-btn.danger:hover { background: rgba(239,68,68,0.10); color: var(--destructive); }

  body:not(.dark-mode) .staff-btn { color: var(--muted-foreground); }
  body:not(.dark-mode) .staff-btn:hover { background: var(--green-soft); color: var(--foreground); }

  @media (max-width: 1023px) {
    .staff-desktop-sidebar { display: none !important; }
    .staff-main { margin-left: 0 !important; width: 100% !important; padding: 20px 16px 80px !important; }
    .staff-mobile-topbar { display: flex !important; }
  }
  /* Mobile pages manage all their own padding — zero out layout padding so it doesn't stack */
  @media (max-width: 768px) {
    .staff-main { padding: 0 !important; }
  }
`;

function injectStaffStyles() {
  if (document.getElementById('staff-layout-styles')) return;
  const el = document.createElement('style');
  el.id = 'staff-layout-styles';
  el.textContent = STAFF_STYLES;
  document.head.appendChild(el);
}

// ─── Nav group label ──────────────────────────────────────────────────────────

const GroupLabel: React.FC<{ label: string; muted: string }> = ({ label, muted }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: muted,
    padding: '8px 12px 4px',
  }}>
    {label}
  </div>
);

// ─── Sidebar content ──────────────────────────────────────────────────────────

const SidebarContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const expandedActionsRef = React.useRef<HTMLDivElement>(null);
  const tokens = getDesignTokens(isDark);

  React.useEffect(() => {
    if (profileOpen && expandedActionsRef.current) {
      expandedActionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [profileOpen]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  };

  const isStaff = !!(user?.is_staff);
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
    || user?.username?.[0]?.toUpperCase() || '?';
  const displayName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user?.username : '';
  const roleName = user?.is_superuser ? 'Admin' : user?.is_staff ? 'Staff' : 'User';

  const sideBg = isDark
    ? `linear-gradient(180deg, ${tokens.surface} 0%, ${tokens.pageBg} 100%)`
    : `linear-gradient(180deg, ${tokens.surface} 0%, ${tokens.pageBg} 100%)`;
  const sideBorder = tokens.border;
  const sideText   = tokens.text;
  const sideMuted  = tokens.textMuted;
  const userBg     = tokens.primarySoft;
  const userBorder = tokens.border;

  const isActivePath = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div style={{
      width: 'min(232px, 90vw)', height: '100%',
      background: sideBg,
      borderRight: `1px solid ${sideBorder}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Fira Sans', 'DM Sans', sans-serif",
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: `1px solid ${tokens.border}`,
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: tokens.shadow,
          overflow: 'visible',
        }}>
          <img src={finalLogo} alt="360watts" style={{ width: 56, height: 56, objectFit: 'contain' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: sideText, letterSpacing: '-0.01em' }}>
            360Watts
          </div>
          <div style={{ fontSize: 10, color: sideMuted, marginTop: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            IoT Platform
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: 4, borderRadius: 6, border: 'none', background: 'transparent', color: sideMuted, cursor: 'pointer', flexShrink: 0 }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>

        {/* Main */}
        {NAV_MAIN.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end
            onClick={onClose}
            className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
          >
            <Icon size={14} strokeWidth={isActivePath(path) ? 2.2 : 1.8} />
            {label}
            <span className="staff-nav-dot" />
          </NavLink>
        ))}

        {/* Config */}
        {(isAdmin || isStaff) && (
          <>
            <GroupLabel label="Configuration" muted={sideMuted} />
            {NAV_CONFIG.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={14} strokeWidth={isActivePath(path) ? 2.2 : 1.8} />
                {label}
                <span className="staff-nav-dot" />
              </NavLink>
            ))}
          </>
        )}

        {/* Staff operations */}
        {(isAdmin || isStaff) && (
          <>
            <GroupLabel label="Operations" muted={sideMuted} />
            {NAV_STAFF.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={14} strokeWidth={isActivePath(path) ? 2.2 : 1.8} />
                {label}
                <span className="staff-nav-dot" />
              </NavLink>
            ))}
          </>
        )}

        {/* Admin */}
        {isAdmin && (
          <>
            <GroupLabel label="Admin" muted={sideMuted} />
            {NAV_ADMIN.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={14} strokeWidth={isActivePath(path) ? 2.2 : 1.8} />
                {label}
                <span className="staff-nav-dot" />
              </NavLink>
            ))}
          </>
        )}
      </nav>


      {/* User block — sticky bottom so it stays visible when nav scrolls */}
      <div style={{ padding: '12px 10px 16px', flexShrink: 0, position: 'sticky', bottom: 0, background: sideBg, borderTop: `1px solid ${sideBorder}` }}>
        <button
          onClick={() => setProfileOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 10, border: `1px solid ${userBorder}`,
            background: userBg, cursor: 'pointer', width: '100%', textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.secondary} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: tokens.textInverse,
            boxShadow: tokens.shadow,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: sideText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: tokens.primary, fontWeight: 500 }}>{roleName}</div>
          </div>
          <ChevronDown
            size={12}
            style={{ color: sideMuted, transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
          />
        </button>

        {/* Expanded actions */}
        {profileOpen && (
          <div ref={expandedActionsRef} style={{
            marginTop: 6, background: tokens.surfaceMuted,
            borderRadius: 10, border: `1px solid ${tokens.border}`,
            padding: '4px 4px',
          }}>
            <NavLink
              to="/profile"
              onClick={onClose}
              className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
              style={{ fontSize: 12 }}
            >
              <User size={13} />
              My Profile
            </NavLink>
            <button className="staff-btn" onClick={toggleTheme} style={{ fontSize: 12 }}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="staff-btn danger" onClick={handleLogout} style={{ fontSize: 12 }}>
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main layout ──────────────────────────────────────────────────────────────

const StaffLayout: React.FC = () => {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { injectStaffStyles(); }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Allow child pages (e.g. MobileDashboard) to open the sidebar via custom event
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener('open-mobile-menu', handler);
    return () => window.removeEventListener('open-mobile-menu', handler);
  }, []);

  return (
    <div style={{ background: tokens.pageBg, minHeight: '100vh', width: '100%', fontFamily: "var(--font-body)" }}>

      {/* Mobile topbar — suppressed on all pages since each page has its own branded header */}
      {false && (
        <header
          className="staff-mobile-topbar"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: tokens.surface,
            borderBottom: `1px solid ${tokens.border}`,
            position: 'sticky', top: 0, zIndex: 40,
            boxShadow: isDark ? 'none' : tokens.shadow,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: tokens.text }}>
            360Watts
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              padding: 8, borderRadius: 8, border: 'none',
              background: tokens.primarySoft,
              color: tokens.primary, cursor: 'pointer',
            }}
          >
            <Menu size={18} />
          </button>
        </header>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(18,21,26,0.46)', zIndex: 45, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 30 }} className="staff-desktop-sidebar">
        <SidebarContent />
      </div>

      {/* Main content */}
      <main
        className="staff-main"
        style={{
          marginLeft: 232,
          width: 'calc(100% - 232px)',
          padding: '32px 32px',
          minHeight: '100vh',
          boxSizing: 'border-box',
          overflowX: 'clip',
          color: tokens.text,
          fontFamily: "var(--font-body)",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;
