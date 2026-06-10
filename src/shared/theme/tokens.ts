import { darkChartColors, lightChartColors } from './chartColors';
import type { DesignTokens } from './types';

export const lightTokens: DesignTokens = {
  pageBg: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EEF3F0',
  text: '#12151A',
  textMuted: 'rgba(18,21,26,0.62)',
  textDim: 'rgba(18,21,26,0.38)',
  textInverse: '#0A0E1A',
  border: 'rgba(18,21,26,0.09)',
  borderStrong: 'rgba(18,21,26,0.16)',
  focus: '#2FBF71',
  primary: '#2FBF71',
  primaryHover: '#1A9955',
  primarySoft: 'rgba(47,191,113,0.12)',
  secondary: '#E9B949',
  secondarySoft: 'rgba(233,185,73,0.14)',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.14)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.12)',
  info: '#3B82F6',
  infoSoft: 'rgba(59,130,246,0.12)',
  shadow: '0 1px 3px rgba(18,21,26,0.07), 0 12px 30px rgba(18,21,26,0.07)',
  charts: lightChartColors,
};

export const darkTokens: DesignTokens = {
  pageBg: '#080C14',
  surface: '#0F1623',
  surfaceRaised: '#111927',
  surfaceMuted: '#131B2E',
  text: '#F0F4FF',
  textMuted: 'rgba(240,244,255,0.62)',
  textDim: 'rgba(240,244,255,0.42)',
  textInverse: '#0A0E1A',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  focus: '#5BBD79',
  primary: '#2FBF71',
  primaryHover: '#5BBD79',
  primarySoft: 'rgba(47,191,113,0.14)',
  secondary: '#E9B949',
  secondarySoft: 'rgba(233,185,73,0.16)',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.16)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.16)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.16)',
  info: '#60A5FA',
  infoSoft: 'rgba(96,165,250,0.16)',
  shadow: '0 2px 12px rgba(0,0,0,0.22), 0 18px 42px rgba(0,0,0,0.32)',
  charts: darkChartColors,
};

export function getDesignTokens(isDark: boolean): DesignTokens {
  return isDark ? darkTokens : lightTokens;
}
