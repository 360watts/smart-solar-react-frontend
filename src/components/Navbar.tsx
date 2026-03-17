import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  Settings,
  Bell,
  Users,
  Briefcase,
  Star,
  Download,
  ArrowLeft,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import finalLogo from '../assets/finalLogo.png';

const iconProps = { size: 18, className: 'sidebar-icon-svg' };

// ─── Design tokens ───────────────────────────────────────────────────────────
const tok = {
  bgSidebar:   (d: boolean) => d ? '#0B1222'  : '#FFFFFF',
  border:      (d: boolean) => d ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
  textPrimary: (d: boolean) => d ? '#F1F5F9'  : '#0F172A',
  textMuted:   (d: boolean) => d ? '#64748B'  : '#94A3B8',
  activeBg:    (d: boolean) => d ? 'rgba(34,197,94,0.12)'  : 'rgba(34,197,94,0.1)',
  hoverBg:     (d: boolean) => d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  userCardBg:  (d: boolean) => d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  footerBg:    (d: boolean) => d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
};

// ─── Nav groups ──────────────────────────────────────────────────────────────
interface NavItem {
  path: string;
  label: string;
  adminOnly: boolean;
  icon: React.ReactNode;
}

const MAIN_NAV: NavItem[] = [
  { path: '/dashboard',     label: 'Dashboard',     adminOnly: false, icon: <LayoutDashboard {...iconProps} /> },
  { path: '/devices',       label: 'Devices',       adminOnly: false, icon: <Monitor {...iconProps} /> },
  { path: '/configuration', label: 'Configuration', adminOnly: false, icon: <Settings {...iconProps} /> },
  { path: '/alerts',        label: 'Alerts',        adminOnly: false, icon: <Bell {...iconProps} /> },
  { path: '/users',         label: 'Users',         adminOnly: false, icon: <Users {...iconProps} /> },
  { path: '/device-presets',label: 'Device Presets',adminOnly: false, icon: <Star {...iconProps} /> },
];

const ADMIN_NAV: NavItem[] = [
  { path: '/employees', label: 'Employees',   adminOnly: true, icon: <Briefcase {...iconProps} /> },
  { path: '/ota',       label: 'OTA Updates', adminOnly: true, icon: <Download {...iconProps} /> },
];

// ─── Tooltip for collapsed icon-only mode ────────────────────────────────────
const NavTooltip: React.FC<{ label: string; isDark: boolean }> = ({ label, isDark }) => (
  <span
    style={{
      position: 'absolute',
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: 12,
      background: isDark ? '#1E293B' : '#0F172A',
      color: '#F1F5F9',
      fontSize: 12,
      fontWeight: 600,
      padding: '5px 10px',
      borderRadius: 7,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 2000,
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }}
  >
    {label}
    <span
      style={{
        position: 'absolute',
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 0,
        height: 0,
        borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent',
        borderRight: `5px solid ${isDark ? '#1E293B' : '#0F172A'}`,
      }}
    />
  </span>
);

// ─── Single nav item ─────────────────────────────────────────────────────────
const NavLink: React.FC<{
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  isDark: boolean;
  onClick: () => void;
}> = ({ item, isActive, isCollapsed, isDark, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      style={{ position: 'relative', listStyle: 'none', margin: '1px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={item.path}
        className="sidebar-link"
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isCollapsed ? 0 : 10,
          padding: isCollapsed ? '11px 0' : '10px 14px',
          borderRadius: 10,
          margin: isCollapsed ? '0 8px' : '0 10px',
          textDecoration: 'none',
          color: isActive ? '#22C55E' : (hovered ? tok.textPrimary(isDark) : tok.textMuted(isDark)),
          background: isActive ? tok.activeBg(isDark) : (hovered ? tok.hoverBg(isDark) : 'transparent'),
          borderLeft: isActive ? '3px solid #22C55E' : '3px solid transparent',
          transition: 'all 0.18s ease',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          position: 'relative',
          fontWeight: isActive ? 600 : 450,
          fontSize: 13.5,
          letterSpacing: '0.01em',
        }}
      >
        <span
          className="sidebar-icon"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? '#22C55E' : (hovered ? tok.textPrimary(isDark) : tok.textMuted(isDark)),
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
        {!isCollapsed && (
          <span className="sidebar-text">{item.label}</span>
        )}
        {isCollapsed && hovered && (
          <NavTooltip label={item.label} isDark={isDark} />
        )}
        {isActive && !isCollapsed && (
          <span
            style={{
              marginLeft: 'auto',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 6px rgba(34,197,94,0.7)',
              flexShrink: 0,
            }}
          />
        )}
      </Link>
    </li>
  );
};

