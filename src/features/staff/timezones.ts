// IANA zone names for site time zones (the backend validates them). Common ones first, then every zone the browser knows.
const COMMON_TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Kathmandu', 'UTC'];
const ALL_TZ: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? COMMON_TZ;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Options for a time zone dropdown; keeps a site's current value selectable even if it is not in the list. */
export const timezoneOptions = (current?: string): string[] =>
  Array.from(new Set([...(current ? [current] : []), ...COMMON_TZ, ...ALL_TZ]));

export const timezoneLabel = (tz: string): string => tz.replace(/_/g, ' ');
