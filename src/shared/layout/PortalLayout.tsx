import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, Cpu, User, LogOut, Sun, Moon, X, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import PortalChat from '../../features/portal/PortalChat';
import { getDesignTokens } from '../theme';
import { useIsMobile } from '../hooks/useIsMobile';

const NAV_ITEMS = [
  { path: '/portal',        label: 'Overview',  icon: LayoutDashboard, end: true  },
  { path: '/portal/alerts', label: 'Alerts',    icon: Bell,             end: false },
  { path: '/portal/device', label: 'My Device', icon: Cpu,              end: false },
  { path: '/portal/profile', label: 'Profile',  icon: User,             end: false },
];

/* ─── Shared portal CSS (injected once) ─────────────────────────────────── */
const PORTAL_STYLES = `
  @keyframes portal-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes portal-pulse-ring {
    0%   { transform: scale(1);    opacity: 0.6; }
    70%  { transform: scale(1.45); opacity: 0;   }
    100% { transform: scale(1.45); opacity: 0;   }
  }
  @keyframes portal-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes portal-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .portal-fade-in { animation: portal-fade-in 0.35s ease both; }
  .portal-fade-in-1 { animation: portal-fade-in 0.35s 0.05s ease both; }
  .portal-fade-in-2 { animation: portal-fade-in 0.35s 0.10s ease both; }
  .portal-fade-in-3 { animation: portal-fade-in 0.35s 0.15s ease both; }
  .portal-fade-in-4 { animation: portal-fade-in 0.35s 0.20s ease both; }

  .portal-nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    text-decoration: none;
    font-size: 14px;
    font-family: var(--font-body);
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    transition: all 0.18s ease;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
  }
  .portal-nav-link::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--green-soft);
    border-radius: 10px;
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  .portal-nav-link:hover { color: var(--primary); }
  .portal-nav-link:hover::before { opacity: 1; }
  .portal-nav-link.active {
    color: var(--primary);
    background: var(--green-soft);
    font-weight: 600;
  }
  .portal-nav-link.active .portal-nav-dot {
    opacity: 1;
    background: var(--primary);
    box-shadow: 0 0 8px var(--green-soft);
  }
  .portal-nav-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: transparent;
    margin-left: auto;
    opacity: 0;
    transition: all 0.18s ease;
    flex-shrink: 0;
  }

  .portal-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 12px; border-radius: 9px; border: none;
    background: transparent; cursor: pointer; font-size: 13px;
    font-family: var(--font-body); font-weight: 500;
    transition: all 0.18s ease; width: 100%; text-align: left;
    color: var(--muted-foreground);
  }
  .portal-btn:hover { background: var(--green-soft); color: var(--foreground); }
  .portal-btn.danger { color: var(--destructive); }
  .portal-btn.danger:hover { background: rgba(239,68,68,0.10); color: var(--destructive); }
`;

function injectPortalStyles() {
  if (document.getElementById('portal-design-styles')) return;
  const el = document.createElement('style');
  el.id = 'portal-design-styles';
  el.textContent = PORTAL_STYLES;
  document.head.appendChild(el);
}

/* ─── Animated sun logo mark ─────────────────────────────────────────────── */
const SunMark: React.FC = () => (
  <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
    {/* outer pulse ring */}
    <div style={{
      position: 'absolute', inset: -4,
      borderRadius: '50%',
      border: '2px solid rgba(245,158,11,0.35)',
      animation: 'portal-pulse-ring 2.4s ease-out infinite',
    }} />
    {/* icon bg */}
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--secondary) 0%, var(--chart-warning) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 16px rgba(245,158,11,0.5)',
    }}>
      <Zap size={16} color="var(--secondary-foreground)" strokeWidth={2.5} />
    </div>
    {/* spinning spokes */}
    <div style={{
      position: 'absolute', inset: -8,
      animation: 'portal-spin 12s linear infinite',
      pointerEvents: 'none',
    }}>
      {[0,45,90,135,180,225,270,315].map((deg) => (
        <div key={deg} style={{
          position: 'absolute',
          width: 2, height: 5,
          background: 'rgba(245,158,11,0.4)',
          borderRadius: 2,
          top: '50%', left: '50%',
          transformOrigin: '1px -18px',
          transform: `rotate(${deg}deg) translateX(-1px)`,
        }} />
      ))}
    </div>
  </div>
);

