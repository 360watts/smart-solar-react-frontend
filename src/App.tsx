import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './components/Login';
import Navbar from './components/Navbar';
import NavigationProgress from './components/NavigationProgress';
import PageTransition from './components/PageTransition';
import { SkeletonDashboard } from './components/SkeletonLoader';

// Lazy load components for better initial load performance
const Devices = lazy(() => import('./components/Devices'));
const Configuration = lazy(() => import('./components/Configuration'));
const Telemetry = lazy(() => import('./components/Telemetry'));
const Alerts = lazy(() => import('./components/Alerts'));
const SystemHealth = lazy(() => import('./components/SystemHealth'));
const Users = lazy(() => import('./components/Users'));
const Employees = lazy(() => import('./components/Employees'));
const DevicePresets = lazy(() => import('./components/DevicePresets'));
const Profile = lazy(() => import('./components/Profile'));

function App() {
  return (
    <AuthProvider>
      <NavigationProvider>
        <Router>
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
                                <Navigate to="/devices" replace />
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
                            path="/telemetry"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <Telemetry />
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
                            path="/health"
                            element={
                              <ProtectedRoute>
                                <Suspense fallback={<SkeletonDashboard />}>
                                  <SystemHealth />
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
          </div>
        </Router>
      </NavigationProvider>
    </AuthProvider>
  );
}

export default App;