// ─── Section label ───────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string; isDark: boolean; isCollapsed: boolean }> = ({
  label, isDark, isCollapsed,
}) => {
  if (isCollapsed) {
    return (
      <div
        style={{
          margin: '10px 16px 4px',
          height: 1,
          background: tok.border(isDark),
        }}
      />
    );
  }
  return (
    <div
      className="nav-section-label"
      style={{
        padding: '10px 20px 4px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: tok.textMuted(isDark),
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
};

// ─── Footer icon button ───────────────────────────────────────────────────────
const FooterBtn: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isDark: boolean;
  isCollapsed: boolean;
  title?: string;
  danger?: boolean;
}> = ({ onClick, icon, label, isDark, isCollapsed, title, danger }) => {
  const [hovered, setHovered] = useState(false);
  const baseColor = danger ? '#EF4444' : tok.textMuted(isDark);
  const hoverColor = danger ? '#F87171' : tok.textPrimary(isDark);
  const hoverBg = danger ? 'rgba(239,68,68,0.1)' : tok.hoverBg(isDark);
  return (
    <button
      className="logout-button"
      onClick={onClick}
      title={title ?? label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isCollapsed ? 0 : 8,
        width: '100%',
        background: hovered ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: 9,
        padding: isCollapsed ? '10px 0' : '9px 14px',
        cursor: 'pointer',
        color: hovered ? hoverColor : baseColor,
        fontSize: 13,
        fontWeight: 500,
        transition: 'all 0.18s ease',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        position: 'relative',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      {!isCollapsed && <span>{label}</span>}
      {isCollapsed && hovered && (
        <NavTooltip label={label} isDark={isDark} />
      )}
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { setIsNavigating, navigationHistory } = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on tablet (769–1024px); expand back on desktop (>1024px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');
    const handler = (e: MediaQueryList | MediaQueryListEvent) => {
      setIsCollapsed(e.matches);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync body class for layout offset
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [isCollapsed]);

  const handleNavigation = useCallback((path: string) => {
    setIsNavigating(true);
    navigate(path);
    setMobileOpen(false);
  }, [navigate, setIsNavigating]);

  const handleLogout = async () => {
    await logout();
    setIsNavigating(true);
    navigate('/login', { replace: true });
  };

  const handleGoBack = () => {
    if (navigationHistory.length > 1) {
      const prevPath = navigationHistory[navigationHistory.length - 2];
      setIsNavigating(true);
      navigate(prevPath);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(timer);
  }, [location, setIsNavigating]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', mobileOpen);
    return () => { document.body.classList.remove('mobile-nav-open'); };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  if (location.pathname === '/login' || !isAuthenticated) return null;

  const avatarBg = isDark
    ? 'linear-gradient(135deg, #22C55E 0%, #6366F1 100%)'
    : 'linear-gradient(135deg, #16A34A 0%, #4F46E5 100%)';

  const initials = user
    ? `${user.first_name.charAt(0).toUpperCase()}${user.last_name.charAt(0).toUpperCase()}`
    : '??';

  const roleName = user?.is_superuser ? 'Admin' : user?.is_staff ? 'Staff' : 'User';

  return (
    <>
      {/* Hamburger toggle — mobile only */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop overlay — mobile */}
      <div
        className={'sidebar-overlay' + (mobileOpen ? ' open' : '')}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav
        className={`sidebar sidebar-shell${mobileOpen ? ' mobile-open' : ''}${isCollapsed ? ' sidebar--collapsed' : ''}`}
        role="navigation"
        aria-label="Main navigation"
        style={{
          background: tok.bgSidebar(isDark),
          borderRight: `1px solid ${tok.border(isDark)}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: isCollapsed ? 68 : 280,
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 1000,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        {/* ── Header ── */}
        <div
          className="sidebar-header"
          style={{
            padding: isCollapsed ? '18px 8px 14px' : '18px 18px 14px',
            borderBottom: `1px solid ${tok.border(isDark)}`,
            flexShrink: 0,
          }}
        >
          <div
            className="logo-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              marginBottom: isCollapsed ? 0 : -1,
              marginTop: isCollapsed ? 0 : -10,
            }}
          >
            <div
              className="logo-badge"
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'linear-gradient(135deg, #22C55E, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                alignSelf: 'center',
                boxShadow: '0 2px 12px rgba(34,197,94,0.3)',
              }}
            >
              <img
                src={finalLogo}
                alt="360watts"
                style={{ width: 68, height: 68, objectFit: 'contain', display: 'block' }}
              />
            </div>
            {!isCollapsed && (
              <div
                className="logo-text"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    padding: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: tok.textPrimary(isDark),
                    lineHeight: 1.2,
                  }}
                >
                  Smart Solar
                </h2>
                <p
                  className="logo-subtitle"
                  style={{
                    margin: 0,
                    padding: 0,
                    fontSize: 11,
                    color: tok.textMuted(isDark),
                    fontWeight: 400,
                    lineHeight: 1.2,
                  }}
                >
                  IoT Platform
                </p>
              </div>
            )}
          </div>

          {/* User card */}
          {isAuthenticated && user && (
            <Link
              to="/profile"
              className="user-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? 0 : 10,
                textDecoration: 'none',
                padding: isCollapsed ? '8px 0' : '10px 10px',
                borderRadius: 10,
                background: tok.userCardBg(isDark),
                border: `1px solid ${tok.border(isDark)}`,
                transition: 'all 0.18s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                ...(isCollapsed ? {} : {}),
              }}
            >
              <div
                className="user-avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(34,197,94,0.25)',
                }}
              >
                {initials}
              </div>
              {!isCollapsed && (
                <div className="user-details" style={{ overflow: 'hidden', flex: 1 }}>
                  <p
                    className="user-name"
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: tok.textPrimary(isDark),
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.first_name} {user.last_name}
                  </p>
                  <p
                    className="user-role-badge"
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: '#22C55E',
                      fontWeight: 500,
                    }}
                  >
                    {roleName}
                  </p>
                </div>
              )}
            </Link>
          )}
        </div>

        {/* ── Nav items ── */}
        {isAuthenticated && (
          <>
            <ul
              className="sidebar-nav"
              style={{
                flex: 1,
                padding: '10px 0',
                margin: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <SectionLabel label="Main" isDark={isDark} isCollapsed={isCollapsed} />
              {MAIN_NAV.map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  isCollapsed={isCollapsed}
                  isDark={isDark}
                  onClick={() => {
                    if (location.pathname !== item.path) handleNavigation(item.path);
                    setMobileOpen(false);
                  }}
                />
              ))}

              {isAdmin && (
                <>
                  <SectionLabel label="Admin" isDark={isDark} isCollapsed={isCollapsed} />
                  {ADMIN_NAV.map((item) => (
                    <NavLink
                      key={item.path}
                      item={item}
                      isActive={location.pathname === item.path}
                      isCollapsed={isCollapsed}
                      isDark={isDark}
                      onClick={() => {
                        if (location.pathname !== item.path) handleNavigation(item.path);
                        setMobileOpen(false);
                      }}
                    />
                  ))}
                </>
              )}
            </ul>

            {/* ── Footer ── */}
            <div
              className="sidebar-footer"
              style={{
                padding: isCollapsed ? '10px 6px' : '10px 10px',
                borderTop: `1px solid ${tok.border(isDark)}`,
                flexShrink: 0,
                background: tok.footerBg(isDark),
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {/* Theme toggle */}
              <div
                className="theme-toggle-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: isCollapsed ? '10px 0' : '8px 14px',
                  borderRadius: 9,
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  cursor: 'pointer',
                }}
                onClick={toggleTheme}
                title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
              >
                <span
                  className="theme-toggle-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: tok.textMuted(isDark),
                    fontWeight: 500,
                  }}
                >
                  {isDark
                    ? <Moon size={15} className="theme-toggle-icon" />
                    : <Sun size={15} className="theme-toggle-icon" />}
                  {!isCollapsed && (isDark ? 'Dark mode' : 'Light mode')}
                </span>
                {!isCollapsed && (
                  <button
                    className={`theme-switch${isDark ? ' theme-switch--dark' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                    aria-label="Toggle dark mode"
                  >
                    <span className="theme-switch-thumb" />
                  </button>
                )}
              </div>

              {/* Collapse toggle (desktop only) */}
              <FooterBtn
                onClick={() => setIsCollapsed(c => !c)}
                icon={isCollapsed ? <ChevronRight {...iconProps} /> : <ChevronLeft {...iconProps} />}
                label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                isDark={isDark}
                isCollapsed={isCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              />

              {/* Go back */}
              {navigationHistory.length > 1 && (
                <FooterBtn
                  onClick={handleGoBack}
                  icon={<ArrowLeft {...iconProps} />}
                  label="Back"
                  isDark={isDark}
                  isCollapsed={isCollapsed}
                  title="Go back to previous page"
                />
              )}

              {/* Logout */}
              <FooterBtn
                onClick={handleLogout}
                icon={<LogOut {...iconProps} />}
                label="Logout"
                isDark={isDark}
                isCollapsed={isCollapsed}
                danger
              />
            </div>
          </>
        )}

        {!isAuthenticated && (
          <div className="sidebar-auth">
            <Link to="/login" className="auth-link">
              <Users {...iconProps} />
              Login
            </Link>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
