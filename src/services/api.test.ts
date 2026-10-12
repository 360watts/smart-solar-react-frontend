import { apiService } from './api';

describe('apiService.getSiteIncidents', () => {
  it('maps the paginated incidents response into IncidentItem[]', async () => {
    const mockResponse = {
      count: 1,
      limit: 50,
      offset: 0,
      results: [{
        id: 42,
        device_id: 7,
        device_serial: 'ABC123',
        category: 'connectivity',
        incident_type: 'device_offline',
        incident_type_title: 'Device Offline',
        severity: 'warning',
        status: 'resolved',
        ts_start: '2026-06-01T10:00:00Z',
        ts_end: '2026-06-01T11:00:00Z',
        duration_seconds: 3600,
        title: 'Device Offline',
        summary: '',
        detected_by: 'connectivity_monitor',
        evidence_count: 1,
      }],
    };
    jest.spyOn(apiService as any, 'request').mockResolvedValue(mockResponse);

    const result = await apiService.getSiteIncidents('coim_002');

    expect(result.count).toBe(1);
    expect(result.results[0].category).toBe('connectivity');
    expect(result.results[0].evidenceCount).toBe(1);
  });
});

describe('access list refresh', () => {
  beforeEach(() => { jest.restoreAllMocks(); }); // earlier tests stub request()
  const refuse = (body: object) => {
    const text = JSON.stringify(body);
    const res: any = { ok: false, status: 403, statusText: 'Forbidden', headers: { get: () => null }, text: async () => text, json: async () => body };
    res.clone = () => res;
    (globalThis as any).fetch = jest.fn().mockResolvedValue(res);
  };

  it('asks the app to re-read access when a request is refused with DEVICE_OPS_OFF, and only then', async () => {
    const seen = jest.fn();
    window.addEventListener('360w:access-changed', seen);
    refuse({ error: 'Device operations are turned off for your account.', code: 'DEVICE_OPS_OFF' });
    await expect(apiService.rebootDevice(1)).rejects.toThrow(/turned off/i);
    expect(seen).toHaveBeenCalledTimes(1);
    refuse({ error: 'nope', code: 'ROLE_FORBIDDEN' });
    await expect(apiService.rebootDevice(1)).rejects.toThrow();
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener('360w:access-changed', seen);
  });
});
