import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Settings, Bell, Users, Briefcase,
  Star, Download, ArrowLeft, LogOut, Moon, Sun, X, Menu,
  Server, Building2, FileText,
  ChevronDown, User, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';
import { getDesignTokens } from '../theme';

// ─── Design tokens ────────────────────────────────────────────────────────────
const getNavbarTokens = (isDark: boolean) => {
  const tokens = getDesignTokens(isDark);
  return {
    ...tokens,
    bg: tokens.surface,
    hover: tokens.surfaceMuted,
    dropdownBg: tokens.surfaceRaised,
    mobileBg: tokens.surfaceRaised,
    avatarBg: `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.secondary} 100%)`,
  };
};

// ─── Nav definitions ──────────────────────────────────────────────────────────
const iconProps = { size: 15 };

// Customer-visible tabs (dashboard only)
const MAIN_NAV = [
  { path: '/dashboard',      label: 'Dashboard',     icon: <LayoutDashboard {...iconProps} /> },
];

// Staff-only tabs
const STAFF_CONFIG_NAV = [
  { path: '/devices',        label: 'Devices',        icon: <Monitor {...iconProps} /> },
  { path: '/alerts',         label: 'Alerts',         icon: <Bell {...iconProps} /> },
  { path: '/configuration',  label: 'Configuration',  icon: <Settings {...iconProps} /> },
  { path: '/users',          label: 'Users',          icon: <Users {...iconProps} /> },
  { path: '/device-presets', label: 'Device Presets', icon: <Star {...iconProps} /> },
];

const ADMIN_NAV = [
  { path: '/employees', label: 'Employees', icon: <Briefcase {...iconProps} /> },
  { path: '/departments', label: 'Departments', icon: <Users {...iconProps} /> },
];

const STAFF_NAV = [
  { path: '/sites', label: 'Sites', icon: <Building2 {...iconProps} /> },
  { path: '/equipment', label: 'Equipment', icon: <Server {...iconProps} /> },
  { path: '/quotation', label: 'Quotation', icon: <FileText {...iconProps} /> },
  { path: '/ota', label: 'OTA Updates', icon: <Download {...iconProps} /> },
];

