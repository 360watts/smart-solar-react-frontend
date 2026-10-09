import { tabsFor, tabLabel, resolveTab } from './tabVisibility';
import { TABS, type TabId } from './types';

const inverterTabs = TABS.map(t => t.id).filter(id => id !== 'usage' && id !== 'devices' && id !== 'plugs');

describe('tabsFor', () => {
  it('meter-only gives usage only', () => {
    expect(tabsFor({ meterOnly: true })).toEqual(['usage']);
  });

  it('meter-only keeps both when the viewer list has both', () => {
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview', 'phase-load', 'usage'] })).toEqual(['usage']);
  });

  it('meter-only intersects with visibleTabs', () => {
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview', 'phase-load'] })).toEqual([]);
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview'] })).toEqual([]);
  });

  it('inverter sites with a meter get usage appended last', () => {
    expect(tabsFor({ meterOnly: false, hasMeter: true })).toEqual([...inverterTabs, 'usage']);
  });

  it('hasMeter intersects with visibleTabs', () => {
    expect(tabsFor({ meterOnly: false, hasMeter: true, visibleTabs: ['overview', 'usage'] })).toEqual(['overview', 'usage']);
    expect(tabsFor({ meterOnly: false, hasMeter: true, visibleTabs: ['overview', 'history'] })).toEqual(['overview', 'history']);
  });

  it('unknown or false hasMeter adds no usage', () => {
    expect(tabsFor({ meterOnly: false, hasMeter: false })).toEqual(inverterTabs);
    expect(tabsFor({ meterOnly: false, hasMeter: null })).toEqual(inverterTabs);
    expect(tabsFor({ hasMeter: undefined })).toEqual(inverterTabs);
  });

  it('meter-only ignores hasMeter', () => {
    expect(tabsFor({ meterOnly: true, hasMeter: false })).toEqual(['usage']);
  });

  it('inverter sites without a meter keep the current tabs and never get usage', () => {
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

describe('tabsFor devices (opt-in)', () => {
  it('never shows devices unless visibleTabs lists it (TB-4)', () => {
    expect(tabsFor({ meterOnly: false })).not.toContain('devices');
    expect(tabsFor({ meterOnly: true })).not.toContain('devices');
    expect(tabsFor({ meterOnly: false, hasMeter: true })).not.toContain('devices');
  });

  it('puts devices last on inverter and meter-only sites when listed (TB-3)', () => {
    expect(tabsFor({ meterOnly: false, visibleTabs: ['overview', 'devices'] })).toEqual(['overview', 'devices']);
    expect(tabsFor({ meterOnly: false, hasMeter: true, visibleTabs: ['devices', 'overview', 'usage'] })).toEqual(['overview', 'usage', 'devices']);
    expect(tabsFor({ meterOnly: true, visibleTabs: ['overview', 'usage', 'devices'] })).toEqual(['usage', 'devices']);
  });
});

describe('tabsFor plugs (smart-plugs-tab.md)', () => {
  const withPlugs = (tabs: TabId[]) => [...tabs.slice(0, tabs.indexOf('phase-load') + 1), 'plugs', ...tabs.slice(tabs.indexOf('phase-load') + 1)];

  it('adds plugs after Load on inverter sites with a plug (PV-1)', () => {
    expect(tabsFor({ meterOnly: false, hasPlugs: true })).toEqual(withPlugs(inverterTabs as TabId[]));
    expect(tabsFor({ meterOnly: false, hasMeter: true, hasPlugs: true, visibleTabs: ['overview', 'phase-load', 'plugs', 'usage', 'devices'] }))
      .toEqual(['overview', 'phase-load', 'plugs', 'usage', 'devices']);
  });

  it('never shows plugs without a plug (PV-2)', () => {
    expect(tabsFor({ meterOnly: false, hasPlugs: false })).not.toContain('plugs');
    expect(tabsFor({ meterOnly: false, hasPlugs: null })).not.toContain('plugs');
    expect(tabsFor({ meterOnly: false })).not.toContain('plugs');
  });

  it('meter-only sites get usage then plugs (PV-3, PV-4)', () => {
    expect(tabsFor({ meterOnly: true, hasPlugs: true })).toEqual(['usage', 'plugs']);
    expect(tabsFor({ meterOnly: true, hasPlugs: true, visibleTabs: ['usage', 'plugs', 'devices'] })).toEqual(['usage', 'plugs', 'devices']);
    expect(tabsFor({ meterOnly: true, hasPlugs: false })).toEqual(['usage']);
  });

  it('respects visibleTabs (PV-5)', () => {
    expect(tabsFor({ meterOnly: false, hasPlugs: true, visibleTabs: ['overview'] })).toEqual(['overview']);
    expect(tabsFor({ meterOnly: true, hasPlugs: true, visibleTabs: ['usage'] })).toEqual(['usage']);
  });
});

describe('resolveTab', () => {
  it('keeps a listed tab and falls back to the first entry otherwise', () => {
    expect(resolveTab('usage', ['usage'])).toBe('usage');
    expect(resolveTab('phase-load', ['usage'])).toBe('usage');
    expect(resolveTab('usage', ['overview', 'history'])).toBe('overview');
    expect(resolveTab('usage', [])).toBe('usage');
  });
});

describe('tabLabel', () => {
  it('returns the tab label unchanged', () => {
    expect(tabLabel({ id: 'phase-load', label: 'Load' })).toBe('Load');
    expect(tabLabel({ id: 'usage', label: 'Usage' })).toBe('Usage');
  });
});
