import { compareVersions, deviceState, direction, fits, sameVersion, toDevice, type Build } from './otaModel';

const build = (over: Partial<Build>): Build => ({ id: 1, version: '1.0.7', type: 'gateway', chip: 'ESP32', size: 1000, notes: '', on: false, uploadedAt: '', ...over });

describe('compareVersions', () => {
  it('orders by number, not text', () => {
    expect(['1.0.9', '1.0.10', '1.0.2'].sort(compareVersions)).toEqual(['1.0.2', '1.0.9', '1.0.10']);
  });
  it('puts a tagged build just before the plain one', () => {
    expect(['1.0.8', '1.0.8-rc1', '1.0.7'].sort(compareVersions)).toEqual(['1.0.7', '1.0.8-rc1', '1.0.8']);
  });
  it('ignores a leading v and sorts a missing version first', () => {
    expect(compareVersions('v2.2.3', '2.2.3')).toBe(0);
    expect([null, '1.0.0'].sort(compareVersions)).toEqual([null, '1.0.0']);
  });
});

describe('direction', () => {
  it('names upgrades, downgrades and no-ops', () => {
    expect(direction('1.0.6', '1.0.7')).toBe('up');
    expect(direction('1.0.7', '1.0.5')).toBe('down');
    expect(direction('v2.2.3-3P', '2.2.3')).toBe('same');
    expect(direction(null, '1.0.5')).toBe('up');
  });
  it('treats a tag as the same version, as the backend does', () => {
    expect(sameVersion('1.0.8', '1.0.8-rc1')).toBe(true);
  });
});

describe('fits', () => {
  it('needs the same usage type', () => {
    expect(fits(build({ type: 'energymeter' }), { type: 'gateway', chip: 'ESP32' })).toBe(false);
    expect(fits(build({}), { type: 'gateway', chip: 'ESP32' })).toBe(true);
  });
  it('refuses a known chip clash but allows unknowns', () => {
    expect(fits(build({ chip: 'ESP32-S3' }), { type: 'gateway', chip: 'ESP32' })).toBe(false);
    expect(fits(build({ chip: null }), { type: 'gateway', chip: 'ESP32' })).toBe(true);
    expect(fits(build({}), { type: 'gateway', chip: null })).toBe(true);
  });
});

describe('deviceState', () => {
  it('reads the status row', () => {
    expect(deviceState({ pending_rollback: true, has_active_target: true })).toBe('rollback');
    expect(deviceState({ has_active_target: true, log_status: 'downloading' })).toBe('download');
    expect(deviceState({ has_active_target: true, log_status: 'available' })).toBe('wait');
    expect(deviceState({ has_active_target: false, log_status: 'failed' })).toBe('fail');
    expect(deviceState({ has_active_target: false, log_status: 'completed' })).toBe('ok');
    expect(deviceState({ has_active_target: false, log_status: null })).toBe('none');
  });
  it('works out download progress from the build size', () => {
    const d = toDevice({ device_serial: 'GW', has_active_target: true, log_status: 'downloading', log_firmware_id: 1, log_bytes_downloaded: 250 }, [build({})]);
    expect(d.pct).toBe(25);
  });
});
