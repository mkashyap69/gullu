/**
 * @jest-environment node
 */
import { sunitaWithdrawalSpec } from '../../data/demo';
import { withdrawalLikely, withdrawalRanges, withdrawalRate } from '../withdrawal';

test('Sunita: ₹90,000 a month, likely until 98, almost sure until 91', () => {
  expect(withdrawalLikely(sunitaWithdrawalSpec()).lastsUntil).toBe(98);
  expect(withdrawalRanges(sunitaWithdrawalSpec())).toEqual({ almostSure: 91, likely: 98 });
});

test('₹65,000 a month is 3.3% of ₹2.4 Cr a year', () => {
  expect(Math.round(withdrawalRate(65000, 24000000) * 1000) / 10).toBe(3.3);
});

test('each April the income bucket refills cash', () => {
  const r = withdrawalLikely(sunitaWithdrawalSpec());
  expect(r.refills[0].month).toBe(12);
  expect(r.refills[0].amount).toBeGreaterThan(0);
});