/* ─── Sidebar content ─────────────────────────────────────────────────────── */
const SidebarContent: React.FC<{ onClose?: () => void; isDark?: boolean }> = ({ onClose, isDark: isDarkProp }) => {
  const { user, logout } = useAuth();
  const { isDark: isDarkCtx, toggleTheme } = useTheme();
  const isDark = isDarkProp !== undefined ? isDarkProp : isDarkCtx;
  const tokens = getDesignTokens(isDark);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
    || user?.username?.[0]?.toUpperCase() || '?';

  const sideBg    = `linear-gradient(180deg, ${tokens.surface} 0%, ${tokens.pageBg} 100%)`;
  const sideBorder = tokens.border;
  const sideText   = tokens.text;
  const sideMuted  = tokens.textMuted;
  const userBg     = tokens.surfaceMuted;
  const userBorder = tokens.border;
  const userText   = tokens.text;

  return (
    <div style={{
      width: 'min(232px, 90vw)', height: '100%',
      background: sideBg,
      borderRight: `1px solid ${sideBorder}`,
      display: 'flex', flexDirection: 'column',
      padding: '0',
      fontFamily: "var(--font-body)",
    }}>
      {/* Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: `1px solid ${tokens.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <SunMark />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: sideText, letterSpacing: '-0.01em' }}>
            360Watts
          </div>
          <div style={{ fontSize: 11, color: sideMuted, marginTop: 1, letterSpacing: '0.03em' }}>
            My Solar Portal
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: 4, borderRadius: 6, border: 'none', background: 'transparent', color: sideMuted, cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ path, label, icon: Icon, end }, i) => {
          const isActive = end ? location.pathname === path : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={onClose}
              className={`portal-nav-link portal-fade-in-${i + 1} ${isActive ? 'active' : ''}`}
              style={!isDark && !isActive ? { color: tokens.textMuted } : undefined}
            >
              <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
              {label}
              <span className="portal-nav-dot" />
            </NavLink>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: tokens.border, margin: '0 12px' }} />

      {/* User block — clicks through to profile */}
      <div style={{ padding: '16px 12px 8px' }}>
        <NavLink
          to="/portal/profile"
          onClick={onClose}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 10,
            background: isActive ? tokens.primarySoft : userBg,
            border: isActive ? `1px solid ${tokens.primary}` : `1px solid ${userBorder}`,
            marginBottom: 4,
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          })}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.primaryHover})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: tokens.textInverse,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: userText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
            </div>
            <div style={{ fontSize: 11, color: sideMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <User size={13} color={sideMuted} style={{ flexShrink: 0 }} />
        </NavLink>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '0 12px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button className="portal-btn" onClick={toggleTheme} style={!isDark ? { color: tokens.textMuted } : undefined}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <button className="portal-btn danger" onClick={handleLogout}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
};

/* ─── Main layout ─────────────────────────────────────────────────────────── */
const PortalLayout: React.FC = () => {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const tokens = getDesignTokens(isDark);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreTrayOpen, setMoreTrayOpen] = useState(false);
  const chatOpenRef = useRef<(() => void) | null>(null);

  useEffect(() => { injectPortalStyles(); }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreTrayOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      background: isMobile
        ? `radial-gradient(circle at top, ${tokens.primarySoft} 0%, ${tokens.pageBg} 28%), ${tokens.pageBg}`
        : tokens.pageBg,
      minHeight: '100vh',
      width: '100%',
      color: tokens.text,
      fontFamily: "var(--font-body)",
    }}>
      {/* More tray — slides up from bottom nav on mobile */}
      {moreTrayOpen && isMobile && (
        <>
          <div
            onClick={() => setMoreTrayOpen(false)}
            style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(18,21,26,0.25)', zIndex: 46, backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', left: 12, right: 12,
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            zIndex: 47,
            background: isDark ? 'rgba(10,20,14,0.98)' : 'rgba(252,255,253,0.98)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${tokens.border}`,
            borderRadius: 22, boxShadow: tokens.shadow, padding: 8,
            animation: 'portal-fade-in 0.2s ease both',
          }}>
            <button className="portal-btn" onClick={() => { toggleTheme(); setMoreTrayOpen(false); }} style={{ color: tokens.textMuted }}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button className="portal-btn danger" onClick={handleLogout}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
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
        <SidebarContent onClose={() => setMobileOpen(false)} isDark={isDark} />
      </div>

      {/* Desktop sidebar — always visible */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 30 }} className="portal-desktop-sidebar">
        <SidebarContent isDark={isDark} />
      </div>

      {/* Main content */}
      <main style={{
        marginLeft: 232,
        width: 'calc(100% - 232px)',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowX: 'auto',
      }} className="portal-main">
        <Outlet />
      </main>

      {/* Floating AI chat widget — always available across all portal pages */}
      <PortalChat openRef={chatOpenRef} />

      {isMobile && (
        <nav
          aria-label="Customer portal mobile navigation"
          style={{
            position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 48,
            background: isDark ? 'rgba(10,20,14,0.97)' : 'rgba(252,255,253,0.96)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${tokens.border}`,
            borderRadius: 26,
            padding: `10px 8px calc(10px + env(safe-area-inset-bottom, 0px))`,
            boxShadow: isDark ? '0 -4px 40px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.3)' : '0 20px 50px rgba(18,21,26,0.14)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 68px 1fr 1fr',
            gap: 2,
            alignItems: 'center',
          }}
        >
          {/* Left two: Overview + Alerts */}
          {NAV_ITEMS.slice(0, 2).map(({ path, label, icon: Icon, end }) => {
            const isActive = end ? location.pathname === path : location.pathname.startsWith(path);
            return (
              <NavLink key={path} to={path} end={end} style={{
                minWidth: 0, textDecoration: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 18,
                background: isActive ? tokens.primarySoft : 'transparent',
                color: isActive ? tokens.primary : tokens.textMuted,
                fontSize: 10, fontWeight: isActive ? 700 : 600,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}>
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.9} />
                <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
              </NavLink>
            );
          })}

          {/* Center: AI orb — raised + glowing */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button
              onClick={() => chatOpenRef.current?.()}
              aria-label="Open AI assistant"
              style={{
                width: 54, height: 54,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #2FBF71 0%, #1A9E58 100%)',
                boxShadow: '0 0 0 3px rgba(47,191,113,0.18), 0 0 18px rgba(47,191,113,0.55), 0 6px 20px rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: 'translateY(-10px)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
                position: 'relative',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'translateY(-7px) scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'translateY(-10px)')}
              onTouchStart={e => (e.currentTarget.style.transform = 'translateY(-7px) scale(0.95)')}
              onTouchEnd={e => (e.currentTarget.style.transform = 'translateY(-10px)')}
            >
              {/* Pulse ring */}
              <span style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                border: '2px solid rgba(47,191,113,0.35)',
                animation: 'portal-pulse-ring 2.4s ease-out infinite',
                pointerEvents: 'none',
              }} />
              <Sparkles size={22} color="#fff" strokeWidth={2} />
            </button>
          </div>

          {/* Right two: My Device + Profile */}
          {NAV_ITEMS.slice(2).map(({ path, label, icon: Icon, end }) => {
            const isActive = end ? location.pathname === path : location.pathname.startsWith(path);
            return (
              <NavLink key={path} to={path} end={end} style={{
                minWidth: 0, textDecoration: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 18,
                background: isActive ? tokens.primarySoft : 'transparent',
                color: isActive ? tokens.primary : tokens.textMuted,
                fontSize: 10, fontWeight: isActive ? 700 : 600,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}>
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.9} />
                <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      <style>{`
        /* 900px keeps sidebar visible up to ~125% zoom on 1280px screens */
        @media (max-width: 900px) {
          .portal-desktop-sidebar { display: none !important; }
          .portal-main { margin-left: 0 !important; width: 100% !important; padding: 20px 16px 96px !important; overflow-x: hidden !important; }
        }
        @media (min-width: 901px) {
          .portal-main { padding: clamp(16px, 2.5vw, 36px) clamp(16px, 2.8vw, 40px) !important; }
        }
      `}</style>
    </div>
  );
};

export default PortalLayout;
