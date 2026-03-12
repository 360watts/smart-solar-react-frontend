import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import finalLogo from '../assets/finalLogo.png';

const iconProps = { size: 18, className: 'sidebar-icon-svg' };


interface NavItem {
  path: string;
  label: string;
  adminOnly: boolean;
  icon: React.ReactNode;
}

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { setIsNavigating, navigationHistory } = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { path: '/devices',        label: 'Devices',        adminOnly: false, icon: <Monitor {...iconProps} /> },
    { path: '/configuration',  label: 'Configuration',  adminOnly: false, icon: <Settings {...iconProps} /> },
    { path: '/alerts',         label: 'Alerts',         adminOnly: false, icon: <Bell {...iconProps} /> },
    { path: '/users',          label: 'Users',          adminOnly: false, icon: <Users {...iconProps} /> },
    { path: '/employees',      label: 'Employees',      adminOnly: true,  icon: <Briefcase {...iconProps} /> },
    { path: '/device-presets', label: 'Device Presets', adminOnly: false, icon: <Star {...iconProps} /> },
    { path: '/ota',            label: 'OTA Updates',    adminOnly: true,  icon: <Download {...iconProps} /> },
  ];

  const handleNavigation = (path: string) => {
    setIsNavigating(true);
    navigate(path);
    setExpandedMenu(null);
    setMobileOpen(false);
  };

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

  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Hamburger toggle — only visible on mobile (<768px) */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop overlay */}
      <div
        className={'sidebar-overlay' + (mobileOpen ? ' open' : '')}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

    <nav className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-badge">
            <img src={finalLogo} alt="360watts" className="sidebar-logo-img" />
          </div>
          <div className="logo-text">
            <h2>Smart Solar</h2>
            <p className="logo-subtitle">IoT Platform</p>
          </div>
        </div>

        {isAuthenticated && user && (
          <Link to="/profile" className="user-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="user-avatar">
              {user.first_name.charAt(0).toUpperCase()}
              {user.last_name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <p className="user-name">{user.first_name} {user.last_name}</p>
              <p className="user-role-badge">
                {user.is_superuser ? 'Admin' : user.is_staff ? 'Staff' : 'User'}
              </p>
            </div>
          </Link>
        )}
      </div>

      {isAuthenticated ? (
        <>
          <ul className="sidebar-nav">
            {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li
                  key={item.path}
                  className={isActive ? 'active' : ''}
                  onMouseEnter={() => setExpandedMenu(item.path)}
                  onMouseLeave={() => setExpandedMenu(null)}
                >
                  <Link
                    to={item.path}
                    className="sidebar-link"
                    onClick={() => {
                      if (location.pathname !== item.path) {
                        handleNavigation(item.path);
                      }
                    }}
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    <span className="sidebar-text">{item.label}</span>
                    {expandedMenu === item.path && !isActive && (
                      <span className="nav-tooltip">{item.label}</span>
                    )}
                  </Link>
                  <div className="nav-active-indicator"></div>
                </li>
              );
            })}
          </ul>

          <div className="sidebar-footer">
            {/* Dark mode toggle */}
            <div className="theme-toggle-row">
              <span className="theme-toggle-label">
                {isDark ? (
                  <Moon size={14} className="theme-toggle-icon" />
                ) : (
                  <Sun size={14} className="theme-toggle-icon" />
                )}
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
              <button
                className={`theme-switch${isDark ? ' theme-switch--dark' : ''}`}
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                <span className="theme-switch-thumb" />
              </button>
            </div>

            {navigationHistory.length > 1 && (
              <button
                onClick={handleGoBack}
                className="logout-button"
                title="Go back to previous page"
              >
                <ArrowLeft {...iconProps} />
                Back
              </button>
            )}
            <button onClick={handleLogout} className="logout-button">
              <LogOut {...iconProps} />
              Logout
            </button>
          </div>
        </>
      ) : (
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
