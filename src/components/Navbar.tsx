import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Settings, Bell, Users, Briefcase,
  Star, Download, ArrowLeft, LogOut, Moon, Sun, X, Menu,
  Server, Building2,
  ChevronDown, User, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import finalLogo from '../assets/finalLogo.png';

// ─── Design tokens ────────────────────────────────────────────────────────────
const tok = {
  bg:          (d: boolean) => d ? '#0B1222'  : '#FFFFFF',
  border:      (d: boolean) => d ? 'rgba(255,255,255,0.08)' : '#e4e7eb',
  text:        (d: boolean) => d ? '#F1F5F9'  : '#1c1e2e',
  muted:       (d: boolean) => d ? '#64748B'  : '#64748B',
  hover:       (d: boolean) => d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  dropdownBg:  (d: boolean) => d ? '#111827'  : '#FFFFFF',
  mobileBg:    (d: boolean) => d ? '#0D1526'  : '#F8FAFC',
};

// ─── Nav definitions ──────────────────────────────────────────────────────────
const iconProps = { size: 15 };

const MAIN_NAV = [
  { path: '/dashboard',      label: 'Dashboard',     icon: <LayoutDashboard {...iconProps} /> },
  { path: '/devices',        label: 'Devices',        icon: <Monitor {...iconProps} /> },
  { path: '/configuration',  label: 'Configuration',  icon: <Settings {...iconProps} /> },
  { path: '/alerts',         label: 'Alerts',         icon: <Bell {...iconProps} /> },
  { path: '/users',          label: 'Users',          icon: <Users {...iconProps} /> },
  { path: '/device-presets', label: 'Device Presets', icon: <Star {...iconProps} /> },
];

const ADMIN_NAV = [
  { path: '/employees', label: 'Employees', icon: <Briefcase {...iconProps} /> },
];

const STAFF_NAV = [
  { path: '/sites', label: 'Sites', icon: <Building2 {...iconProps} /> },
  { path: '/equipment', label: 'Equipment', icon: <Server {...iconProps} /> },
  { path: '/ota', label: 'OTA Updates', icon: <Download {...iconProps} /> },
];

