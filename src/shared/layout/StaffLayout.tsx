import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Settings, Bell, Users, Briefcase,
  Star, Download, Building2, Server, FileText, User,
  LogOut, Sun, Moon, X, ChevronDown, ChevronsLeft, ChevronsRight,
  Zap, CalendarCheck, MessageCircle, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../access/useAccess';
import type { Feature } from '../access/features';
import { visibleNavItems } from './staffNavigation';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';

// ─── Nav groups ───────────────────────────────────────────────────────────────

type NavEntry = { path: string; label: string; icon: React.ElementType; feature: Feature };

const NAV_MAIN: NavEntry[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { path: '/my-sites',  label: 'My sites',  icon: Building2,       feature: 'my_sites'  },
];

const NAV_CONFIG: NavEntry[] = [
  { path: '/devices',        label: 'Devices',       icon: Monitor,  feature: 'devices'       },
  { path: '/alerts',         label: 'Alerts',         icon: Bell,     feature: 'alerts'        },
  { path: '/configuration',  label: 'Configuration',  icon: Settings, feature: 'configuration' },
  { path: '/users',          label: 'Users',          icon: Users,    feature: 'users'         },
  { path: '/device-presets', label: 'Device Presets', icon: Star,     feature: 'presets'       },
];

const NAV_STAFF: NavEntry[] = [
  { path: '/sites',            label: 'Sites',            icon: Building2,      feature: 'sites'    },
  { path: '/equipment',        label: 'Product Catalog',  icon: Server,         feature: 'catalog'  },
  { path: '/quotation',        label: 'Quotation',        icon: FileText,       feature: 'quotations' },
  { path: '/service-bookings', label: '360Care Bookings', icon: CalendarCheck,  feature: 'bookings' },
  { path: '/support-inbox',    label: 'Support Inbox',    icon: MessageCircle,  feature: 'support'  },
  { path: '/ota',              label: 'OTA Updates',      icon: Download,       feature: 'ota'      },
];

const NAV_ADMIN: NavEntry[] = [
  { path: '/employees', label: 'Employees', icon: Briefcase,  feature: 'employees' },
  { path: '/teams',     label: 'Teams',     icon: Users,      feature: 'teams'     },
  { path: '/analytics', label: 'Analytics', icon: TrendingUp, feature: 'analytics' },
];

const STAFF_SIDEBAR_EXPANDED  = 236;
const STAFF_SIDEBAR_COLLAPSED = 76;   // the slim icon rail (dashboard mockup); the default on desktop

