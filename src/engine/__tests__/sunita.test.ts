/**
 * @jest-environment node
 */
import { sunitaInput, sunitaWithdrawalSpec } from '../../data/demo';
import { applyWithdrawal, incomePlan } from '../income';
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

test('the generic retiree spec gives Sunita her persona numbers: 98 likely, 91 almost sure, buckets 15.6 L / 39 L / 1.85 Cr', () => {
  const p = incomePlan(sunitaInput());
  expect(p.likelyAge).toBe(98);
  expect(p.almostSureAge).toBe(91);
  expect(p.buckets).toEqual({ cash: 1560000, income: 3900000, growth: 18500000 });
  expect(p.fromSavings).toBe(65000);
  expect(p.refill).toBe(780000);
  expect(Math.round(p.rate * 1000) / 10).toBe(3.3);
  expect(p.isRefillMonth).toBe(true);
});

test('withdrawing: cash pays the month; in April the refill moves from debt to cash', () => {
  const input = sunitaInput();
  const p = incomePlan(input, 50);
  const changed = applyWithdrawal(input.holdings, p, true, input.today);
  const liquid = changed.find((h) => h.id === 'liquid')!;
  expect(liquid.value).toBe(1560000 - 65000 + 780000);
  const debtBefore = input.holdings.filter((h) => h.assetClass === 'debt').reduce((a, h) => a + h.value, 0);
  const debtAfter = changed.filter((h) => h.assetClass === 'debt').reduce((a, h) => a + h.value, 0);
  expect(Math.abs(debtBefore - debtAfter - 780000)).toBeLessThanOrEqual(2);
});
