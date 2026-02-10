import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { setIsNavigating, navigationHistory } = useNavigation();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const navItems = [
    {
      path: '/devices',
      label: 'Devices',
      adminOnly: false,
      icon: '📱'
    },
    {
      path: '/configuration',
      label: 'Configuration',
      adminOnly: false,
      icon: '⚙️'
    },
    {
      path: '/telemetry',
      label: 'Telemetry',
      adminOnly: false,
      icon: '📊'
    },
    {
      path: '/alerts',
      label: 'Alerts',
      adminOnly: false,
      icon: '🔔'
    },
    {
      path: '/health',
      label: 'System Health',
      adminOnly: false,
      icon: '💚'
    },
    {
      path: '/users',
      label: 'Users',
      adminOnly: false,
      icon: '👥'
    },
    {
      path: '/employees',
      label: 'Employees',
      adminOnly: true,
      icon: '👔'
    },
    {
      path: '/device-presets',
      label: 'Device Presets',
      adminOnly: false,
      icon: '⭐'
    },
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

  // Don't render navbar on login page or when not authenticated
  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  return (
    <nav className="sidebar">
      {/* Enhanced Header with Gradient */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-badge">☀️</div>
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
                {user.is_superuser ? '👑 Admin' : user.is_staff ? '👤 Staff' : '👤 User'}
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
                    {expandedMenu === item.path && (
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back
              </button>
            )}
            <button onClick={handleLogout} className="logout-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16,17 21,12 16,7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        </>
      ) : (
        <div className="sidebar-auth">
          <Link to="/login" className="auth-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Login
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;