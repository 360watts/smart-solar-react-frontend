import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './components/Login';
import Devices from './components/Devices';
import Configuration from './components/Configuration';
import Telemetry from './components/Telemetry';
import Alerts from './components/Alerts';
import SystemHealth from './components/SystemHealth';
import Users from './components/Users';
import Employees from './components/Employees';
import DevicePresets from './components/DevicePresets';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import NavigationProgress from './components/NavigationProgress';
import PageTransition from './components/PageTransition';

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
                                <Devices />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/configuration"
                            element={
                              <ProtectedRoute>
                                <Configuration />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/telemetry"
                            element={
                              <ProtectedRoute>
                                <Telemetry />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/alerts"
                            element={
                              <ProtectedRoute>
                                <Alerts />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/health"
                            element={
                              <ProtectedRoute>
                                <SystemHealth />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/users"
                            element={
                              <ProtectedRoute>
                                <Users />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/employees"
                            element={
                              <AdminRoute>
                                <Employees />
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="/device-presets"
                            element={
                              <ProtectedRoute>
                                <DevicePresets />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/profile"
                            element={
                              <ProtectedRoute>
                                <Profile />
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