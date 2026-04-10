import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './MobileSidebarOverrides.css'; /* Load after App.css so mobile drawer overrides win */
import './TopNavbar.css'; /* Load last — overrides sidebar layout with top nav */
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './components/Login';
import Navbar from './components/Navbar';
import NavigationProgress from './components/NavigationProgress';
import PageTransition from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonDashboard } from './components/SkeletonLoader';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import AiChat from './components/AiChat';
import StaffRoute from './components/StaffRoute';

// Lazy load components for better initial load performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const Devices = lazy(() => import('./components/Devices'));
const Configuration = lazy(() => import('./components/Configuration'));
const Alerts = lazy(() => import('./components/Alerts'));
const Users = lazy(() => import('./components/Users'));
const Employees = lazy(() => import('./components/Employees'));
const DevicePresets = lazy(() => import('./components/DevicePresets'));
const Profile = lazy(() => import('./components/Profile'));
const OTA = lazy(() => import('./components/OTA').then(m => ({ default: m.OTA })));
const Equipment = lazy(() => import('./components/Equipment'));
const Sites = lazy(() => import('./components/Sites'));
const SiteDetail = lazy(() => import('./components/SiteDetail'));
const CommissioningWizard = lazy(() => import('./components/CommissioningWizard'));

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
                          <Route
                            path="/"
                            element={
                              <ProtectedRoute>
                                <Navigate to="/dashboard" replace />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/dashboard"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Dashboard />
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/devices"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Devices />
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/configuration"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Configuration />
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/alerts"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Alerts />
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/users"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Users />
                                </Suspense>
                              </ProtectedRoute>
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
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <DevicePresets />
                                </Suspense>
                              </ProtectedRoute>
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
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Profile />
                                </Suspense>
                              </ProtectedRoute>
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
            <AiChat />
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