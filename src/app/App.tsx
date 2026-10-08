import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import '../App.css';
// App.css split by feature (CSS-unification Phase 2) — same selectors/values, reorganized.
import '../shared/styles/form.css';
import '../shared/styles/buttons.css';
import '../shared/styles/status.css';
import '../shared/styles/tables.css';
import '../shared/styles/alerts.css';
import '../shared/styles/modals.css';
import '../shared/styles/metrics.css';
import '../shared/styles/skeleton.css';
import '../shared/styles/cards.css';
import '../shared/styles/toast.css';
import '../shared/styles/activity.css';
import '../shared/styles/search.css';
import '../shared/styles/theme-toggle.css';
import '../shared/styles/particles.css';
import '../shared/styles/badges.css';
import '../shared/styles/avatar.css';
import '../shared/layout/sidebar.css';
import '../shared/layout/nav.css';
import '../shared/layout/logout.css';
import '../features/auth/auth.css';
import '../features/auth/otp.css';
import '../features/profile/profile.css';
import '../features/quotation/quotation-legacy.css';
import '../features/staff/slave-cards.css';
import '../features/staff/presets.css';
import '../features/staff/users.css';
import '../features/staff/staff-portal.css';
import '../features/staff/site.css';
import '../features/staff/admin.css';
import '../features/staff/ota.css';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CUSTOMER_PORTAL_URL } from './constants';
import { NavigationProvider } from '../contexts/NavigationContext';
import RequireAccess from '../shared/access/RequireAccess';
import { useAccess } from '../shared/access/useAccess';
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
const Employees = lazy(() => import('../features/staff/employees/EmployeesPage'));
const Teams = lazy(() => import('../features/staff/Teams'));
const DevicePresets = lazy(() => import('../features/staff/DevicePresets'));
const Profile = lazy(() => import('../features/staff/Profile'));
const OTA = lazy(() => import('../features/staff/OTA').then(m => ({ default: m.OTA })));
const Equipment = lazy(() => import('../features/staff/Equipment'));
const Sites = lazy(() => import('../features/staff/Sites'));
const SiteDetail = lazy(() => import('../features/staff/SiteDetail'));
const SiteOnboarding = lazy(() => import('../features/staff/SiteOnboarding'));
const CommissioningWizard = lazy(() => import('../features/staff/CommissioningWizard'));
const QuotationPage = lazy(() => import('../features/quotation/QuotationPage'));
const ServiceBookings = lazy(() => import('../features/staff/ServiceBookings'));
const SupportInbox = lazy(() => import('../features/staff/SupportInbox'));
const Analytics = lazy(() => import('../features/staff/Analytics'));

// Layouts (lazy — separate bundles)
const StaffLayout       = lazy(() => import('../shared/layout/StaffLayout'));

/** Renders AiChat only for staff/superusers. */
function StaffAiChat() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const { can } = useAccess();
  if (loading || !isAuthenticated || !isStaff || !can('ai_chat')) return null;
  return <Suspense fallback={null}><AiChat /></Suspense>;
}

const MySites = lazy(() => import('../features/staff/viewer/MySites'));
const ViewerSite = lazy(() => import('../features/staff/viewer/ViewerSite'));

export function RoleRedirect() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const { home } = useAccess();
  React.useEffect(() => {
    if (!loading && isAuthenticated && !isStaff) {
      window.location.href = CUSTOMER_PORTAL_URL;
    }
  }, [loading, isAuthenticated, isStaff]);

  if (loading) return <div className="loading">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isStaff) return <div className="loading">Redirecting…</div>;
  return <Navigate to={home} replace />;
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
                <Route path="/dashboard" element={<RequireAccess feature="dashboard"><Suspense fallback={<SkeletonDashboard />}><Dashboard /></Suspense></RequireAccess>} />
                <Route path="/devices" element={<RequireAccess feature="devices"><Suspense fallback={<SkeletonDashboard />}><Devices /></Suspense></RequireAccess>} />
                <Route path="/configuration" element={<RequireAccess feature="configuration"><Suspense fallback={<SkeletonDashboard />}><Configuration /></Suspense></RequireAccess>} />
                <Route path="/alerts" element={<RequireAccess feature="alerts"><Suspense fallback={<SkeletonDashboard />}><Alerts /></Suspense></RequireAccess>} />
                <Route path="/service-bookings" element={<RequireAccess feature="bookings"><Suspense fallback={<SkeletonDashboard />}><ServiceBookings /></Suspense></RequireAccess>} />
                <Route path="/support-inbox" element={<RequireAccess feature="support"><Suspense fallback={<SkeletonDashboard />}><SupportInbox /></Suspense></RequireAccess>} />
                <Route path="/users" element={<RequireAccess feature="users"><Suspense fallback={<SkeletonDashboard />}><Users /></Suspense></RequireAccess>} />
                <Route path="/employees" element={<RequireAccess feature="employees"><Suspense fallback={<SkeletonDashboard />}><Employees /></Suspense></RequireAccess>} />
                <Route path="/teams" element={<RequireAccess feature="teams"><Suspense fallback={<SkeletonDashboard />}><Teams /></Suspense></RequireAccess>} />
                <Route path="/departments" element={<Navigate to="/teams" replace />} />
                <Route path="/device-presets" element={<RequireAccess feature="presets"><Suspense fallback={<SkeletonDashboard />}><DevicePresets /></Suspense></RequireAccess>} />
                <Route path="/ota" element={<RequireAccess feature="ota"><Suspense fallback={<SkeletonDashboard />}><OTA /></Suspense></RequireAccess>} />
                <Route path="/analytics" element={<RequireAccess feature="analytics"><Suspense fallback={<SkeletonDashboard />}><Analytics /></Suspense></RequireAccess>} />
                <Route path="/sites/commissioning" element={<RequireAccess feature="sites"><Suspense fallback={<SkeletonDashboard />}><CommissioningWizard /></Suspense></RequireAccess>} />
                <Route path="/sites/onboarding" element={<RequireAccess feature="sites"><Suspense fallback={<SkeletonDashboard />}><SiteOnboarding /></Suspense></RequireAccess>} />
                <Route path="/sites/:siteId" element={<RequireAccess feature="sites"><Suspense fallback={<SkeletonDashboard />}><SiteDetail /></Suspense></RequireAccess>} />
                <Route path="/sites" element={<RequireAccess feature="sites"><Suspense fallback={<SkeletonDashboard />}><Sites /></Suspense></RequireAccess>} />
                <Route path="/equipment" element={<RequireAccess feature="catalog"><Suspense fallback={<SkeletonDashboard />}><Equipment /></Suspense></RequireAccess>} />
                <Route path="/quotation" element={<RequireAccess feature="quotations"><Suspense fallback={<SkeletonDashboard />}><QuotationPage /></Suspense></RequireAccess>} />
                <Route path="/my-sites" element={<RequireAccess feature="my_sites"><Suspense fallback={<SkeletonDashboard />}><MySites /></Suspense></RequireAccess>} />
                <Route path="/my-sites/:siteId" element={<RequireAccess feature="my_sites"><Suspense fallback={<SkeletonDashboard />}><ViewerSite /></Suspense></RequireAccess>} />
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
