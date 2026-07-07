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
