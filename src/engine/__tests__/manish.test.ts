/**
 * @jest-environment node
 */
// Manish (32) fixture: the engine must reproduce the status words and counts in the designs.
import { manishInput } from '../../data/demo';
import { labelYM } from '../dates';
import { computePlan, computePlanFast, goalResultFast, movesByHolding, movesThisMonth, safetyNet, splitPayday, type Plan } from '../plan';

let plan: Plan;
beforeAll(() => {
  plan = computePlan(manishInput());
});
const goal = (id: string) => plan.goals.find((g) => g.goalId === id)!;

test('affordability words match the designs', () => {
  expect(goal('trip').affordability).toBe('comfortable');
  expect(goal('retire').affordability).toBe('comfortable');
  expect(goal('home').affordability).toBe('manageable');
  expect(goal('edu').affordability).toBe('stretch');
});

test('3 of 4 goals are on track, and Education is the focus', () => {
  expect(plan.onTrack).toBe(3);
  expect(plan.total).toBe(4);
  expect(plan.focus?.goalId).toBe('edu');
  expect(plan.focus?.extraMonthly).toBe(3500); // "₹3,500 more a month fixes it"
});

test('required vs actual on every goal row', () => {
  expect(goal('edu').actualMonthly).toBe(12500);
  expect(goal('edu').requiredMonthly).toBe(16000); // "₹12,500 a month, needs ₹16,000"
  expect(goal('home').requiredMonthly).toBe(18000);
  expect(goal('retire').requiredMonthly).toBe(7500);
  expect(goal('trip').requiredMonthly).toBe(3000);
});

test('Education: likely about ₹34 L of ₹40 L, short by about ₹6 L, bands ordered', () => {
  const e = goal('edu');
  expect(e.bands!.likely / 1e5).toBeCloseTo(34, 0);
  expect(Math.round(e.shortBy / 1e5)).toBe(6);
  expect(e.bands!.almostSure).toBeLessThan(e.bands!.likely);
  expect(e.bands!.possible).toBeGreaterThan(e.bands!.likely);
});

test('Home lands near its Dec 2031 date with a range around it', () => {
  const h = goal('home');
  expect(h.projectedDate).not.toBeNull();
  expect(['Sep 2031', 'Oct 2031', 'Nov 2031', 'Dec 2031']).toContain(labelYM(h.projectedDate!));
  expect(h.dateRange![0]).toBeLessThanOrEqual(h.projectedDate!);
  expect(h.dateRange![1]).toBeGreaterThanOrEqual(h.projectedDate!);
});

test('safety net is full', () => {
  expect(safetyNet(manishInput())?.full).toBe(true);
});

test('fast plan agrees with the full plan on required amounts and the headline', () => {
  const fast = computePlanFast(manishInput());
  expect(fast.goals.map((g) => g.requiredMonthly)).toEqual(plan.goals.map((g) => g.requiredMonthly));
  expect(fast.focus?.goalId).toBe('edu');
});

test('payday split uses the user-set amounts; short month cuts nice → should first', () => {
  const inp = manishInput();
  const full = splitPayday(inp, 55000);
  expect(Object.fromEntries(full.map((s) => [s.goalId, s.amount]))).toEqual({ home: 18000, edu: 12500, retire: 9000, trip: 3000 });
  const short = Object.fromEntries(splitPayday(inp, 45000).map((s) => [s.goalId, s.amount]));
  expect(short.trip).toBe(0);
  expect(short.home).toBe(18000);
  expect(short.edu).toBe(12500);
  expect(short.retire).toBe(2000);
});

test('moves add up to the payday amount, PPF first', () => {
  const inp = manishInput();
  const moves = movesByHolding(movesThisMonth(inp, splitPayday(inp, 55000)));
  const total = moves.reduce((a, m) => a + m.amount, 0);
  expect(Math.abs(total - 55000)).toBeLessThanOrEqual(400); // rounding to ₹100 per line
  expect(moves.find((m) => m.holdingId === 'ppf')?.amount).toBe(12500);
  expect(moves.every((m) => m.holdingId !== 'crypto')).toBe(true); // "other" never gets new money
});

test('single-line recompute is under 16ms', () => {
  const inp = manishInput();
  const g = inp.goals.find((x) => x.id === 'edu')!;
  goalResultFast(inp, g, { monthly: 15000 }); // warm
  const t = performance.now();
  for (let i = 0; i < 10; i++) goalResultFast(inp, g, { monthly: 12500 + i * 500 });
  expect((performance.now() - t) / 10).toBeLessThan(16);
});
