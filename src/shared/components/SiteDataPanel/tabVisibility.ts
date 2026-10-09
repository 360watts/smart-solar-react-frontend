import { TABS, type TabId } from './types';

/**
 * Which tabs the site panel shows. A meter-only site (no inverter) gets Usage only (it
 * already shows every per-phase value); any other site keeps today's tabs, plus Usage last when it has an
 * energy meter (`hasMeter`). While `meterOnly`/`hasMeter` are unknown (overview not loaded, or an older backend) it behaves
 * like an inverter site. Devices only shows when `visibleTabs` lists it. Smart plugs shows (after Load; after Usage on a
 * meter-only site) only when `hasPlugs` is true.
 */
export function tabsFor({ meterOnly, hasMeter, hasPlugs, visibleTabs }: { meterOnly?: boolean | null; hasMeter?: boolean | null; hasPlugs?: boolean | null; visibleTabs?: TabId[] }): TabId[] {
  const allowed = (id: TabId) => !visibleTabs || visibleTabs.includes(id);
  // Devices is opt-in (last, on every site kind): only a caller that checked can('device_control') lists it.
  const devices: TabId[] = visibleTabs?.includes('devices') ? ['devices'] : [];
  if (meterOnly === true) return [...(['usage', ...(hasPlugs === true ? ['plugs'] : [])] as TabId[]).filter(allowed), ...devices];
  const tabs = TABS.map(t => t.id as TabId).filter(id => id !== 'usage' && id !== 'devices' && (id !== 'plugs' || hasPlugs === true));
  return [...(hasMeter === true ? [...tabs, 'usage' as TabId] : tabs).filter(allowed), ...devices];
}

/** The tab to show: the active one if the bar lists it, else the bar's first entry. */
export function resolveTab(active: TabId, tabs: TabId[]): TabId {
  return tabs.includes(active) || tabs.length === 0 ? active : tabs[0];
}

export function tabLabel(tab: { id: string; label: string }): string {
  return tab.label;
}
