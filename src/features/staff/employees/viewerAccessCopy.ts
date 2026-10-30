/**
 * What a viewer can and cannot do, in plain words, for the viewer Profile page.
 *
 * KEEP IN SYNC with smart-solar-django-backend/api/staff_roles.py (viewer tier, DEVICE_OPS, DEVICE_SCOPED).
 */

/** Operations on the devices given to the viewer; all sit behind the per-person device-control switch. */
export const VIEWER_OPERATIONS: string[] = [
  'Reboot a device',
  'Hard reset (you type the serial to confirm)',
  'Mute and unmute the buzzer',
  'Turn auto restart on or off',
  'Turn detailed telemetry on or off',
  'Fetch logs',
  'Run diagnostics',
  'Update firmware and roll back (one device at a time)',
  'Set the APN',
  'Calibrate meters',
  'Set the meter publish interval',
];

/** Always allowed for a viewer. */
export const VIEWER_ALWAYS: string[] = ['See readings, charts and logs'];

/** Never allowed for a viewer. */
export const VIEWER_NEVER: string[] = [
  'Change Wi-Fi settings',
  'Update many devices at once (fleet-wide OTA)',
  "See other customers' devices",
  'Manage staff or users',
];
