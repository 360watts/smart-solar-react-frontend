import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import finalLogo from '../assets/finalLogo.png';

/* ---- SVG icon components ---- */
const IconDevices = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const IconConfiguration = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 0 14.14"/>
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
);

const IconAlerts = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconEmployees = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

const IconPresets = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconOTA = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);

const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);


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
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const navItems: NavItem[] = [
    { path: '/devices',        label: 'Devices',        adminOnly: false, icon: <IconDevices /> },
    { path: '/configuration',  label: 'Configuration',  adminOnly: false, icon: <IconConfiguration /> },
    { path: '/alerts',         label: 'Alerts',         adminOnly: false, icon: <IconAlerts /> },
    { path: '/users',          label: 'Users',          adminOnly: false, icon: <IconUsers /> },
    { path: '/employees',      label: 'Employees',      adminOnly: true,  icon: <IconEmployees /> },
    { path: '/device-presets', label: 'Device Presets', adminOnly: false, icon: <IconPresets /> },
    { path: '/ota',            label: 'OTA Updates',    adminOnly: true,  icon: <IconOTA /> },
  ];

  const handleNavigation = (path: string) => {
    setIsNavigating(true);
    navigate(path);
    setExpandedMenu(null);
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

  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  return (
    <nav className="sidebar">
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
            {navigationHistory.length > 1 && (
              <button
                onClick={handleGoBack}
                className="logout-button"
                title="Go back to previous page"
              >
                <IconBack />
                Back
              </button>
            )}
            <button onClick={handleLogout} className="logout-button">
              <IconLogout />
              Logout
            </button>
          </div>
        </>
      ) : (
        <div className="sidebar-auth">
          <Link to="/login" className="auth-link">
            <IconUsers />
            Login
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
