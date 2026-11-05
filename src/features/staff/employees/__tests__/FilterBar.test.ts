import { DEFAULT_SORT, NO_FILTERS, chipText, toQuery } from '../FilterBar';
import { reachOf } from '../PeopleTable';

describe('chipText', () => {
  it('shows at most two values, then +N', () => {
    expect(chipText('Team', ['Field'])).toBe('Team: Field');
    expect(chipText('Team', ['Field', 'Support', 'Office', 'Night'])).toBe('Team: Field, Support +2');
  });
});

describe('toQuery', () => {
  it('sends the default sort and nothing else', () => {
    expect(toQuery('all', NO_FILTERS, DEFAULT_SORT)).toEqual({
      role: undefined, extra: { ordering: 'name', team: undefined, site: undefined, deviceOps: undefined, isActive: undefined, employment: undefined },
    });
  });
  it("maps views, chips and a descending sort; the Can't sign in view wins over the sign-in chip", () => {
    const q = toQuery('viewer', { ...NO_FILTERS, team: [3], site: 'coim_002', deviceOps: false, employment: ['on_leave'] }, { key: 'joined', desc: true });
    expect(q).toEqual({ role: 'viewer', extra: { ordering: '-joined', team: [3], site: 'coim_002', deviceOps: false, isActive: undefined, employment: ['on_leave'] } });
    expect(toQuery('inactive', { ...NO_FILTERS, signIn: true }, DEFAULT_SORT).extra.isActive).toBe(false);
  });
});

describe('reachOf', () => {
  const base = { id: 1, email: 'a@b.in', first_name: 'A', last_name: 'B' };
  it('words what each person reaches', () => {
    expect(reachOf({ ...base, role: 'admin' }).text).toBe('Everything');
    expect(reachOf({ ...base, role: 'employee' }).text).toBe('All sites');
    expect(reachOf({ ...base, role: 'viewer', assigned_devices: [1, 2] }).text).toBe('2 devices');
    expect(reachOf({ ...base, role: 'viewer' }).text).toBe('Nothing yet');
    expect(reachOf({ ...base, role: 'viewer', assigned_sites: ['a', 'b', 'c'], assigned_devices: [1] }).chips).toEqual(['a', 'b', '+1', '1 device']);
  });
});
