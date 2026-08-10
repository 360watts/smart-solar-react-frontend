import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CUSTOMER_PORTAL_URL } from '../../app/constants';

interface StaffRouteProps {
  children: React.ReactElement;
}

const StaffRoute: React.FC<StaffRouteProps> = ({ children }) => {
  const { isAuthenticated, isStaff, loading } = useAuth();

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
