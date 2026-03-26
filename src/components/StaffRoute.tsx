import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface StaffRouteProps {
  children: React.ReactElement;
}

/**
 * StaffRoute — allow staff or superusers.
 * Backend equipment endpoints are IsStaffUser, so non-staff should not access this UI.
 */
const StaffRoute: React.FC<StaffRouteProps> = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isStaff = !!(user?.is_staff || user?.is_superuser);
  if (!isStaff) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>This section is available to staff users only.</p>
      </div>
    );
  }

  return children;
};

export default StaffRoute;

