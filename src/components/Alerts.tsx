import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  timestamp: string;
  resolved: boolean;
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

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
    <div>
      <h1>System Alerts</h1>

      <div className="grid-cols-2">
        <div className="card">
          <h3>Alert Summary</h3>
          <p><strong>Total Alerts:</strong> {alerts.length}</p>
          <p><strong>Unresolved:</strong> {unresolvedAlerts.length}</p>
          <p><strong>Critical:</strong> {alerts.filter(a => a.severity === 'critical').length}</p>
          <p><strong>Warnings:</strong> {alerts.filter(a => a.severity === 'warning').length}</p>
        </div>

        <div className="card">
          <h3>Filter by Severity</h3>
          <div className="form-group">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Active Alerts ({filteredAlerts.length})</h2>
        {filteredAlerts.length === 0 ? (
          <p>No alerts found.</p>
        ) : (
          <div className="alerts-list">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${getSeverityColor(alert.severity)}`}>
                <div className="alert-header">
                  <span className="alert-icon">{getSeverityIcon(alert.severity)}</span>
                  <span className="alert-type">{alert.type.replace('_', ' ').toUpperCase()}</span>
                  <span className="alert-device">Device: {alert.device_id}</span>
                  <span className="alert-time">{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-status">
                  Status: {alert.resolved ? 'Resolved' : 'Active'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;