import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import { apiService } from './api';

// Types for socket events
interface SocketEvents {
  // Telemetry updates for a specific site
  telemetry: (data: {
    siteId: string;
    timestamp: string;
    pv1_power_w: number | null;
    pv2_power_w: number | null;
    pv3_power_w: number | null;
    pv4_power_w: number | null;
    load_power_w: number | null;
    grid_power_w: number | null;
    battery_soc_percent: number | null;
    battery_power_w: number | null;
    inverter_temp_c: number | null;
    grid_frequency_hz: number | null;
    grid_voltage_v: number | null;
    grid_l1_power_w: number | null;
    grid_l2_power_w: number | null;
    grid_l3_power_w: number | null;
    grid_l1_voltage_v: number | null;
    grid_l2_voltage_v: number | null;
    grid_l3_voltage_v: number | null;
    grid_l1_current_a: number | null;
    grid_l2_current_a: number | null;
    grid_l3_current_a: number | null;
    load_l1_power_w: number | null;
    load_l2_power_w: number | null;
    load_l3_power_w: number | null;
    run_state: number | null;
    data_source: string | null;
    data_stale: boolean | null;
    pv_today_kwh: number | null;
    pv_total_kwh: number | null;
    ac_output_power_w: number | null;
    dc_temp_c: number | null;
  }) => void;

  // Gateway status updates
  gatewayStatus: (data: {
    siteId: string;
    is_online: boolean;
    last_heartbeat: string | null;
    age_seconds: number | null;
    serial: string | null;
  }) => void;

  // Smart device updates
  smartDeviceUpdate: (data: {
    siteId: string;
    deviceId: number;
    power_w: number | null;
    current_a: number | null;
    voltage_v: number | null;
    energy_kwh: number | null;
    switch_on: boolean | null;
    timestamp: string;
  }) => void;

  // Energy meter updates
  energyMeterUpdate: (data: {
    siteId: string;
    reading: any; // CtMeterReading type from api.ts
  }) => void;

  // Alerts/Incidents
  alert: (data: any) => void; // AlertItem or IncidentItem
  incident: (data: any) => void;

  // Initial-data seed events (requestInitialData only, not pushed by the server)
  forecast: (data: any) => void;
  weather: (data: any) => void;

  // System events
  connect: () => void;
  disconnect: (reason: string) => void;
  reconnect: (attempt: number) => void;
  reconnect_attempt: (attempt: number) => void;
  reconnect_error: (error: Error) => void;
  reconnect_failed: () => void;
}

class SocketService {
  private socket: Socket | null = null;
  private readonly namespace = '/telemetry'; // Using a dedicated namespace
  private connected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event listeners storage
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private errorListeners: Map<string, Set<(error: Error) => void>> = new Map();

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    // Get auth token
    const token = localStorage.getItem('authTokens');
    const accessToken = token ? JSON.parse(token).access : null;

    if (!accessToken) {
      console.warn('Socket.io: No auth token available');
      return;
    }

    // Determine socket URL from API_BASE_URL
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.360watts.com/api';
    const socketUrl = apiUrl.replace(/\/api$/, ''); // Remove /api suffix

    this.socket = io(socketUrl, {
      path: `${this.namespace}/socket.io`,
      auth: {
        token: accessToken
      },
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
      transports: ['websocket', 'polling'] // Try WS first, fallback to polling
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('Socket.IO connected');
      this.emitEvent('connect');
    });

