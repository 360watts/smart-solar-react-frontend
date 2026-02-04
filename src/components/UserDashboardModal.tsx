import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { apiService } from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
}

interface Device {
  id: number;
  device_serial: string;
  user: string;
  provisioned_at: string;
  config_version?: string;
}

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

interface UserDashboardModalProps {
  user: User;
  onClose: () => void;
}

const UserDashboardModal: React.FC<UserDashboardModalProps> = ({ user, onClose }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDashboardData();
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchUserDashboardData, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchUserDashboardData = async () => {
    try {
      // Fetch user's devices
      const allDevices = await apiService.getDevices();
      const userDevices = allDevices.filter((d: Device) => d.user === user.username);
      setDevices(userDevices);

      // Fetch telemetry for user's devices
      const allTelemetry = await apiService.getTelemetry();
      const deviceSerials = userDevices.map(d => d.device_serial);
      const userTelemetry = allTelemetry.filter((t: TelemetryData) => 
        deviceSerials.includes(t.deviceId)
      );
      setTelemetryData(userTelemetry);

      // Fetch alerts for user's devices
      const allAlerts = await apiService.getAlerts();
      const userAlerts = allAlerts.filter((a: Alert) => 
        deviceSerials.includes(a.device_id)
      );
      setAlerts(userAlerts);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const getLatestValues = () => {
    const latest: { [key: string]: TelemetryData } = {};
    telemetryData.forEach(item => {
      const key = `${item.deviceId}-${item.data_type}`;
      if (!latest[key] || new Date(item.timestamp) > new Date(latest[key].timestamp)) {
        latest[key] = item;
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
    return Object.values(chartData).slice(-20);
  };

  const calculateKPIs = () => {
    const recent24h = telemetryData.filter(t => 
      new Date(t.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const voltageReadings = recent24h.filter(t => t.data_type === 'voltage').map(t => t.value);
    const currentReadings = recent24h.filter(t => t.data_type === 'current').map(t => t.value);
    const powerReadings = recent24h.filter(t => t.data_type === 'power').map(t => t.value);

    const avgVoltage = voltageReadings.length > 0 
      ? voltageReadings.reduce((a, b) => a + b, 0) / voltageReadings.length 
      : 0;
    const avgCurrent = currentReadings.length > 0 
      ? currentReadings.reduce((a, b) => a + b, 0) / currentReadings.length 
      : 0;
    const totalEnergy = powerReadings.length > 0 
      ? (powerReadings.reduce((a, b) => a + b, 0) * 24 / 1000) 
      : 0;
    const efficiency = avgVoltage > 0 && avgCurrent > 0 
      ? Math.min(100, (avgVoltage * avgCurrent) / 100) 
      : 0;

    return {
      totalEnergy,
      avgVoltage,
      avgCurrent,
      efficiency,
      dataPoints: recent24h.length,
      activeDevices: new Set(recent24h.map(t => t.deviceId)).size
    };
  };

  const getDeviceStatusData = () => {
    const now = Date.now();
    const activeDevices = devices.filter(d => {
      const lastData = telemetryData
        .filter(t => t.deviceId === d.device_serial)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      return lastData && (now - new Date(lastData.timestamp).getTime()) < 5 * 60 * 1000;
    });

    return [
      { name: 'Active', value: activeDevices.length, color: '#4caf50' },
      { name: 'Inactive', value: devices.length - activeDevices.length, color: '#f44336' }
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
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
          <div className="loading">Loading user dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
          <div className="error">Error: {error}</div>
        </div>
      </div>
    );
  }

  const latestValues = getLatestValues();
  const chartData = prepareChartData();
  const deviceStatusData = getDeviceStatusData();
  const alertSeverityData = getAlertSeverityData();
  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);
  const kpis = calculateKPIs();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Dashboard - {user.first_name} {user.last_name}</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-body dashboard-modal-body">
          {/* User Info */}
          <div className="card user-info-card">
            <div className="user-details">
              <p><strong>Username:</strong> {user.username}</p>
              <p><strong>Email:</strong> {user.email}</p>
              {user.mobile_number && <p><strong>Mobile:</strong> {user.mobile_number}</p>}
              {user.address && <p><strong>Address:</strong> {user.address}</p>}
            </div>
            <div className="user-stats">
              <p><strong>Total Devices:</strong> {devices.length}</p>
              <p><strong>Active Now:</strong> {deviceStatusData[0].value}</p>
              <p><strong>Alerts:</strong> {unresolvedAlerts.length}</p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid">
            <div className="card">
              <h3>Energy Generated</h3>
              <p className="metric-large">{kpis.totalEnergy.toFixed(2)} kWh</p>
              <p className="metric-label">Last 24 Hours</p>
            </div>

            <div className="card">
              <h3>System Efficiency</h3>
              <p className="metric-large">{kpis.efficiency.toFixed(1)}%</p>
              <p className="metric-label">Overall Performance</p>
            </div>

            <div className="card">
              <h3>Avg Voltage</h3>
              <p className="metric-large">{kpis.avgVoltage.toFixed(2)} V</p>
              <p className="metric-label">24-Hour Average</p>
            </div>

            <div className="card">
              <h3>Avg Current</h3>
              <p className="metric-large">{kpis.avgCurrent.toFixed(2)} A</p>
              <p className="metric-label">24-Hour Average</p>
            </div>
          </div>

          {/* Latest Readings */}
          {latestValues.length > 0 && (
            <div className="grid">
              {latestValues.slice(0, 4).map((item) => (
                <div key={`${item.deviceId}-${item.data_type}`} className="card metric-card">
                  <h3>{item.data_type.charAt(0).toUpperCase() + item.data_type.slice(1)}</h3>
                  <p className="metric-value">{item.value.toFixed(2)} <span className="metric-unit">{item.unit}</span></p>
                  <p className="metric-timestamp">Device: {item.deviceId}</p>
                  <p className="metric-timestamp">Updated: {new Date(item.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid">
            <div className="card">
              <h2>Real-time Trends</h2>
              {chartData.length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {Array.from(new Set(latestValues.map(v => v.data_type))).map((dataType, index) => (
                        <Line
                          key={dataType}
                          type="monotone"
                          dataKey={dataType}
                          stroke={`hsl(${index * 60}, 70%, 50%)`}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p>No telemetry data available</p>
              )}
            </div>

            <div className="card">
              <h2>Device Status</h2>
              {devices.length > 0 ? (
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
              ) : (
                <p>No devices assigned to this user</p>
              )}
            </div>
          </div>

          {/* Alerts */}
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

          {/* Devices List */}
          <div className="card">
            <h3>User Devices</h3>
            {devices.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Device Serial</th>
                    <th>Config Version</th>
                    <th>Provisioned At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const lastData = telemetryData
                      .filter(t => t.deviceId === device.device_serial)
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    const isActive = lastData && (Date.now() - new Date(lastData.timestamp).getTime()) < 5 * 60 * 1000;
                    
                    return (
                      <tr key={device.id}>
                        <td>{device.device_serial}</td>
                        <td>{device.config_version || 'N/A'}</td>
                        <td>{new Date(device.provisioned_at).toLocaleString()}</td>
                        <td>
                          <span className={`status-indicator ${isActive ? 'status-online' : 'status-offline'}`}>
                            {isActive ? 'Active' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>No devices assigned to this user</p>
            )}
          </div>

          {/* Recent Alerts */}
          {unresolvedAlerts.length > 0 && (
            <div className="card">
              <h3>Active Alerts ({unresolvedAlerts.length})</h3>
              <div className="activity-list">
                {unresolvedAlerts.slice(0, 5).map((alert, index) => (
                  <div key={index} className="activity-item">
                    <span className="activity-icon">{alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span className="activity-text">{alert.message}</span>
                    <span className="activity-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboardModal;
