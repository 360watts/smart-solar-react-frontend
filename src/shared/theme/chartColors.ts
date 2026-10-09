import type { ChartTokens } from './types';

export const lightChartColors: ChartTokens = {
  pv: '#E9B949',
  load: '#3B82F6',
  battery: 'var(--brand-green)',
  grid: '#8B87A8',
  import: '#3B82F6',
  export: '#14B8A6',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#8B87A8',
};

export const darkChartColors: ChartTokens = {
  pv: '#F0CB6C',
  load: '#60A5FA',
  battery: '#2EF0CC',
  grid: '#A8A3C7',
  import: '#60A5FA',
  export: '#7CCAC5',
  warning: '#FBBF24',
  danger: '#F87171',
  neutral: '#A8A3C7',
};

export function getChartColors(isDark: boolean): ChartTokens {
  return isDark ? darkChartColors : lightChartColors;
}
