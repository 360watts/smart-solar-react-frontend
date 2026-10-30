import React from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { EmptyState } from '../components/Feedback';
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
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '0 16px' }}>
        <EmptyState icon={Lock} title="This page isn't available for your role" description="Ask an admin if you need access."
          action={{ label: 'Go to your home', to: home }} />
      </div>
    );
  }
  return children;
};

export default RequireAccess;
