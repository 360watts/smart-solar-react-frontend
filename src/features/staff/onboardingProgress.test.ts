import { sectionProgress } from './onboardingProgress';

const empty = { owner: null, site: null, profile: null, savings: null, billingAnchor: null };

describe('sectionProgress', () => {
  it('reports nothing filled for an empty site', () => {
    const p = sectionProgress(empty);
    expect(p.customer).toEqual({ filled: 0, total: 4 });
    expect(p.site).toEqual({ filled: 0, total: 6 });
    expect(p.billing).toEqual({ filled: 0, total: 4 });
  });

  it('treats 0 and empty string as unfilled for site/customer fields', () => {
    const p = sectionProgress({ ...empty, site: { capacity_kw: 0, display_name: '' }, owner: { email: '' } });
    expect(p.site.filled).toBe(0);
    expect(p.customer.filled).toBe(0);
  });

  it('counts an explicit 0 appliance answer as answered', () => {
    const p = sectionProgress({ ...empty, profile: { num_ac_units: 0, num_geysers: 2 } });
    expect(p.appliances.filled).toBe(2);
  });

  it('counts billing anchor and wallet balance (0 wallet counts only when set)', () => {
    const p = sectionProgress({ ...empty, billingAnchor: '2026-07-17', savings: { energyWallet: { balanceKwh: 1237.5 } } });
    expect(p.billing.filled).toBe(2);
  });

  it('leaves the savings items out of billing when the person cannot see savings', () => {
    const p = sectionProgress({ ...empty, site: { eb_consumer_number: '123', eb_registered_mobile: '999' } }, false);
    expect(p.billing).toEqual({ filled: 2, total: 2 });
  });
});