// ─── Grain texture (Control Deck aesthetic) ───────────────────────────────────

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`;

// ─── Injected styles ──────────────────────────────────────────────────────────

const STAFF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');

  @keyframes staff-fade-in {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0);    }
  }
  @keyframes staff-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  .staff-fade-in { animation: staff-fade-in 0.3s ease both; }

  /* ── Nav links ─── */
  .staff-nav-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 11px;
    border-radius: 9px;
    text-decoration: none;
    font-size: 13px;
    font-family: 'Rubik', sans-serif;
    font-weight: 500;
    color: #a8c4e0;
    background: transparent;
    transition: color 0.15s ease, background 0.15s ease;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    letter-spacing: 0.01em;
    outline: none;
  }
  .staff-nav-link::before {
    content: '';
    position: absolute;
    left: 0; top: 20%; bottom: 20%;
    width: 2.5px;
    border-radius: 2px;
    background: #0F9F8F;
    opacity: 0;
    transform: scaleY(0.4);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  .staff-nav-link:hover {
    color: #dbeeff;
    background: color-mix(in srgb, var(--brand-green) 10%, transparent);
  }
  .staff-nav-link.active {
    color: #0F9F8F;
    background: color-mix(in srgb, var(--brand-green) 11%, transparent);
    font-weight: 600;
  }
  .staff-nav-link.active::before {
    opacity: 1;
    transform: scaleY(1);
  }

  /* Light mode */
  body:not(.dark-mode) .staff-nav-link { color: rgba(51,65,85,0.75); }
  body:not(.dark-mode) .staff-nav-link:hover { color: var(--foreground); background: color-mix(in srgb, var(--brand-green) 8%, transparent); }
  body:not(.dark-mode) .staff-nav-link.active { color: #0F9F8F; background: color-mix(in srgb, var(--brand-green) 10%, transparent); }
  body:not(.dark-mode) .staff-nav-link.active::before { background: #0F9F8F; }

  /* Icon accent */
  .staff-nav-link.active .staff-nav-icon { color: #0F9F8F; }
  body:not(.dark-mode) .staff-nav-link.active .staff-nav-icon { color: #0F9F8F; }

  /* Nav dot */
  .staff-nav-dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: transparent;
    margin-left: auto;
    flex-shrink: 0;
    transition: all 0.18s ease;
  }
  .staff-nav-link.active .staff-nav-dot {
    background: #0F9F8F;
    box-shadow: 0 0 6px color-mix(in srgb, var(--brand-green) 75%, transparent);
  }
  body:not(.dark-mode) .staff-nav-link.active .staff-nav-dot {
    background: #0F9F8F;
    box-shadow: 0 0 6px color-mix(in srgb, var(--brand-green) 70%, transparent);
  }

  /* ── Staff btn ─── */
  .staff-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 11px; border-radius: 9px; border: none;
    background: transparent; cursor: pointer; font-size: 13px;
    font-family: 'Rubik', sans-serif; font-weight: 500;
    transition: color 0.15s ease, background 0.15s ease;
    width: 100%; text-align: left;
    color: #a8c4e0;
    outline: none;
    letter-spacing: 0.01em;
  }
  .staff-btn:hover {
    color: #dbeeff;
    background: color-mix(in srgb, var(--brand-green) 10%, transparent);
  }
  .staff-btn.danger { color: #fc8fa0; }
  .staff-btn.danger:hover {
    background: rgba(239,68,68,0.12);
    color: #ff9dac;
  }
  body:not(.dark-mode) .staff-btn { color: rgba(51,65,85,0.75); }
  body:not(.dark-mode) .staff-btn:hover { background: color-mix(in srgb, var(--brand-green) 8%, transparent); color: var(--foreground); }
  body:not(.dark-mode) .staff-btn.danger { color: #dc2626; }
  body:not(.dark-mode) .staff-btn.danger:hover { background: rgba(239,68,68,0.08); color: #b91c1c; }

  /* ── Group label ─── */
  .staff-group-label {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--brand-green) 85%, transparent);
    padding: 10px 11px 3px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }
  .staff-group-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--brand-green) 25%, transparent);
    min-width: 8px;
  }
  body:not(.dark-mode) .staff-group-label { color: color-mix(in srgb, var(--brand-green) 70%, transparent); }
  body:not(.dark-mode) .staff-group-label::after { background: color-mix(in srgb, var(--brand-green) 18%, transparent); }

  /* ── Action panel ─── */
  .staff-action-panel {
    margin-top: 6px;
    border-radius: 10px;
    padding: 4px;
    animation: staff-slide-down 0.18s ease both;
  }

  /* ── Slim icon rail (desktop default): 44px icon buttons, active = primary tint ─── */
  .staff-rail-btn {
    position: relative;
    width: 40px; height: 40px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px; border: none; background: transparent;
    color: var(--muted-foreground); cursor: pointer; text-decoration: none;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .staff-rail-btn:hover { background: var(--surface-muted); color: var(--foreground); }
  .staff-rail-btn.active { background: var(--primary-soft); color: var(--primary); }
  .staff-rail-btn.active::before { content: ''; position: absolute; left: -18px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--primary); }
  .staff-rail-btn:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

  .staff-rail-scroll { scrollbar-width: none; }
  .staff-rail-scroll::-webkit-scrollbar { display: none; }

  .staff-rail-logo { position: relative; }
  .staff-rail-logo .staff-rail-logo-chev { position: absolute; opacity: 0; color: var(--primary); transition: opacity 0.15s ease; }
  .staff-rail-logo:hover, .staff-rail-logo:focus-visible { background: var(--primary-soft) !important; opacity: 1; }
  .staff-rail-logo:hover .staff-rail-logo-img, .staff-rail-logo:focus-visible .staff-rail-logo-img { opacity: 0; }
  .staff-rail-logo:hover .staff-rail-logo-chev, .staff-rail-logo:focus-visible .staff-rail-logo-chev { opacity: 1; }
  .staff-rail-logo:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

  /* ── Logo toggle button ─── */
  .staff-logo-btn {
    display: flex; align-items: center;
    background: none; border: none;
    cursor: pointer; padding: 0; outline: none;
    -webkit-tap-highlight-color: transparent;
    border-radius: 10px;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }
  .staff-logo-btn:hover { opacity: 0.8; }

  /* ── Responsive ─── */
  @media (max-width: 900px) {
    .staff-desktop-sidebar { display: none !important; }
    .staff-main { margin-left: 0 !important; width: 100% !important; }
  }
  @media (max-width: 768px) {
    .staff-main { padding: 0 !important; }
  }
  @media (min-width: 901px) {
    .staff-main { padding: clamp(16px, 2.5vw, 36px) clamp(16px, 2.8vw, 40px) !important; }
  }
`;

