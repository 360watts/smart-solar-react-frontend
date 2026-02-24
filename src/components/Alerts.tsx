import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import AuditTrail from './AuditTrail';
import { useTheme } from '../contexts/ThemeContext';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  timestamp: string;
  resolved: boolean;
  created_by_username?: string;
  created_at?: string;
}

const Alerts: React.FC = () => {
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'analytics'>('overview');

  useEffect(() => {
    fetchAlerts();
    // Set up polling for real-time alerts
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await apiService.getAlerts();
      setAlerts(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'status-critical';
      case 'warning': return 'status-warning';
      case 'info': return 'status-info';
      default: return 'status-offline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  };

  const filteredAlerts = alerts.filter(alert =>
    filterSeverity === 'all' || alert.severity === filterSeverity
  );

  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);

  if (loading) {
    return <div className="loading">Loading alerts...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            System Alerts
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Monitor and track system alerts and notifications
          </p>
        </div>
        <div className="health-status">
          <span className={`status-badge ${unresolvedAlerts.length === 0 ? 'status-badge-success' : unresolvedAlerts.some(a => a.severity === 'critical') ? 'status-badge-danger' : 'status-badge-warning'}`}>
            {unresolvedAlerts.length} UNRESOLVED
          </span>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: isDark ? '2px solid #404040' : '2px solid var(--border-color)',
        paddingBottom: '0'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: activeTab === 'overview' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'overview' ? (isDark ? '#e0e0e0' : 'var(--text-primary)') : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'overview' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Overview
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          style={{
            background: activeTab === 'alerts' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'alerts' ? (isDark ? '#e0e0e0' : 'var(--text-primary)') : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'alerts' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          All Alerts ({filteredAlerts.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            background: activeTab === 'analytics' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'analytics' ? (isDark ? '#e0e0e0' : 'var(--text-primary)') : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'analytics' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
          </svg>
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="admin-card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              Alert Summary
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: isDark ? '#242424' : 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Alerts</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: isDark ? '#e0e0e0' : '#2c3e50' }}>{alerts.length}</p>
              </div>
              <div style={{ padding: '1rem', background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444' }}>Unresolved</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: '#ef4444' }}>{unresolvedAlerts.length}</p>
              </div>
              <div style={{ padding: '1rem', background: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.1)', borderRadius: '8px', border: isDark ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(220, 38, 38, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#dc2626' }}>Critical</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: '#dc2626' }}>{alerts.filter(a => a.severity === 'critical').length}</p>
              </div>
              <div style={{ padding: '1rem', background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#f59e0b' }}>Warnings</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: '#f59e0b' }}>{alerts.filter(a => a.severity === 'warning').length}</p>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter by Severity
            </h2>
            <div className="form-group">
              <label>Severity Level</label>
              <select
                className="form-control"
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #404040' : '1px solid var(--border-color)',
                  background: isDark ? '#1a1a1a' : 'var(--bg-secondary)',
                  color: isDark ? '#e0e0e0' : '#2c3e50'
                }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: isDark ? '#242424' : 'var(--bg-secondary)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filtered Results</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: '700', color: isDark ? '#e0e0e0' : '#2c3e50' }}>{filteredAlerts.length} alerts</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="admin-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Active Alerts ({filteredAlerts.length})
          </h2>
          {filteredAlerts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-secondary)'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No alerts found</p>
              <p style={{ fontSize: '0.9rem' }}>All systems are running smoothly</p>
            </div>
          ) : (
            <div className="alerts-list">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className={`alert-item ${getSeverityColor(alert.severity)}`} style={{
                  border: isDark ? '1px solid #404040' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  background: isDark ? '#242424' : 'var(--bg-secondary)',
                  transition: 'all 0.2s',
                  borderLeft: `4px solid ${alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`
                }}>
                  <div className="alert-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <span className="alert-icon" style={{ fontSize: '1.5rem' }}>{getSeverityIcon(alert.severity)}</span>
                    <span className="alert-type" style={{
                      background: isDark ? '#1a1a1a' : 'var(--bg-tertiary)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: isDark ? '#e0e0e0' : '#2c3e50'
                    }}>{alert.type.replace('_', ' ').toUpperCase()}</span>
                    <span className="alert-device" style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem'
                    }}>Device: {alert.device_id}</span>
                    <span className="alert-time" style={{
                      marginLeft: 'auto',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem'
                    }}>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="alert-message" style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                    fontSize: '0.95rem'
                  }}>{alert.message}</div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: isDark ? '1px solid #404040' : '1px solid var(--border-color)'
                  }}>
                    <div className="alert-status" style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      background: alert.resolved ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)') : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                      color: alert.resolved ? '#10b981' : '#ef4444'
                    }}>
                      {alert.resolved ? '✓ Resolved' : '● Active'}
                    </div>
                    <AuditTrail 
                      createdBy={alert.created_by_username}
                      createdAt={alert.created_at}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="admin-card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              By Severity
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {[
                { severity: 'critical', count: alerts.filter(a => a.severity === 'critical').length, color: '#ef4444', label: 'Critical' },
                { severity: 'warning', count: alerts.filter(a => a.severity === 'warning').length, color: '#f59e0b', label: 'Warnings' },
                { severity: 'info', count: alerts.filter(a => a.severity === 'info').length, color: '#3b82f6', label: 'Info' }
              ].map(item => (
                <div key={item.severity} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: isDark ? `${item.color}20` : `${item.color}15`,
                  borderRadius: '8px',
                  border: `1px solid ${item.color}40`
                }}>
                  <span style={{ fontWeight: '600', color: item.color }}>{item.label}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: item.color }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              By Status
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <span style={{ fontWeight: '600', color: '#10b981' }}>Resolved</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: '#10b981' }}>{alerts.filter(a => a.resolved).length}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                <span style={{ fontWeight: '600', color: '#ef4444' }}>Unresolved</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: '#ef4444' }}>{unresolvedAlerts.length}</span>
              </div>
              <div style={{
                padding: '1rem',
                background: isDark ? '#242424' : 'var(--bg-secondary)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Resolution Rate</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace', color: isDark ? '#e0e0e0' : '#2c3e50' }}>
                  {alerts.length > 0 ? Math.round((alerts.filter(a => a.resolved).length / alerts.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="admin-card" style={{ gridColumn: 'span 2' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
              Recent Critical Alerts
            </h2>
            {alerts.filter(a => a.severity === 'critical').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p>No critical alerts - system is stable</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {alerts.filter(a => a.severity === 'critical').slice(0, 5).map(alert => (
                  <div key={alert.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '8px',
                    borderLeft: '4px solid #ef4444'
                  }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>{alert.type.replace('_', ' ').toUpperCase()}</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{alert.message}</p>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: alert.resolved ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)') : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                      color: alert.resolved ? '#10b981' : '#ef4444',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem'
                    }}>
                      {alert.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;