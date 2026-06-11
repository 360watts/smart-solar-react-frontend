import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import '../App.css';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { NavigationProvider } from '../contexts/NavigationContext';
import AdminRoute from '../shared/guards/AdminRoute';
import CustomerRoute from '../shared/guards/CustomerRoute';
import Login from '../features/auth/components/Login';
import VerifyEmailPage from '../features/auth/components/VerifyEmailPage';
import NavigationProgress from '../shared/layout/NavigationProgress';
import ErrorBoundary from '../shared/components/ErrorBoundary';
import { SkeletonDashboard } from '../shared/components/SkeletonLoader';
import { ToastProvider } from '../contexts/ToastContext';
import { ToastContainer } from '../shared/components/Toast';
import { ThemeProvider } from '../contexts/ThemeContext';
import StaffRoute from '../shared/guards/StaffRoute';
const AiChat = lazy(() => import('../features/staff/AiChat'));

// Lazy load components for better initial load performance
const Dashboard = lazy(() => import('../features/staff/Dashboard'));
const Devices = lazy(() => import('../features/staff/Devices'));
const Configuration = lazy(() => import('../features/staff/Configuration'));
const Alerts = lazy(() => import('../features/staff/Alerts'));
const Users = lazy(() => import('../features/staff/Users'));
const Employees = lazy(() => import('../features/staff/Employees'));
const Departments = lazy(() => import('../features/staff/Departments'));
const DevicePresets = lazy(() => import('../features/staff/DevicePresets'));
const Profile = lazy(() => import('../features/staff/Profile'));
const OTA = lazy(() => import('../features/staff/OTA').then(m => ({ default: m.OTA })));
const Equipment = lazy(() => import('../features/staff/Equipment'));
const Sites = lazy(() => import('../features/staff/Sites'));
const SiteDetail = lazy(() => import('../features/staff/SiteDetail'));
const CommissioningWizard = lazy(() => import('../features/staff/CommissioningWizard'));
const QuotationPage = lazy(() => import('../features/quotation/QuotationPage'));

// Layouts (lazy — separate bundles)
const StaffLayout       = lazy(() => import('../shared/layout/StaffLayout'));
const PortalLayout      = lazy(() => import('../shared/layout/PortalLayout'));

// Customer portal
const PortalOverview    = lazy(() => import('../features/portal/PortalOverview'));
const PortalAlerts      = lazy(() => import('../features/portal/PortalAlerts'));
const PortalDevice      = lazy(() => import('../features/portal/PortalDevice'));
const PortalProfile     = lazy(() => import('../features/portal/PortalProfile'));
const AcceptInvitePage  = lazy(() => import('../features/portal/pages/AcceptInvitePage'));

/** Renders AiChat only for staff/superusers — customers have PortalChat instead. */
function StaffAiChat() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading || !isAuthenticated) return null;
  if (!user?.is_staff && !user?.is_superuser) return null;
  return <Suspense fallback={null}><AiChat /></Suspense>;
}

/**
 * Redirects authenticated users to the correct landing page based on role.
 * Includes loading guard to prevent flash-redirect while auth state resolves.
 */
function RoleRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.is_staff || user?.is_superuser ? '/dashboard' : '/portal'} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
<NavigationProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
          <div className="App">
            <Routes>
              {/* Public login route - no navbar, breadcrumbs, or page transition */}
              <Route path="/login" element={<Login />} />

              {/* Email verification — linked from pre-creation OTP email */}
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              {/* Public invite acceptance — no auth required, standalone page */}
              <Route path="/invite/:token" element={<Suspense fallback={null}><AcceptInvitePage /></Suspense>} />

              {/* Customer portal — own layout, no staff navbar */}
              <Route
                path="/portal"
                element={
                  <CustomerRoute>
                    <Suspense fallback={<div className="loading">Loading portal…</div>}>
                      <PortalLayout />
                    </Suspense>
                  </CustomerRoute>
                }
              >
                <Route index element={<Suspense fallback={null}><PortalOverview /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={null}><PortalAlerts /></Suspense>} />
                <Route path="device" element={<Suspense fallback={null}><PortalDevice /></Suspense>} />
<Route path="profile" element={<Suspense fallback={null}><PortalProfile /></Suspense>} />
              </Route>

              {/* Staff portal — sidebar layout */}
              <Route
                element={
                  <StaffRoute>
                    <NavigationProgress />
                    <Suspense fallback={<div className="loading">Loading…</div>}>
                      <StaffLayout />
                    </Suspense>
                  </StaffRoute>
                }
              >
                <Route path="/" element={<RoleRedirect />} />
                <Route path="/dashboard" element={<Suspense fallback={<SkeletonDashboard />}><Dashboard /></Suspense>} />
                <Route path="/devices" element={<Suspense fallback={<SkeletonDashboard />}><Devices /></Suspense>} />
                <Route path="/configuration" element={<Suspense fallback={<SkeletonDashboard />}><Configuration /></Suspense>} />
                <Route path="/alerts" element={<Suspense fallback={<SkeletonDashboard />}><Alerts /></Suspense>} />
                <Route path="/users" element={<Suspense fallback={<SkeletonDashboard />}><Users /></Suspense>} />
                <Route path="/employees" element={<AdminRoute><Suspense fallback={<SkeletonDashboard />}><Employees /></Suspense></AdminRoute>} />
                <Route path="/departments" element={<AdminRoute><Suspense fallback={<SkeletonDashboard />}><Departments /></Suspense></AdminRoute>} />
                <Route path="/device-presets" element={<Suspense fallback={<SkeletonDashboard />}><DevicePresets /></Suspense>} />
                <Route path="/ota" element={<AdminRoute><Suspense fallback={<SkeletonDashboard />}><OTA /></Suspense></AdminRoute>} />
                <Route path="/sites/commissioning" element={<Suspense fallback={<SkeletonDashboard />}><CommissioningWizard /></Suspense>} />
                <Route path="/sites/:siteId" element={<Suspense fallback={<SkeletonDashboard />}><SiteDetail /></Suspense>} />
                <Route path="/sites" element={<Suspense fallback={<SkeletonDashboard />}><Sites /></Suspense>} />
                <Route path="/equipment" element={<Suspense fallback={<SkeletonDashboard />}><Equipment /></Suspense>} />
                <Route path="/quotation" element={<Suspense fallback={<SkeletonDashboard />}><QuotationPage /></Suspense>} />
                <Route path="/profile" element={<Suspense fallback={<SkeletonDashboard />}><Profile /></Suspense>} />
              </Route>
            </Routes>
            <ToastContainer />
            <StaffAiChat />
          </div>
        </Router>
      </NavigationProvider>
      </AuthProvider>
      </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
