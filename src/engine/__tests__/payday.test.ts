/**
 * @jest-environment node
 */
import { demoAppData, manishInput } from '../../data/demo';
import { ym } from '../dates';
import { checkLevel, festivalFor, nextUnlock, streakState } from '../habits';
import { movesForPlan, paydayPlan } from '../payday';

const amounts = (p: ReturnType<typeof paydayPlan>) => Object.fromEntries(p.lines.map((l) => [l.label, l.amount]));
const statuses = (p: ReturnType<typeof paydayPlan>) => Object.fromEntries(p.lines.map((l) => [l.label, l.status]));

test('4.2: ₹55,000 goes Home 18,000 · PPF 12,500 · Education 12,500 · Retirement 9,000 · Trip 3,000', () => {
  const p = paydayPlan(manishInput(), 55000);
  expect(p.kind).toBe('same');
  expect(amounts(p)).toEqual({ PPF: 12500, Home: 18000, "Child's education": 12500, Retirement: 9000, 'Japan trip': 3000 });
});

test('4.6: a ₹35,000 month keeps must-haves full, PPF catches up, the rest wait a month', () => {
  const p = paydayPlan(manishInput(), 35000);
  expect(p.kind).toBe('less');
  expect(amounts(p)).toEqual({ PPF: 4500, Home: 18000, "Child's education": 12500, Retirement: 0, 'Japan trip': 0 });
  expect(statuses(p)).toEqual({ PPF: 'catchUp', Home: 'full', "Child's education": 'full', Retirement: 'next', 'Japan trip': 'next' });
});

test('bonus: extra goes to the goal furthest behind (must first), then Retirement', () => {
  const p = paydayPlan(manishInput(), 65000, new Map([['edu', 16000], ['home', 18000], ['retire', 7500], ['trip', 3000]]));
  expect(p.kind).toBe('bonus');
  expect(amounts(p)["Child's education"]).toBe(16000);
  expect(amounts(p).Retirement).toBe(9000 + 6500);
});

test('moves: PPF first, add up to the payday, no EPF, one holding per class per goal', () => {
  const input = manishInput();
  const moves = movesForPlan(input, paydayPlan(input, 55000));
  expect(moves[0].holdingId).toBe('ppf');
  expect(moves[0].amount).toBe(12500);
  expect(moves.reduce((a, m) => a + m.amount, 0)).toBe(55000);
  expect(moves.some((m) => m.holdingId === 'epf')).toBe(false);
  // A preferred holding wins for that goal and class.
  const pref = movesForPlan(input, paydayPlan(input, 55000), { 'edu:indianEquity': 'nifty' });
  expect(pref.some((m) => m.holdingId === 'nifty' && m.parts.some((p) => p.lineId === 'edu'))).toBe(true);
});

test('streak: 11 months with the shield covering Sep 2027; the current month never breaks it', () => {
  const data = demoAppData('manish');
  const placed = data.paydays.filter((p) => p.placedAt != null).map((p) => p.month);
  const s = streakState(placed, [ym(2027, 9)], ym(2028, 4));
  expect(s.streak).toBe(11);
  expect(s.shielded).toEqual([ym(2027, 9)]);
  // Placing April makes 12 (the receipt).
  expect(streakState([...placed, ym(2028, 4)], [ym(2027, 9)], ym(2028, 4)).streak).toBe(12);
  // A miss with no shield starts over, neutrally.
  expect(streakState([ym(2028, 1), ym(2028, 3)], [], ym(2028, 3)).streak).toBe(1);
  // Six in a row earn a shield that covers the next miss.
  const six = [1, 2, 3, 4, 5, 6].map((m) => ym(2028, m));
  expect(streakState(six, [], ym(2028, 7)).shieldHeld).toBe(true);
  expect(streakState([...six, ym(2028, 8)], [], ym(2028, 8)).streak).toBe(8);
});

test('festivals: Diwali 2027 is October, Holi 2028 is March', () => {
  expect(festivalFor(ym(2027, 10))?.label).toBe('Diwali 2027');
  expect(festivalFor(ym(2028, 3))?.label).toBe('Holi 2028');
  expect(festivalFor(ym(2028, 4))).toBeNull();
});

test('levels: Manish is Secure; Builder is blocked by 11 of 12 paydays and Education', () => {
  const input = manishInput();
  expect([1, 2, 3].every((n) => checkLevel(n, input, 11).met)).toBe(true);
  const four = checkLevel(4, input, 11);
  expect(four.met).toBe(false);
  expect(four.detail).toBe('11 of 12 paydays');
  expect(four.blocker).toBe('Education needs ₹3,500 more');
  expect(nextUnlock(3, input, 12)).toBeNull(); // still short on Education
});
