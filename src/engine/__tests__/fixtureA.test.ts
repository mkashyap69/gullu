// Fixture A: Jest port of reference/engine.test.js. Numbers must match exactly.
import { requiredSipReference as requiredSip, simulateReference as simulate, type RefParams } from '../reference';

const fixtureA = (): RefParams => ({
  sip: 50000, stepUp: 10, goal: 15000000, years: 5, startMonth: 11, // startMonth 11 = Dec 2026
  expenses: 50000, monthsCover: 6, method: 'liquid', rdRate: 7, goldPct: 8,
  ppfLimit: 150000, ppfPaid: 0, marketShift: 0, events: [],
  buckets: [
    { id: 'emergency', kind: 'emergency', bal: 16233, ret: 6.5 },
    { id: 'gold', kind: 'gold', bal: 147980, ret: 9 },
    { id: 'ppf', kind: 'ppf', bal: 478014, ret: 7.1 },
    { id: 'epf', kind: 'passive', bal: 287014, ret: 8.25 },
    { id: 'core', kind: 'invest', bal: 1111391, ret: 12, share: 47 },
    { id: 'high', kind: 'invest', bal: 2646077, ret: 13, share: 20 },
    { id: 'us', kind: 'invest', bal: 1835083, ret: 12, share: 33 },
  ],
});
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const label = (p: RefParams, m: number | undefined) =>
  MONTHS[(p.startMonth + (m as number)) % 12] + ' ' + (2026 + Math.floor((p.startMonth + (m as number)) / 12));

test('Fixture A: final invested total', () => {
  const r = simulate(fixtureA());
  expect(Math.round(r.rows[r.rows.length - 1].inv)).toBe(15584513);
});
test('Fixture A: milestone months', () => {
  const p = fixtureA();
  const t = simulate(p).tags;
  expect(label(p, t.ef)).toBe('May 2027'); // safety net full
  expect(label(p, t.gold)).toBe('Feb 2028'); // gold at target
  expect(label(p, t.firstInv)).toBe('Apr 2028'); // first money into equity
  expect(label(p, t.goal)).toBe('Sep 2031'); // goal reached
});
test('Fixture A: required SIP (bisection, rounded up to ₹500)', () => {
  expect(requiredSip(fixtureA())).toBe(44000);
});
test('Fixture A: RD instalments', () => {
  const a = fixtureA(); a.method = 'rd12'; expect(Math.round(simulate(a).rdInst as number)).toBe(22792);
  const b = fixtureA(); b.method = 'rd24'; expect(Math.round(simulate(b).rdInst as number)).toBe(11011);
});