// ─── Bottom nav primary items (always visible on mobile) ────────────────────
const BOTTOM_NAV_PRIMARY = [
  { path: '/dashboard',     label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/devices',       label: 'Devices',   icon: <Monitor size={20} /> },
  { path: '/alerts',        label: 'Alerts',    icon: <Bell size={20} /> },
  { path: '/configuration', label: 'Config',    icon: <Settings size={20} /> },
];

// ─── Main component ───────────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const isStaff = !!(user?.is_staff);
  const { setIsNavigating, navigationHistory } = useNavigation();
  const { isDark, toggleTheme } = useTheme();

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

  const avatarBg = isDark
    ? 'linear-gradient(135deg, #22C55E 0%, #6366F1 100%)'
    : 'linear-gradient(135deg, #16A34A 0%, #4F46E5 100%)';

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
    color: isActive ? '#22C55E' : tok.muted(isDark),
    background: isActive ? (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)') : 'transparent',
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
          background: tok.bg(isDark),
          borderBottom: `1px solid ${tok.border(isDark)}`,
          boxShadow: isDark
            ? '0 1px 0 rgba(255,255,255,0.04)'
            : '0 1px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
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
              boxShadow: '0 3px 12px rgba(34,197,94,0.35)',
              flexShrink: 0,
              overflow: 'visible',
            }}>
              <img src={finalLogo} alt="360watts" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            </div>
            <div className="topnav-brand-text" style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: tok.text(isDark), letterSpacing: '-0.01em' }}>Smart Solar</div>
              <div style={{ fontSize: 11, color: tok.muted(isDark), fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>IoT Platform</div>
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
                      (e.currentTarget as HTMLElement).style.color = tok.text(isDark);
                      (e.currentTarget as HTMLElement).style.background = tok.hover(isDark);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = tok.muted(isDark);
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ color: isActive ? '#22C55E' : 'inherit', display: 'flex' }}>{item.icon}</span>
                  <span className="topnav-link-label">{item.label}</span>
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      bottom: -1,
                      left: 8,
                      right: 8,
                      height: 2,
                      borderRadius: 2,
                      background: '#22C55E',
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right controls ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

            {/* Back button */}
            {navigationHistory.length > 1 && (
              <button
                onClick={handleGoBack}
                title="Go back"
                className="topnav-icon-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8, border: 'none',
                  background: 'transparent', color: tok.muted(isDark), cursor: 'pointer',
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
                background: 'transparent', color: tok.muted(isDark), cursor: 'pointer',
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
                  borderRadius: 9, border: `1px solid ${tok.border(isDark)}`,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: avatarBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  boxShadow: '0 2px 6px rgba(34,197,94,0.2)',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <span className="topnav-username" style={{
                  fontSize: 13, fontWeight: 600, color: tok.text(isDark),
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
                <ChevronDown
                  size={13}
                  style={{
                    color: tok.muted(isDark),
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
                  width: 220,
                  background: tok.dropdownBg(isDark),
                  border: `1px solid ${tok.border(isDark)}`,
                  borderRadius: 12,
                  boxShadow: isDark
                    ? '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                    : '0 16px 40px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  zIndex: 2000,
                }}>
                  {/* User info header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px',
                    borderBottom: `1px solid ${tok.border(isDark)}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: avatarBg, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff',
                      flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tok.text(isDark), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 500 }}>{roleName}</div>
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
                      fontSize: 13, color: tok.text(isDark),
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = tok.hover(isDark))}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={14} style={{ color: tok.muted(isDark) }} />
                    My Profile
                  </Link>

                  <div style={{ height: 1, background: tok.border(isDark), margin: '0 14px' }} />

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', width: '100%',
                      background: 'transparent', border: 'none',
                      fontSize: 13, color: '#EF4444',
                      cursor: 'pointer', transition: 'background 0.12s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
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
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${tok.border(isDark)}`,
                color: tok.text(isDark), cursor: 'pointer',
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
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0,
            zIndex: 1001,
            background: tok.mobileBg(isDark),
            borderTop: `1px solid ${tok.border(isDark)}`,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.2)',
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
                        background: isActive ? (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)') : 'transparent',
                        color: isActive ? '#22C55E' : tok.text(isDark),
                        fontWeight: isActive ? 600 : 450,
                        fontSize: 14,
                        borderLeft: isActive ? '3px solid #22C55E' : '3px solid transparent',
                      }}
                    >
                      <span style={{ color: isActive ? '#22C55E' : tok.muted(isDark), display: 'flex' }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}

              {/* Footer controls */}
              <div style={{
                borderTop: `1px solid ${tok.border(isDark)}`,
                marginTop: 8, paddingTop: 10,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <button
                  onClick={() => { toggleTheme(); setMobileOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    background: 'transparent', border: 'none',
                    color: tok.text(isDark), fontSize: 14, fontWeight: 450,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  {isDark ? <Sun size={15} style={{ color: tok.muted(isDark) }} /> : <Moon size={15} style={{ color: tok.muted(isDark) }} />}
                  {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    textDecoration: 'none',
                    color: tok.text(isDark), fontSize: 14, fontWeight: 450,
                  }}
                >
                  <User size={15} style={{ color: tok.muted(isDark) }} />
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 10, minHeight: 48,
                    background: 'transparent', border: 'none',
                    color: '#EF4444', fontSize: 14, fontWeight: 500,
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
            background: tok.bg(isDark),
            borderTop: `1px solid ${tok.border(isDark)}`,
            boxShadow: isDark
              ? '0 -1px 0 rgba(255,255,255,0.04), 0 -4px 16px rgba(0,0,0,0.3)'
              : '0 -1px 0 #e4e7eb, 0 -4px 16px rgba(0,0,0,0.06)',
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
                  color: isActive ? '#22C55E' : tok.muted(isDark),
                  background: 'transparent',
                  borderTop: `2px solid ${isActive ? '#22C55E' : 'transparent'}`,
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
              borderTop: `2px solid ${mobileOpen ? '#22C55E' : 'transparent'}`,
              color: mobileOpen ? '#22C55E' : tok.muted(isDark),
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
