import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import '../App.css';
import '../MobileSidebarOverrides.css'; /* Load after App.css so mobile drawer overrides win */
import '../TopNavbar.css'; /* Load last — overrides sidebar layout with top nav */
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { NavigationProvider } from '../contexts/NavigationContext';
import AdminRoute from '../shared/guards/AdminRoute';
import CustomerRoute from '../shared/guards/CustomerRoute';
import Login from '../features/auth/components/Login';
import Navbar from '../shared/layout/Navbar';
import NavigationProgress from '../shared/layout/NavigationProgress';
import PageTransition from '../shared/layout/PageTransition';
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
const DevicePresets = lazy(() => import('../features/staff/DevicePresets'));
const Profile = lazy(() => import('../features/staff/Profile'));
const OTA = lazy(() => import('../features/staff/OTA').then(m => ({ default: m.OTA })));
const Equipment = lazy(() => import('../features/staff/Equipment'));
const Sites = lazy(() => import('../features/staff/Sites'));
const SiteDetail = lazy(() => import('../features/staff/SiteDetail'));
const CommissioningWizard = lazy(() => import('../features/staff/CommissioningWizard'));

// Customer portal (lazy — separate bundle)
const PortalLayout      = lazy(() => import('../shared/layout/PortalLayout'));
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

              {/* Protected routes with full layout */}
              <Route
                path="*"
                element={
                  <>
                    <NavigationProgress />
                    <Navbar />
                    <PageTransition>
                      <main className="main-content">
                        <Routes>
                          {/* Protected routes */}
                          <Route path="/" element={<RoleRedirect />} />
                          <Route
                            path="/dashboard"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Dashboard />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/devices"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Devices />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/configuration"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Configuration />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/alerts"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Alerts />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/users"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Users />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/employees"
                            element={
                              <AdminRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Employees />
                                </Suspense>
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="/device-presets"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <DevicePresets />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/ota"
                            element={
                              <AdminRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <OTA />
                                </Suspense>
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="/sites/commissioning"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <CommissioningWizard />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/sites/:siteId"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <SiteDetail />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/sites"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Sites />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/equipment"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Equipment />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                          <Route
                            path="/profile"
                            element={
                              <StaffRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Profile />
                                </Suspense>
                              </StaffRoute>
                            }
                          />
                        </Routes>
                      </main>
                    </PageTransition>
                  </>
                }
              />
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