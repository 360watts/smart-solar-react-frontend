import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface CustomerRouteProps {
  children: React.ReactElement;
}

/**
 * CustomerRoute — allows only authenticated non-staff, non-superuser users.
 * Staff and superusers are redirected to the staff dashboard.
 * Unauthenticated users are redirected to login.
 *
 * Mirrors StaffRoute but inverted — one or the other wraps every top-level route
 * so each user type lands in their own dedicated section of the app.
 */
const CustomerRoute: React.FC<CustomerRouteProps> = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.is_staff || user?.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default CustomerRoute;