// ─── Bottom nav primary items (always visible on mobile) ────────────────────
// Customers see: Dashboard only
const BOTTOM_NAV_PRIMARY = [
  { path: '/dashboard',     label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
];

// ─── Main component ───────────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const isStaff = !!(user?.is_staff);
  const { setIsNavigating, navigationHistory } = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const tok = getNavbarTokens(isDark);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [isTouch, setIsTouch] = useState(() => window.matchMedia('(hover: none)').matches);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const tq = window.matchMedia('(hover: none)');
    const onMq = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onTq = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', onMq);
    tq.addEventListener('change', onTq);
    return () => { mq.removeEventListener('change', onMq); tq.removeEventListener('change', onTq); };
  }, []);

  const allNavItems = [
    ...MAIN_NAV,
    ...(isAdmin ? ADMIN_NAV : []),
    ...((isAdmin || isStaff) ? STAFF_CONFIG_NAV : []),
    ...((isAdmin || isStaff) ? STAFF_NAV : []),
  ];

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setUserMenuOpen(false); }, [location.pathname]);

  // Body scroll lock when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Escape key closes menus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileOpen(false); setUserMenuOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNavigation = useCallback((path: string) => {
    setIsNavigating(true);
    navigate(path);
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [navigate, setIsNavigating]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
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

  if (location.pathname === '/login' || !isAuthenticated) return null;

  const avatarBg = tok.avatarBg;

  const initials = user
    ? `${(user.first_name || '').charAt(0).toUpperCase()}${(user.last_name || '').charAt(0).toUpperCase()}` || user.username.substring(0, 2).toUpperCase()
    : '??';

  const roleName = user?.is_superuser ? 'Admin' : user?.is_staff ? 'Staff' : 'User';
  const displayName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '';

  const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: isActive ? 600 : 450,
    color: isActive ? tok.primary : tok.textMuted,
    background: isActive ? tok.primarySoft : 'transparent',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    position: 'relative',
  });

  return (
    <>
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header
        className="topnav"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 1000,
          background: tok.bg,
          borderBottom: `1px solid ${tok.border}`,
          boxShadow: isDark ? 'none' : tok.shadow,
          display: 'flex',
          alignItems: 'center',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '0 16px',
          gap: 8,
          maxWidth: '100%',
        }}>

          {/* ── Brand / Logo ── */}
          <Link
            to="/dashboard"
            onClick={() => { if (location.pathname !== '/dashboard') handleNavigation('/dashboard'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textDecoration: 'none',
              flexShrink: 0,
              marginRight: 8,
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: tok.shadow,
              flexShrink: 0,
              overflow: 'visible',
            }}>
              <img src={finalLogo} alt="360watts" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            </div>
            <div className="topnav-brand-text" style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: tok.text, letterSpacing: '-0.01em' }}>360Watts</div>
              <div style={{ fontSize: 11, color: tok.textMuted, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>IoT Platform</div>
            </div>
          </Link>

          {/* ── Nav links — desktop ── */}
          <nav
            className="topnav-links"
            aria-label="Main navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flex: 1,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {allNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { if (!isActive) handleNavigation(item.path); }}
                  style={navLinkStyle(isActive)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = tok.text;
                      (e.currentTarget as HTMLElement).style.background = tok.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = tok.textMuted;
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ color: isActive ? tok.primary : 'inherit', display: 'flex' }}>{item.icon}</span>
                  <span className="topnav-link-label">{item.label}</span>
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      bottom: -1,
                      left: 8,
                      right: 8,
                      height: 2,
                      borderRadius: 2,
                      background: tok.primary,
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right controls ── */}
          <div className="topnav-right" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

            {/* Back button */}
            {navigationHistory.length > 1 && (
              <button
                onClick={handleGoBack}
                title="Go back"
                className="topnav-icon-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8, border: 'none',
                  background: 'transparent', color: tok.textMuted, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowLeft size={15} />
              </button>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
              className="topnav-icon-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8, border: 'none',
                background: 'transparent', color: tok.textMuted, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* User avatar + dropdown */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                aria-expanded={userMenuOpen}
                className="topnav-user-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px 5px 5px',
                  borderRadius: 9, border: `1px solid ${tok.border}`,
                  background: tok.surfaceMuted,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: avatarBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: tok.textInverse,
                  boxShadow: tok.shadow,
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <span className="topnav-username" style={{
                  fontSize: 13, fontWeight: 600, color: tok.text,
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
                <ChevronDown
                  size={13}
                  style={{
                    color: tok.textMuted,
                    transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 'min(220px, calc(100vw - 32px))',
                  background: tok.dropdownBg,
                  border: `1px solid ${tok.border}`,
                  borderRadius: 12,
                  boxShadow: tok.shadow,
                  overflow: 'hidden',
                  zIndex: 2000,
                }}>
                  {/* User info header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px',
                    borderBottom: `1px solid ${tok.border}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: avatarBg, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: tok.textInverse,
                      flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tok.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: tok.primary, fontWeight: 500 }}>{roleName}</div>
                    </div>
                  </div>

                  {/* Profile link */}
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      textDecoration: 'none',
                      fontSize: 13, color: tok.text,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = tok.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={14} style={{ color: tok.textMuted }} />
                    My Profile
                  </Link>

                  <div style={{ height: 1, background: tok.border, margin: '0 14px' }} />

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', width: '100%',
                      background: 'transparent', border: 'none',
                      fontSize: 13, color: tok.danger,
                      cursor: 'pointer', transition: 'background 0.12s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = tok.dangerSoft)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="topnav-hamburger"
              style={{
                display: 'none', // shown via CSS at ≤900px
                alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 8,
                background: tok.surfaceMuted,
                border: `1px solid ${tok.border}`,
                color: tok.text, cursor: 'pointer',
              }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile overlay + slide-down "More" menu ───────────────────── */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(18,21,26,0.36)', backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0,
            zIndex: 1001,
            background: tok.mobileBg,
            borderTop: `1px solid ${tok.border}`,
            boxShadow: tok.shadow,
            overflowY: 'auto',
            maxHeight: 'calc(100dvh - 128px)',
            borderRadius: '16px 16px 0 0',
          }}>
            <div style={{ padding: '10px 12px' }}>
              {/* Overflow nav items not in bottom bar */}
              {allNavItems
                .filter(item => !BOTTOM_NAV_PRIMARY.some(p => p.path === item.path))
                .map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => { if (!isActive) handleNavigation(item.path); setMobileOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '13px 14px', borderRadius: 10,
                        textDecoration: 'none', marginBottom: 2,
                        minHeight: 48,
                        background: isActive ? tok.primarySoft : 'transparent',
                        color: isActive ? tok.primary : tok.text,
                        fontWeight: isActive ? 600 : 450,
                        fontSize: 14,
                        borderLeft: isActive ? `3px solid ${tok.primary}` : '3px solid transparent',
                      }}
                    >
                      <span style={{ color: isActive ? tok.primary : tok.textMuted, display: 'flex' }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}

              {/* Footer controls */}
              <div style={{
                borderTop: `1px solid ${tok.border}`,
                marginTop: 8, paddingTop: 10,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <button
                  onClick={() => { toggleTheme(); setMobileOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    background: 'transparent', border: 'none',
                    color: tok.text, fontSize: 14, fontWeight: 450,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  {isDark ? <Sun size={15} style={{ color: tok.textMuted }} /> : <Moon size={15} style={{ color: tok.textMuted }} />}
                  {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    textDecoration: 'none',
                    color: tok.text, fontSize: 14, fontWeight: 450,
                  }}
                >
                  <User size={15} style={{ color: tok.textMuted }} />
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    background: 'transparent', border: 'none',
                    color: tok.danger, fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Navigation Bar — mobile only (≤900px) ──────────────── */}
      {isMobile && (
        <nav
          aria-label="Mobile navigation"
          style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            height: 64,
            zIndex: 998,
            background: tok.bg,
            borderTop: `1px solid ${tok.border}`,
            boxShadow: isDark ? 'none' : tok.shadow,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {BOTTOM_NAV_PRIMARY.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { setMobileOpen(false); if (!isActive) handleNavigation(item.path); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  textDecoration: 'none',
                  color: isActive ? tok.primary : tok.textMuted,
                  background: 'transparent',
                  borderTop: `2px solid ${isActive ? tok.primary : 'transparent'}`,
                  transition: 'color 0.15s',
                  minWidth: 48,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {item.icon}
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            aria-label="More navigation options"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              borderTop: `2px solid ${mobileOpen ? tok.primary : 'transparent'}`,
              color: mobileOpen ? tok.primary : tok.textMuted,
              cursor: 'pointer',
              minWidth: 48,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <MoreHorizontal size={20} />
            <span style={{ fontSize: 10, fontWeight: mobileOpen ? 700 : 500, letterSpacing: '0.02em' }}>More</span>
          </button>
        </nav>
      )}
    </>
  );
};

export default Navbar;
