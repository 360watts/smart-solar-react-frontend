import { inspectFirmwareBin } from './firmwareImage';

// A minimal ESP-IDF image: magic, chip id, an app descriptor whose version is a git hash, then loose strings.
function image(chip: number, strings: string[]): ArrayBuffer {
  const head = new Uint8Array(112);
  head[0] = 0xE9; head[12] = chip;
  head.set([0x32, 0x54, 0xCD, 0xAB], 32);
  head.set(Array.from('afa5cdd', c => c.charCodeAt(0)), 48);
  const body = Array.from(`\0${strings.join('\0')}\0`, c => c.charCodeAt(0));
  const out = new Uint8Array(head.length + body.length);
  out.set(head); out.set(body, head.length);
  return out.buffer;
}

test('EM26 Arduino build: version from the "Firmware: %s" banner, leading v kept', () => {
  const info = inspectFirmwareBin(image(13, ['   EM26 3-PHASE ENERGY METER (ESP32-C6)', 'esp32-c6-em26-3phase', 'v2.3.5', '   Firmware: %s | Hardware: %s']), 'EM26_Arduino.ino.bin');
  expect(info).toMatchObject({ chip: 'ESP32-C6', version: '2.3.5', usageType: 'energymeter' });
});

test('gateway build: version from the "Firmware v%s" banner, ESP-IDF v-version skipped', () => {
  const info = inspectFirmwareBin(image(9, ['gateway', '1.4.0', 'v5.4.4', 'Firmware v%s']), 'gw.bin');
  expect(info?.version).toBe('1.4.0');
});
