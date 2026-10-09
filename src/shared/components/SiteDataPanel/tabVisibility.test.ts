import { tabsFor, tabLabel, resolveTab } from './tabVisibility';
import { TABS, type TabId } from './types';

const inverterTabs = TABS.map(t => t.id).filter(id => id !== 'usage');

describe('tabsFor', () => {
  it('meter-only gives usage then phase-load', () => {
    expect(tabsFor({ meterOnly: true })).toEqual(['usage', 'phase-load']);
  });

  it('meter-only keeps both when the viewer list has both', () => {
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview', 'phase-load', 'usage'] })).toEqual(['usage', 'phase-load']);
  });

  it('meter-only intersects with visibleTabs', () => {
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview', 'phase-load'] })).toEqual(['phase-load']);
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview'] })).toEqual([]);
  });

  it('inverter sites keep the current tabs and never get usage', () => {
    expect(tabsFor({ meterOnly: false })).toEqual(inverterTabs);
    expect(tabsFor({ meterOnly: false })).not.toContain('usage');
  });

  it('drops usage for inverter sites even if visibleTabs lists it', () => {
    const visible: TabId[] = ['overview', 'usage', 'phase-load'];
    expect(tabsFor({ meterOnly: false, visibleTabs: visible })).toEqual(['overview', 'phase-load']);
  });

  it('unknown meterOnly behaves like an inverter site', () => {
    expect(tabsFor({ meterOnly: undefined })).toEqual(inverterTabs);
    expect(tabsFor({ meterOnly: null })).toEqual(inverterTabs);
    expect(tabsFor({ meterOnly: undefined, visibleTabs: ['usage', 'history'] })).toEqual(['history']);
  });
});

describe('resolveTab', () => {
  it('keeps a listed tab and falls back to the first entry otherwise', () => {
    expect(resolveTab('usage', ['usage', 'phase-load'])).toBe('usage');
    expect(resolveTab('overview', ['usage', 'phase-load'])).toBe('usage');
    expect(resolveTab('usage', ['overview', 'history'])).toBe('overview');
    expect(resolveTab('usage', [])).toBe('usage');
  });
});

describe('tabLabel', () => {
  it('calls the phase tab "Load by phase" on meter-only sites only', () => {
    expect(tabLabel({ id: 'phase-load', label: 'Load' }, true)).toBe('Load by phase');
    expect(tabLabel({ id: 'phase-load', label: 'Load' }, false)).toBe('Load');
    expect(tabLabel({ id: 'phase-load', label: 'Load' }, null)).toBe('Load');
    expect(tabLabel({ id: 'usage', label: 'Usage' }, true)).toBe('Usage');
  });
});
