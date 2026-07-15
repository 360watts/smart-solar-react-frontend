import type { ChartTokens } from './types';

export const lightChartColors: ChartTokens = {
  pv: '#E9B949',
  load: '#3B82F6',
  battery: '#2FBF71',
  grid: '#1F7A52',
  import: '#3B82F6',
  export: '#499761',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#1F7A52',
};

export const darkChartColors: ChartTokens = {
  pv: '#F0CB6C',
  load: '#60A5FA',
  battery: '#5BBD79',
  grid: '#8FE0B8',
  import: '#60A5FA',
  export: '#7CCA94',
  warning: '#FBBF24',
  danger: '#F87171',
  neutral: '#8FE0B8',
};

export function getChartColors(isDark: boolean): ChartTokens {
  return isDark ? darkChartColors : lightChartColors;
}
