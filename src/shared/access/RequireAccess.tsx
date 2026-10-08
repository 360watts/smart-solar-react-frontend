import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from './useAccess';
import type { Feature } from './features';

interface RequireAccessProps {
  feature: Feature;
  children: React.ReactElement;
}

const RequireAccess: React.FC<RequireAccessProps> = ({ feature, children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { can, home } = useAccess();

  if (loading) return <div className="loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!can(feature)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
        <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>This page isn't available for your role</h1>
          <p style={{ margin: '0 0 20px', opacity: 0.75 }}>Ask an admin if you need access.</p>
          <Link to={home} className="btn btn-primary">Go to your home</Link>
        </div>
      </div>
    );
  }
  return children;
};

export default RequireAccess;