    this.socket.on('disconnect', (reason: string) => {
      this.connected = false;
      console.log(`Socket.IO disconnected: ${reason}`);
      this.emitEvent('disconnect', reason);

      // Handle reconnection logic
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, likely auth issue
        this.handleAuthError();
      } else if (reason !== 'io client disconnect') {
        // Manual disconnect or network issue
        this.scheduleReconnect();
      }
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      this.emitEvent('reconnect_attempt', attempt);
    });

    this.socket.on('reconnect', (attempt: number) => {
      this.reconnectAttempts = 0;
      console.log(`Socket.IO reconnected after ${attempt} attempts`);
      this.emitEvent('reconnect', attempt);
    });

    this.socket.on('reconnect_error', (error: Error) => {
      console.error('Socket.IO reconnect error:', error);
      this.emitEvent('reconnect_error', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnect failed after max attempts');
      this.emitEvent('reconnect_failed');
    });

    // Data event handlers - map to our custom events
    this.socket.on('telemetry', (data: any) => this.emitEvent('telemetry', data));
    this.socket.on('gateway_status', (data: any) => this.emitEvent('gatewayStatus', data));
    this.socket.on('smart_device_update', (data: any) => this.emitEvent('smartDeviceUpdate', data));
    this.socket.on('energy_meter_update', (data: any) => this.emitEvent('energyMeterUpdate', data));
    this.socket.on('alert', (data: any) => this.emitEvent('alert', data));
    this.socket.on('incident', (data: any) => this.emitEvent('incident', data));
  }

  private handleAuthError() {
    // Clear auth and redirect to login
    localStorage.removeItem('authTokens');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s...
    const delay = Math.min(1000 * 2 ** Math.min(this.reconnectAttempts, 4), 30000);

    this.reconnectTimeout = setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  // Public API methods
  connect() {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  on<T extends keyof SocketEvents>(event: T, callback: SocketEvents[T], onError?: (error: Error) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (onError) {
      if (!this.errorListeners.has(event)) {
        this.errorListeners.set(event, new Set());
      }
      this.errorListeners.get(event)!.add(onError);
    }

    // Return unsubscribe function
    return () => {
      this.off(event, callback, onError);
    };
  }

  off<T extends keyof SocketEvents>(event: T, callback: SocketEvents[T], onError?: (error: Error) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
    if (onError) {
      const errorListeners = this.errorListeners.get(event);
      if (errorListeners) {
        errorListeners.delete(onError);
        if (errorListeners.size === 0) {
          this.errorListeners.delete(event);
        }
      }
    }
  }

  private emitEvent<T extends keyof SocketEvents>(event: T, ...args: Parameters<SocketEvents[T]>) {
    const listeners = this.listeners.get(event);
    listeners?.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in socket event handler for ${event}:`, error);
        this.errorListeners.get(event)?.forEach(onError => onError(error as Error));
      }
    });
  }

  // Room joining methods for specific data streams
  joinSiteRoom(siteId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_site', { siteId });
    }
  }

  leaveSiteRoom(siteId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_site', { siteId });
    }
  }

  joinDeviceRoom(deviceId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_device', { deviceId });
    }
  }

  leaveDeviceRoom(deviceId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_device', { deviceId });
    }
  }

  // Request initial data (useful on mount)
  async requestInitialData(siteId: string) {
    try {
      // Fetch initial data via REST to populate state immediately
      const [telemetry, forecast, weather, , gatewayStatus] = await Promise.all([
        apiService.getSiteTelemetry(siteId, { aggregate: '5min' }),
        apiService.getSiteForecast(siteId, {}),
        apiService.getSiteWeather(siteId),
        apiService.getSmartDevices(siteId),
        apiService.getGatewayStatus(siteId)
      ]);

      // Emit initial data events so consumers can set state
      if (telemetry.length > 0) {
        this.emitEvent('telemetry', { ...telemetry[telemetry.length - 1], siteId });
      }
      this.emitEvent('gatewayStatus', {
        siteId,
        is_online: gatewayStatus?.is_online ?? false,
        last_heartbeat: gatewayStatus?.last_heartbeat ?? null,
        age_seconds: gatewayStatus?.age_seconds ?? null,
        serial: gatewayStatus?.serial ?? null,
      });
      // smartDeviceUpdate is per-device (deviceId/power_w/...); `smartDevices` here is the
      // full list, so there's no single event to seed it with — consumers should read the
      // initial list straight from apiService.getSmartDevices rather than through the socket.
      this.emitEvent('forecast', forecast);
      this.emitEvent('weather', weather);

    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;

// Custom hook for easier consumption in React components
export const useSocket = <T extends keyof SocketEvents>(event: T) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = socketService.on(event, ((payload: any) => {
      setData(payload);
      setError(null);
    }) as SocketEvents[T], (err: Error) => {
      setError(err);
      setData(null);
    });

    return () => {
      unsubscribe();
    };
  }, [event]);

  return { data, error, isConnected: socketService.isConnected() };
};