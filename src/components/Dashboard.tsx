import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { apiService } from '../services/api';

interface TelemetryData {
  deviceId: string;
  timestamp: string;
  data_type: string;
  value: number;
  unit: string;
  slave_id?: number;
  register_label?: string;
  quality: string;
}

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  timestamp: string;
  resolved: boolean;
}

interface KPIs {
  total_energy_generated: number;
  average_voltage: number;
  average_current: number;
  system_efficiency: number;
  data_points_last_24h: number;
  active_devices_24h: number;
}

interface SystemHealth {
  total_devices: number;
  active_devices: number;
  total_telemetry_points: number;
  uptime_seconds: number;
  database_status: string;
  mqtt_status: string;
  overall_health: string;
}

const Dashboard: React.FC = () => {
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [telemetry, alertsData, kpisData, healthData] = await Promise.all([
        apiService.getTelemetry(),
        apiService.getAlerts(),
        apiService.getKPIs(),
        apiService.getSystemHealth()
      ]);
      
      setTelemetryData(telemetry);
      setAlerts(alertsData);
      setKpis(kpisData);
      setSystemHealth(healthData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const getLatestValues = () => {
    const latest: { [key: string]: TelemetryData } = {};
    telemetryData.forEach(item => {
      if (!latest[item.data_type] || new Date(item.timestamp) > new Date(latest[item.data_type].timestamp)) {
        latest[item.data_type] = item;
      }
    });
    return Object.values(latest);
  };

  const prepareChartData = () => {
    const chartData: { [key: string]: any } = {};
    telemetryData.forEach(item => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      if (!chartData[time]) {
        chartData[time] = { time };
      }
      chartData[time][item.data_type] = item.value;
    });
    return Object.values(chartData).slice(-20); // Last 20 data points
  };

  const getDeviceStatusData = () => {
    if (!systemHealth) return [];
    return [
      { name: 'Active', value: systemHealth.active_devices, color: '#4caf50' },
      { name: 'Inactive', value: systemHealth.total_devices - systemHealth.active_devices, color: '#f44336' }
    ];
  };

  const getAlertSeverityData = () => {
    const critical = alerts.filter(a => a.severity === 'critical').length;
    const warning = alerts.filter(a => a.severity === 'warning').length;
    const info = alerts.filter(a => a.severity === 'info').length;
    return [
      { name: 'Critical', value: critical, color: '#f44336' },
      { name: 'Warning', value: warning, color: '#ff9800' },
      { name: 'Info', value: info, color: '#2196f3' }
    ];
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const latestValues = getLatestValues();
  const chartData = prepareChartData();
  const deviceStatusData = getDeviceStatusData();
  const alertSeverityData = getAlertSeverityData();
  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);

  return (
    <div>
      <h1>Smart Solar Dashboard</h1>

      {/* System Overview Cards */}
      <div className="grid">
        {systemHealth && (
          <>
            <div className="card">
              <h3>System Health</h3>
              <div className={`status-indicator ${systemHealth.overall_health === 'healthy' ? 'status-online' : 'status-warning'}`}>
                {systemHealth.overall_health.toUpperCase()}
              </div>
              <p><strong>Active Devices:</strong> {systemHealth.active_devices}/{systemHealth.total_devices}</p>
            </div>

            <div className="card">
              <h3>Active Alerts</h3>
              <p className="metric-large">{unresolvedAlerts.length}</p>
              <p className="metric-label">Require Attention</p>
              {unresolvedAlerts.length > 0 && (
                <div className="alert-preview">
                  {unresolvedAlerts.slice(0, 2).map(alert => (
                    <div key={alert.id} className="alert-item-mini">
                      {alert.severity === 'critical' ? '🚨' : '⚠️'} {alert.message.substring(0, 30)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {kpis && (
          <>
            <div className="card">
              <h3>Energy Generated</h3>
              <p className="metric-large">{kpis.total_energy_generated.toFixed(2)} kWh</p>
              <p className="metric-label">Last 24 Hours</p>
            </div>

            <div className="card">
              <h3>System Efficiency</h3>
              <p className="metric-large">{kpis.system_efficiency.toFixed(1)}%</p>
              <p className="metric-label">Overall Performance</p>
            </div>
          </>
        )}
      </div>

      {/* Real-time Metrics */}
      <div className="grid">
        {latestValues.map((item) => (
          <div key={item.data_type} className="card metric-card">
            <h3>{item.data_type.charAt(0).toUpperCase() + item.data_type.slice(1)}</h3>
            <p className="metric-value">{item.value.toFixed(2)} <span className="metric-unit">{item.unit}</span></p>
            <p className="metric-timestamp">Updated: {new Date(item.timestamp).toLocaleTimeString()}</p>
            <p className={`status-indicator ${item.quality === 'good' ? 'status-online' : 'status-offline'}`}>
              Quality: {item.quality}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid">
        <div className="card">
          <h2>Real-time Trends</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                {latestValues.map((item, index) => (
                  <Line
                    key={item.data_type}
                    type="monotone"
                    dataKey={item.data_type}
                    stroke={`hsl(${index * 60}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>Device Status</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {deviceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts Overview */}
      {alerts.length > 0 && (
        <div className="card">
          <h2>Alert Distribution</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertSeverityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {alertSeverityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid">
        <div className="card">
          <h3>Recent Telemetry</h3>
          <div className="activity-list">
            {telemetryData.slice(0, 5).map((item, index) => (
              <div key={index} className="activity-item">
                <span className="activity-icon">📊</span>
                <span className="activity-text">
                  {item.data_type}: {item.value.toFixed(2)} {item.unit} from {item.deviceId}
                </span>
                <span className="activity-time">{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Recent Alerts</h3>
          <div className="activity-list">
            {alerts.slice(0, 5).map((alert, index) => (
              <div key={index} className="activity-item">
                <span className="activity-icon">{alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <span className="activity-text">{alert.message}</span>
                <span className="activity-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;