/**
 * Retiree income (7.1–7.3): the month's income, how long the money likely lasts, the three
 * buckets and April's refill, from the plan input. Pure TS.
 */
import { currentAge } from './plan';
import { retireeWithdrawalSpec } from './onboarding';
import type { Holding, PlanInput } from './types';
import { withdrawalLikely, withdrawalRanges, withdrawalRate, type BucketState } from './withdrawal';

export type IncomePlan = {
  age: number;
  spend: number;
  pension: number;
  fromSavings: number;
  corpus: number;
  /** Yearly draw from savings as a share of savings (0.033 = 3.3%). */
  rate: number;
  likelyAge: number;
  /** Weak-markets age (Monte Carlo); null when `paths` is 0 (the quick first pass). */
  almostSureAge: number | null;
  buckets: BucketState;
  /** What moves from income to cash each April (a year of draws). */
  refill: number;
  isRefillMonth: boolean;
  /** The cash-bucket holding to withdraw from (largest planned cash holding). */
  cashHolding: Holding | null;
};

export function incomePlan(input: PlanInput, paths = 1000): IncomePlan {
  const spec = retireeWithdrawalSpec(input);
  const corpus = spec.buckets.cash + spec.buckets.income + spec.buckets.growth;
  const fromSavings = Math.max(0, spec.spendMonthly - spec.pensionMonthly);
  const ranges = paths > 0 ? withdrawalRanges(spec, paths) : null;
  const cash = input.holdings.filter((h) => h.planned && h.assetClass === 'cash').sort((a, b) => b.value - a.value);
  return {
    age: currentAge(input.profile, input.today),
    spend: spec.spendMonthly,
    pension: spec.pensionMonthly,
    fromSavings,
    corpus,
    rate: corpus > 0 ? withdrawalRate(fromSavings, corpus) : 0,
    likelyAge: withdrawalLikely(spec).lastsUntil,
    almostSureAge: ranges?.almostSure ?? null,
    buckets: spec.buckets,
    refill: fromSavings * 12,
    isRefillMonth: input.today % 12 === 3,
    cashHolding: cash[0] ?? null,
  };
}

/**
 * "I've withdrawn it" (7.3): the month's draw comes out of the cash holding; in April the refill
 * moves from the income bucket's holdings (debt, in proportion) into it. Returns changed holdings.
 */
export function applyWithdrawal(holdings: Holding[], p: IncomePlan, withRefill: boolean, today: number): Holding[] {
  if (!p.cashHolding) return [];
  const out = new Map<string, Holding>();
  let cashValue = p.cashHolding.value - p.fromSavings;
  if (withRefill && p.isRefillMonth) {
    const debt = holdings.filter((h) => h.planned && h.assetClass === 'debt');
    const total = debt.reduce((a, h) => a + h.value, 0);
    const move = Math.min(p.refill, total);
    for (const h of debt) out.set(h.id, { ...h, value: Math.round(h.value - (move * h.value) / total), valueAt: today });
    cashValue += move;
  }
  out.set(p.cashHolding.id, { ...p.cashHolding, value: Math.max(0, Math.round(cashValue)), valueAt: today });
  return [...out.values()];
}
