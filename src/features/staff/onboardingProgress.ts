export type SectionKey = 'customer' | 'site' | 'appliances' | 'billing';

const filled = (v: unknown) => v !== null && v !== undefined && v !== '' && v !== 0;

/** Fields that count toward each section's "n of m filled" strip. */
export const SITE_FIELDS = [
  'display_name', 'latitude', 'longitude', 'capacity_kw', 'inverter_capacity_kw',
  'commissioned_on',
] as const;

export interface OnboardingData {
  owner: { first_name?: string; email?: string; mobile_number?: string; address?: string } | null;
  site: Record<string, any> | null;
  profile: Record<string, any> | null;
  savings: { energyWallet?: { balanceKwh: number } } | null;
  billingAnchor: string | null;
}

/** `withSavings: false` drops the savings-backed items (anchor, wallet) for people who can't see billing. */
export function sectionProgress(d: OnboardingData, withSavings = true): Record<SectionKey, { filled: number; total: number }> {
  const count = (vals: unknown[]) => ({ filled: vals.filter(filled).length, total: vals.length });
  const o = d.owner ?? {};
  const s = d.site ?? {};
  const p = d.profile ?? {};
  return {
    customer: count([o.first_name, o.email, o.mobile_number, o.address]),
    site: count(SITE_FIELDS.map(k => s[k])),
    // appliances: any answer counts, including an explicit "none" (0 is a real answer here)
    appliances: {
      filled: [p.num_ac_units, p.num_geysers, p.num_ev_chargers, p.has_water_pump, p.pump_on_inverter]
        .filter(v => v !== null && v !== undefined).length,
      total: 5,
    },
    billing: count([
      ...(withSavings ? [d.billingAnchor, d.savings?.energyWallet?.balanceKwh] : []),
      s.eb_consumer_number, s.eb_registered_mobile,
    ]),
  };
}
