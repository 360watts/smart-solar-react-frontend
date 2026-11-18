/**
 * App-wide Chart.js defaults (Nov 18, 2026): the first and last points sit in from the axes instead of on
 * them, and value axes leave headroom so peaks and ranges never touch the top edge. Imported once in main.jsx;
 * a chart can still override either per scale. Bar charts already offset their category axis.
 */
import { defaults } from 'chart.js';

defaults.set('scales.category', { offset: true });
defaults.set('scales.time', { offset: true });
defaults.set('scales.timeseries', { offset: true });
defaults.set('scales.linear', { grace: '5%' });
