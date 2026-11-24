/**
 * @jest-environment node
 */
import { demoAppData, manishInput } from '../../data/demo';
import { ym } from '../dates';
import { expectedBadYearDrop, glideSteps, marketFall, pendingMilestone, reachedGoal, shownKeys, totalsByDate } from '../moments';

const manishSnaps = () => demoAppData('manish').snapshots;

test('market fall: Manish is ₹12.2 L (14%) below his recorded high, shown once per high', () => {
  const m = marketFall(manishSnaps(), 'balanced', new Set());
  expect(m).not.toBeNull();
  expect(m!.drop).toBe(1220000);
  expect(Math.round(m!.pct * 100)).toBe(14);
  expect(marketFall(manishSnaps(), 'balanced', new Set([m!.key]))).toBeNull();
  // A smaller fall doesn't fire for Balanced, but does for Safety-first.
  const small = [
    { date: ym(2028, 1), holdingId: null, value: 1000000 },
    { date: ym(2028, 2), holdingId: null, value: 940000 },
  ];
  expect(marketFall(small, 'balanced', new Set())).toBeNull();
  expect(marketFall(small, 'safetyFirst', new Set())).not.toBeNull();
});

test('Manish\'s 14% fall is inside a Balanced plan\'s bad year (about 15%)', () => {
  expect(expectedBadYearDrop(0.6)).toBeCloseTo(0.148, 2);
  expect(0.14).toBeLessThan(expectedBadYearDrop(0.6));
});

test('totals carry forward per-holding values when no total was confirmed', () => {
  const t = totalsByDate([
    { date: 1, holdingId: 'a', value: 100 },
    { date: 1, holdingId: 'b', value: 50 },
    { date: 2, holdingId: 'a', value: 80 },
  ]);
  expect(t).toEqual([{ date: 1, total: 150 }, { date: 2, total: 130 }]);
});

test('milestones: habits only, each once', () => {
  const input = manishInput();
  const shown = shownKeys(demoAppData('manish').habits);
  expect(pendingMilestone(input, 11, shown)).toBeNull(); // 6 paydays and safety net already celebrated
  expect(pendingMilestone(input, 12, shown)).toBe('paydays-12');
  expect(pendingMilestone(input, 12, new Set([...shown, 'paydays-12']))).toBeNull();
});

test('goal day fires when a goal\'s money reaches its target', () => {
  const input = manishInput();
  expect(reachedGoal(input, new Set())).toBeNull();
  const rich = { ...input, holdings: input.holdings.map((h) => (h.id === 'stDebt' ? { ...h, value: 600000 } : h)) };
  const r = reachedGoal(rich, new Set());
  expect(r?.goalId).toBe('trip');
  expect(reachedGoal(rich, new Set(['goal-trip']))).toBeNull();
});

test('glide path: Home (Dec 2031) is 40% today and 20% from Dec 2028', () => {
  const s = glideSteps(ym(2028, 4), ym(2031, 12), 0.6);
  expect(s).toEqual([
    { from: ym(2028, 4), cap: 0.4, yearsLeft: 44 / 12 },
    { from: ym(2028, 12), cap: 0.2, yearsLeft: 3 },
  ]);
});
