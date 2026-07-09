import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface StaffRouteProps {
  children: React.ReactElement;
}

// This app has no customer-facing routes — the customer portal is a separate
// app (my.360watts.com), so a non-staff account can't be sent to an internal path.
const CUSTOMER_PORTAL_URL = 'https://my.360watts.com';

/**
 * StaffRoute — allow staff or superusers.
 * Backend equipment endpoints are IsStaffUser, so non-staff should not access this UI.
 */
const StaffRoute: React.FC<StaffRouteProps> = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const isStaff = !!(user?.is_staff || user?.is_superuser);

  useEffect(() => {
    if (!loading && isAuthenticated && !isStaff) {
      window.location.href = CUSTOMER_PORTAL_URL;
    }
  }, [loading, isAuthenticated, isStaff]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isStaff) return <div className="loading">Redirecting…</div>;

  return children;
};

export default StaffRoute;