function injectStaffStyles() {
  if (document.getElementById('staff-layout-styles')) return;
  const el = document.createElement('style');
  el.id = 'staff-layout-styles';
  el.textContent = STAFF_STYLES;
  document.head.appendChild(el);
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  onClose,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const { can } = useAccess();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const expandedActionsRef = React.useRef<HTMLDivElement>(null);

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

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';
  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user?.username
    : '';
  const roleName = user?.is_superuser ? 'Admin' : user?.is_staff ? 'Staff' : 'User';

  const isDrawer = !!onClose;
  const showCollapsed = collapsed && !isDrawer;

  // Colours
  const sideBg     = 'var(--card)';
  const sideBorder  = 'var(--border)';
  const accent      = 'var(--brand-green)';
  const avatarGrad  = isDark
    ? 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-dark) 100%)'
    : 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-dark) 100%)';

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  // ── Slim icon rail (desktop default, dashboard mockup): logo tile, 44px icon buttons grouped as in the
  // full sidebar with the same can() gating; labels are aria-label + title tooltip. The logo tile expands it.
  if (showCollapsed) {
    const tipProps = (label: string) => ({
      onMouseEnter: (e: React.SyntheticEvent<HTMLElement>) => setTip({ label, y: e.currentTarget.getBoundingClientRect().top + 22 }),
      onFocus: (e: React.SyntheticEvent<HTMLElement>) => setTip({ label, y: e.currentTarget.getBoundingClientRect().top + 22 }),
      onMouseLeave: () => setTip(null),
      onBlur: () => setTip(null),
    });
    const railLink = ({ path, label, icon: Icon }: { path: string; label: string; icon: React.ElementType }) => (
      <NavLink
        key={path}
        to={path}
        end={path === '/sites'}   // else Sites stays highlighted on /sites/onboarding
        {...tipProps(label)}
        aria-label={label}
        className={({ isActive }) => `staff-rail-btn${isActive ? ' active' : ''}`}
      >
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </NavLink>
    );
    const groups = [NAV_MAIN, NAV_CONFIG, NAV_STAFF, NAV_ADMIN]
      .map(items => visibleNavItems(items, can))
      .filter(items => items.length > 0);
    return (
      <>
      {tip && (
        <div role="tooltip" style={{
          position: 'fixed', left: STAFF_SIDEBAR_COLLAPSED + 8, top: tip.y, transform: 'translateY(-50%)', zIndex: 60,
          padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none',
          background: 'var(--foreground)', color: 'var(--background)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}>{tip.label}</div>
      )}
      <div style={{ position: 'relative', width: STAFF_SIDEBAR_COLLAPSED, height: '100%' }}>
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 0',
        background: sideBg, borderRight: `1px solid ${sideBorder}`,
        overflow: 'hidden',
      }}>
        <button
          className="staff-logo-btn staff-rail-logo"
          onClick={onToggleCollapse}
          aria-label="Expand menu"
          {...tipProps('Expand menu')}
          style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', background: 'var(--surface-muted)', marginBottom: 6, flexShrink: 0 }}
        >
          <img className="staff-rail-logo-img" src={finalLogo} alt="360watts" style={{ width: 30, height: 30, objectFit: 'contain', display: 'block' }} />
          <ChevronsRight className="staff-rail-logo-chev" size={20} aria-hidden="true" />
        </button>
        <nav aria-label="Main" className="staff-rail-scroll" style={{ flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {groups.map((items, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div aria-hidden="true" style={{ width: 28, height: 1, background: 'var(--border)', margin: '4px 0', flexShrink: 0 }} />}
              {items.map(railLink)}
            </React.Fragment>
          ))}
        </nav>
        <div style={{ width: 28, height: 1, background: 'var(--border)', margin: '2px 0', flexShrink: 0 }} aria-hidden="true" />
        <button type="button" className="staff-rail-btn" onClick={toggleTheme}
          aria-label={isDark ? 'Light mode' : 'Dark mode'} {...tipProps(isDark ? 'Light mode' : 'Dark mode')}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <NavLink to="/profile" aria-label="My Profile" {...tipProps('My Profile')}
          className={({ isActive }) => `staff-rail-btn${isActive ? ' active' : ''}`}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%', background: avatarGrad, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Rubik', sans-serif", fontSize: 12, fontWeight: 600,
          }}>{initials}</span>
        </NavLink>
        <button type="button" className="staff-rail-btn" onClick={handleLogout} aria-label="Sign out" {...tipProps('Sign out')}>
          <LogOut size={20} />
        </button>
      </div>
      </div>
      </>
    );
  }

  // ── Brand / header ──
  const brandSection = (
    <div style={{
      padding: showCollapsed ? '14px 0' : '16px 14px 14px',
      borderBottom: `1px solid ${sideBorder}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
      justifyContent: showCollapsed ? 'center' : undefined,
      minHeight: 68,
    }}>
      {/* Logo — doubles as collapse/expand toggle on desktop */}
      <button
        className="staff-logo-btn"
        onClick={onToggleCollapse ?? onClose}
        title={showCollapsed ? 'Expand menu' : 'Collapse menu'}
        aria-label={showCollapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <img
          src={finalLogo}
          alt="360watts"
          style={{ width: 44, height: 44, objectFit: 'contain', display: 'block' }}
        />
      </button>

      {/* Brand text (hidden when collapsed) */}
      {!showCollapsed && (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: "'Rubik', sans-serif",
            fontWeight: 700, fontSize: 14,
            color: 'var(--foreground)',
            letterSpacing: '-0.01em',
          }}>
            360Watts
          </div>
          <div style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 12, color: accent, marginTop: 1,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            IoT Platform
          </div>
        </div>
      )}

      {/* Collapse arrow (expanded state only, not in drawer) */}
      {!showCollapsed && !isDrawer && (
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          style={{
            marginLeft: 'auto',
            padding: '8px', borderRadius: 8,
            border: `1px solid ${sideBorder}`,
            background: isDark ? 'color-mix(in srgb, var(--brand-green) 7%, transparent)' : 'color-mix(in srgb, var(--brand-green) 6%, transparent)',
            color: 'var(--primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            transition: 'all 0.15s ease', flexShrink: 0, outline: 'none',
          }}
        >
          <ChevronsLeft size={16} strokeWidth={2} />
        </button>
      )}

      {/* Close (drawer only) */}
      {isDrawer && (
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto', padding: 5, borderRadius: 7, border: 'none',
            background: isDark ? 'color-mix(in srgb, var(--brand-green) 8%, transparent)' : 'rgba(0,0,0,0.05)',
            color: 'var(--primary)',
            cursor: 'pointer', flexShrink: 0, display: 'flex', outline: 'none',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  // ── Nav link factory ──
  const navLink = ({ path, label, icon: Icon }: { path: string; label: string; icon: React.ElementType }) => (
    <NavLink
      key={path}
      to={path}
      end={path === '/sites'}   // else Sites stays highlighted on /sites/onboarding
      onClick={onClose}
      title={label}
      className={({ isActive }) =>
        `staff-nav-link${isActive ? ' active' : ''}${showCollapsed ? ' staff-nav-icon-only' : ''}`
      }
    >
      <Icon
        size={18}
        strokeWidth={isActivePath(path) ? 2.3 : 1.8}
        className="staff-nav-icon"
        style={{ flexShrink: 0, transition: 'color 0.15s ease' }}
      />
      {!showCollapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span className="staff-nav-dot" />
        </>
      )}
    </NavLink>
  );

  return (
    <div style={{
      width: isDrawer ? 'min(236px, 90vw)' : (showCollapsed ? STAFF_SIDEBAR_COLLAPSED : STAFF_SIDEBAR_EXPANDED),
      height: '100%',
      backgroundColor: sideBg,
      backgroundImage: GRAIN_SVG,
      borderRight: `1px solid ${sideBorder}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>

      {brandSection}

      {/* Nav — always rendered; collapsed = icons only */}
      <nav style={{
        flex: 1,
        padding: showCollapsed ? '10px 6px' : '10px 8px',
        display: 'flex', flexDirection: 'column', gap: 1,
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        {visibleNavItems(NAV_MAIN, can).map(item => navLink(item))}

        {([
          ['Config', NAV_CONFIG],
          ['Operations', NAV_STAFF],
          ['Admin', NAV_ADMIN],
        ] as const).map(([label, items]) => {
          const shown = visibleNavItems(items, can);
          if (shown.length === 0) return null;
          return (
            <React.Fragment key={label}>
              {showCollapsed
                ? <div style={{ height: 1, background: sideBorder, margin: '6px 6px' }} />
                : <div className="staff-group-label">{label}</div>
              }
              {shown.map(item => navLink(item))}
            </React.Fragment>
          );
        })}
      </nav>

      {/* User block — avatar icon when collapsed, full card when expanded */}
      {showCollapsed && (
        <div style={{
          padding: '8px 6px 14px', flexShrink: 0,
          position: 'sticky', bottom: 0,
          backgroundColor: sideBg, backgroundImage: GRAIN_SVG,
          borderTop: `1px solid ${sideBorder}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="staff-nav-link staff-nav-icon-only"
            style={{ padding: '6px', height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <NavLink
            to="/profile"
            title="My Profile"
            className={({ isActive }) =>
              `staff-nav-link staff-nav-icon-only${isActive ? ' active' : ''}`
            }
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: avatarGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              boxShadow: '0 2px 6px color-mix(in srgb, var(--brand-green) 35%, transparent)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
          </NavLink>
        </div>
      )}

      {!showCollapsed && (
        <div style={{
          padding: '8px 8px 14px',
          flexShrink: 0,
          position: 'sticky', bottom: 0,
          backgroundColor: sideBg,
          backgroundImage: GRAIN_SVG,
          borderTop: `1px solid ${sideBorder}`,
        }}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', borderRadius: 11,
              border: `1px solid ${isDark ? 'color-mix(in srgb, var(--brand-green) 18%, transparent)' : 'color-mix(in srgb, var(--brand-green) 20%, transparent)'}`,
              background: isDark ? 'color-mix(in srgb, var(--brand-green) 6%, transparent)' : 'color-mix(in srgb, var(--brand-green) 5%, transparent)',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'all 0.15s ease',
              outline: 'none',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: avatarGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--brand-green) 32%, transparent)',
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--foreground)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: "'Rubik', sans-serif",
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: 12, color: accent, fontWeight: 600,
                fontFamily: "'Fira Code', monospace",
                letterSpacing: '0.05em',
              }}>
                {roleName}
              </div>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--primary)',
                transform: profileOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            />
          </button>

          {profileOpen && (
            <div
              ref={expandedActionsRef}
              className="staff-action-panel"
              style={{
                background: isDark ? 'color-mix(in srgb, var(--brand-green) 6%, transparent)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${sideBorder}`,
              }}
            >
              <NavLink
                to="/profile"
                onClick={onClose}
                className={({ isActive }) => `staff-nav-link${isActive ? ' active' : ''}`}
                style={{ fontSize: 12 }}
              >
                <User size={14} className="staff-nav-icon" style={{ flexShrink: 0 }} />
                My Profile
              </NavLink>
              <button className="staff-btn" onClick={toggleTheme} style={{ fontSize: 12 }}>
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <button className="staff-btn danger" onClick={handleLogout} style={{ fontSize: 12 }}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main layout ──────────────────────────────────────────────────────────────

const StaffLayout: React.FC = () => {
  const { isDark } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    // The slim rail is the default; only an explicit "expanded" choice shows the full sidebar.
    // New key: the old one stored 'false' for everyone who never collapsed, which would hide the rail.
    () => localStorage.getItem('staff-nav-expanded') !== 'true'
  );
  const location = useLocation();

  useEffect(() => { injectStaffStyles(); }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener('open-mobile-menu', handler);
    return () => window.removeEventListener('open-mobile-menu', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('staff-nav-expanded', desktopCollapsed ? 'false' : 'true');
  }, [desktopCollapsed]);

  const desktopSidebarWidth = desktopCollapsed ? STAFF_SIDEBAR_COLLAPSED : STAFF_SIDEBAR_EXPANDED;
  const pageBg   = 'var(--background)';
  const overlayBg = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(7,11,26,0.46)';

  return (
    <div style={{ background: pageBg, minHeight: '100vh', width: '100%', fontFamily: "'Rubik', sans-serif" }}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: overlayBg, zIndex: 45,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: mobileOpen
          ? (isDark ? '4px 0 32px rgba(0,0,0,0.6)' : '4px 0 24px rgba(7,11,26,0.18)')
          : 'none',
      }}>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 30 }}
        className="staff-desktop-sidebar"
      >
        <SidebarContent
          collapsed={desktopCollapsed}
          onToggleCollapse={() => setDesktopCollapsed(v => !v)}
        />
      </div>

      {/* Main content */}
      <main
        className="staff-main"
        style={{
          marginLeft: desktopSidebarWidth,
          width: `calc(100% - ${desktopSidebarWidth}px)`,
          minHeight: '100vh',
          boxSizing: 'border-box',
          overflowX: 'auto',
          color: 'var(--foreground)',
          fontFamily: "'Rubik', sans-serif",
          transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;
