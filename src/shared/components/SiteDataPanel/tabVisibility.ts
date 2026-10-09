import { TABS, type TabId } from './types';

/**
 * Which tabs the site panel shows. A meter-only site (no inverter) gets Usage and
 * Load by phase; everything else keeps today's tabs and never sees Usage. While
 * `meterOnly` is unknown (overview not loaded, or an older backend) it behaves
 * like an inverter site.
 */
export function tabsFor({ meterOnly, visibleTabs }: { meterOnly?: boolean | null; visibleTabs?: TabId[] }): TabId[] {
  const allowed = (id: TabId) => !visibleTabs || visibleTabs.includes(id);
  if (meterOnly === true) return (['usage', 'phase-load'] as TabId[]).filter(allowed);
  return TABS.map(t => t.id as TabId).filter(id => id !== 'usage' && allowed(id));
}

/** The tab to show: the active one if the bar lists it, else the bar's first entry. */
export function resolveTab(active: TabId, tabs: TabId[]): TabId {
  return tabs.includes(active) || tabs.length === 0 ? active : tabs[0];
}

export function tabLabel(tab: { id: string; label: string }, meterOnly?: boolean | null): string {
  return meterOnly === true && tab.id === 'phase-load' ? 'Load by phase' : tab.label;
}
