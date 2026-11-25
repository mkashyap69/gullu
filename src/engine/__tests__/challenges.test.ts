/**
 * @jest-environment node
 */
import { manishInput } from '../../data/demo';
import { challengeStatus, type ChallengeContext } from '../challenges';
import { ym } from '../dates';

const ctx = (over: Partial<ChallengeContext> = {}): ChallengeContext => ({
  input: manishInput(),
  paydays: [ym(2028, 2), ym(2028, 3)].map((m) => ({ month: m, kind: 'same' as const, placed: true })),
  valueMonths: [],
  minuteMonths: [],
  ...over,
});

test('no skipped payday this quarter: 2 of 3 months with April still to place', () => {
  const s = challengeStatus({ id: 'noSkipQuarter', name: '', target: 3, progress: 0, done: false, start: { month: ym(2028, 2) } }, ctx());
  expect(s.label).toBe('2 of 3 months');
  expect(s.done).toBe(false);
});

test('max PPF reads the PPF paid this financial year', () => {
  const c = ctx();
  const r = c.input.flowRules.find((x) => x.type === 'commitment')!;
  if (r.type === 'commitment') Object.assign(r, { paidThisYear: 12500, paidFy: 2028 });
  expect(challengeStatus({ id: 'maxPpf', name: '', target: 150000, progress: 0, done: false }, c).label).toBe('₹12,500 of ₹1.5 L');
});

test('no new loan ends neutrally when a loan is added; values in 3 months in a row finishes', () => {
  const s = challengeStatus({ id: 'noNewLoan', name: '', target: 12, progress: 0, done: false, start: { month: ym(2028, 1), loanIds: [] } }, ctx());
  expect(s.ended).toBe(true);
  expect(s.label).toBe('A loan was added');
  const v = challengeStatus({ id: 'updateValues3', name: '', target: 3, progress: 0, done: false, start: { month: ym(2028, 1) } }, ctx({ valueMonths: [ym(2028, 2), ym(2028, 3), ym(2028, 4)] }));
  expect(v.done).toBe(true);
});
