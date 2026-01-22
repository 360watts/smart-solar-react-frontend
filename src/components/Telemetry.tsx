import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
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

const Telemetry: React.FC = () => {
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [filteredData, setFilteredData] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');

  useEffect(() => {
    fetchTelemetryData();
  }, []);

  useEffect(() => {
    filterData();
  }, [telemetryData, selectedDataType, selectedDevice]);

  const fetchTelemetryData = async () => {
    try {
      const data = await apiService.getTelemetry();
      setTelemetryData(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = telemetryData;

    if (selectedDataType !== 'all') {
      filtered = filtered.filter(item => item.data_type === selectedDataType);
    }

    if (selectedDevice !== 'all') {
      filtered = filtered.filter(item => item.deviceId === selectedDevice);
    }

    setFilteredData(filtered);
  };

  const getDataTypes = () => {
    const types = Array.from(new Set(telemetryData.map(item => item.data_type)));
    return types;
  };

  const getDevices = () => {
    const devices = Array.from(new Set(telemetryData.map(item => item.deviceId)));
    return devices;
  };

  const prepareChartData = () => {
    const chartData: { [key: string]: any } = {};
    filteredData.forEach(item => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      if (!chartData[time]) {
        chartData[time] = { time };
      }
      chartData[time][item.data_type] = item.value;
    });
    return Object.values(chartData).slice(-50); // Last 50 data points
  };

  const getLatestValues = () => {
    const latest: { [key: string]: TelemetryData } = {};
    filteredData.forEach(item => {
      const key = `${item.deviceId}-${item.data_type}`;
      if (!latest[key] || new Date(item.timestamp) > new Date(latest[key].timestamp)) {
        latest[key] = item;
      }
    });
    return Object.values(latest);
  };

  const getStatistics = () => {
    if (filteredData.length === 0) return null;

    const values = filteredData.map(item => item.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  };

  if (loading) {
    return <div className="loading">Loading telemetry data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const chartData = prepareChartData();
  const latestValues = getLatestValues();
  const statistics = getStatistics();
  const dataTypes = getDataTypes();
  const devices = getDevices();

  return (
    <div>
      <h1>Telemetry Data</h1>

      <div className="card">
        <h2>Filters</h2>
        <div className="grid">
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Data Type:</label>
            <select
              value={selectedDataType}
              onChange={(e) => setSelectedDataType(e.target.value)}
            >
              <option value="all">All Types</option>
              {dataTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Device:</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              <option value="all">All Devices</option>
              {devices.map(device => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {statistics && (
        <div className="grid">
          <div className="card">
            <h3>Statistics</h3>
            <p><strong>Count:</strong> {statistics.count}</p>
            <p><strong>Average:</strong> {statistics.avg.toFixed(2)}</p>
            <p><strong>Min:</strong> {statistics.min.toFixed(2)}</p>
            <p><strong>Max:</strong> {statistics.max.toFixed(2)}</p>
          </div>
          <div className="card">
            <h3>Latest Values</h3>
            {latestValues.slice(0, 5).map((item, index) => (
              <p key={index}>
                <strong>{item.data_type}:</strong> {item.value} {item.unit}
                <small> ({new Date(item.timestamp).toLocaleTimeString()})</small>
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Telemetry Trends</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              {dataTypes.map((type, index) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Raw Data ({filteredData.length} records)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Data Type</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Timestamp</th>
              <th>Quality</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.slice(-100).reverse().map((item, index) => (
              <tr key={index}>
                <td>{item.deviceId}</td>
                <td>{item.data_type}</td>
                <td>{item.value}</td>
                <td>{item.unit}</td>
                <td>{new Date(item.timestamp).toLocaleString()}</td>
                <td>
                  <span className={item.quality === 'good' ? 'status-online' : 'status-offline'}>
                    {item.quality}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Telemetry;