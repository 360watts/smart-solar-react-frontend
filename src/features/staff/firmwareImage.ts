// Reading an ESP-IDF firmware image in the browser, shared by the OTA page and the device page's Builds card.
// Firmware rows name the device kind 'gateway' | 'energymeter'; a device row says 'gateway' | 'energy_meter'.

/** The firmware table's name for a device's kind (the device row has an underscore, the firmware row does not). */
export const firmwareKind = (deviceType?: string | null) => (deviceType === 'energy_meter' ? 'energymeter' : deviceType ?? '');

export const CHIP_NAMES: Record<number, string> = {
  0: 'ESP32', 2: 'ESP32-S2', 5: 'ESP32-C3', 9: 'ESP32-S3', 12: 'ESP32-C2', 13: 'ESP32-C6', 16: 'ESP32-H2',
};

export interface FirmwareInfo { chip: string | null; version: string; usageType: 'gateway' | 'energymeter' | null; name: string }

// Best-effort read of an ESP-IDF app image: chip from the header, version/usage/name from embedded strings.
export function inspectFirmwareBin(buf: ArrayBuffer, fileName: string): FirmwareInfo | null {
  const u8 = new Uint8Array(buf);
  if (u8.length < 24 || u8[0] !== 0xE9) return null;
  const chip = CHIP_NAMES[u8[12] | (u8[13] << 8)] ?? null;
  let text = '';
  for (let i = 0; i < u8.length; i += 32768) text += String.fromCharCode(...u8.subarray(i, i + 32768));
  const runs = text.match(/[\x20-\x7e]{4,80}/g) ?? [];
  const semver = /^v?(\d+\.\d+\.\d+)(?:-[\w.]+)?$/;
  // The app descriptor (magic 0xABCD5432 at byte 32) holds the project version at byte 48. Scanning loose strings
  // picks up the ESP-IDF version ("v5.4.4"), so only trust the descriptor; blank means the user types it.
  const hasDesc = u8.length >= 80 && u8[32] === 0x32 && u8[33] === 0x54 && u8[34] === 0xCD && u8[35] === 0xAB;
  let verRun = hasDesc ? text.slice(48, 80).split('\0')[0] : '';
  // Older builds leave the descriptor as a git hash. Fall back to FIRMWARE_VERSION, which the compiler stores
  // just before the "Firmware v%s" boot-banner format string (a few log-format runs may sit between them).
  if (!semver.test(verRun)) {
    const banner = runs.findIndex(r => r.includes('Firmware v%s'));
    verRun = banner < 0 ? '' : runs.slice(Math.max(0, banner - 4), banner).reverse().find(r => semver.test(r) && !r.startsWith('v')) ?? '';
  }
  const meterRun = runs.find(r => /energy ?meter/i.test(r) && !/[{}"<>%/]/.test(r));
  const usageType = meterRun || runs.some(r => /\bEM\d{2}\b/.test(r)) ? 'energymeter'
    : runs.some(r => /gateway/i.test(r)) ? 'gateway' : null;
  return {
    chip,
    version: verRun.match(semver)?.[1] ?? '',
    usageType,
    name: (meterRun ?? fileName.replace(/\.bin$/i, '')).trim(),
  };
}

