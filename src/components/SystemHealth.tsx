import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface SystemHealthData {
  total_devices: number;
  active_devices: number;
  total_telemetry_points: number;
  uptime_seconds: number;
  database_status: string;
  mqtt_status: string;
  overall_health: string;
}

const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemHealth();
    // Refresh health data every 60 seconds
    const interval = setInterval(fetchSystemHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const data = await apiService.getSystemHealth();
      setHealth(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'status-online';
      case 'warning': return 'status-warning';
      case 'critical': return 'status-critical';
      default: return 'status-offline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  if (loading) {
    return <div className="loading">Loading system health...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!health) {
    return <div className="error">No health data available</div>;
  }

  const deviceUptime = (health.active_devices / health.total_devices) * 100;

  return (
    <div>
      <h1>System Health Dashboard</h1>

      <div className="grid">
        <div className="card">
          <h3>Overall System Status</h3>
          <div className={`status-indicator ${getStatusColor(health.overall_health)}`}>
            {getStatusIcon(health.overall_health)} {health.overall_health.toUpperCase()}
          </div>
        </div>

        <div className="card">
          <h3>System Uptime</h3>
          <p className="metric-large">{formatUptime(health.uptime_seconds)}</p>
          <p className="metric-label">Since first telemetry</p>
        </div>

        <div className="card">
          <h3>Device Connectivity</h3>
          <p className="metric-large">{health.active_devices}/{health.total_devices}</p>
          <p className="metric-label">Active/Total Devices</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${deviceUptime}%` }}
            ></div>
          </div>
          <p className="metric-small">{deviceUptime.toFixed(1)}% uptime</p>
        </div>

        <div className="card">
          <h3>Data Collection</h3>
          <p className="metric-large">{health.total_telemetry_points.toLocaleString()}</p>
          <p className="metric-label">Total Data Points</p>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Service Status</h3>
          <div className="service-status">
            <div className="service-item">
              <span className="service-name">Database</span>
              <span className={`service-status ${getStatusColor(health.database_status)}`}>
                {getStatusIcon(health.database_status)} {health.database_status}
              </span>
            </div>
            <div className="service-item">
              <span className="service-name">MQTT Broker</span>
              <span className={`service-status ${getStatusColor(health.mqtt_status)}`}>
                {getStatusIcon(health.mqtt_status)} {health.mqtt_status}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Performance Metrics</h3>
          <div className="metrics-list">
            <div className="metric-item">
              <span>Data Points/Hour:</span>
              <span>{(health.total_telemetry_points / (health.uptime_seconds / 3600)).toFixed(1)}</span>
            </div>
            <div className="metric-item">
              <span>Avg Data/Device:</span>
              <span>{health.total_devices > 0 ? (health.total_telemetry_points / health.total_devices).toFixed(0) : '0'}</span>
            </div>
            <div className="metric-item">
              <span>Active Device Ratio:</span>
              <span>{deviceUptime.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>System Information</h3>
        <div className="system-info">
          <p><strong>Last Updated:</strong> {new Date().toLocaleString()}</p>
          <p><strong>Monitoring Since:</strong> {new Date(Date.now() - health.uptime_seconds * 1000).toLocaleString()}</p>
          <p><strong>API Status:</strong> <span className="status-online">Connected</span></p>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;