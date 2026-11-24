// Fixture A regression test for the reference engine. Run: node --test reference/
// Port this file to Jest/Vitest against the TypeScript engine; the numbers must match exactly.
const test = require('node:test');
const assert = require('node:assert');
const { simulate, requiredSip } = require('./engine.js');

const fixtureA = () => ({
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
const label = (p, m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(p.startMonth + m) % 12] + ' ' + (2026 + Math.floor((p.startMonth + m) / 12));

test('Fixture A: final invested total', () => {
  const r = simulate(fixtureA());
  assert.strictEqual(Math.round(r.rows[r.rows.length - 1].inv), 15584513);
});
test('Fixture A: milestone months', () => {
  const p = fixtureA(), t = simulate(p).tags;
  assert.strictEqual(label(p, t.ef), 'May 2027');       // safety net full
  assert.strictEqual(label(p, t.gold), 'Feb 2028');     // gold at target
  assert.strictEqual(label(p, t.firstInv), 'Apr 2028'); // first money into equity
  assert.strictEqual(label(p, t.goal), 'Sep 2031');     // goal reached
});
test('Fixture A: required SIP (bisection, rounded up to ₹500)', () => {
  assert.strictEqual(requiredSip(fixtureA()), 44000);
});
test('Fixture A: RD instalments', () => {
  const a = fixtureA(); a.method = 'rd12'; assert.strictEqual(Math.round(simulate(a).rdInst), 22792);
  const b = fixtureA(); b.method = 'rd24'; assert.strictEqual(Math.round(simulate(b).rdInst), 11011);
});
