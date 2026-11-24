/**
 * Withdrawal mode (05-ENGINE.md step 8): monthly income from three buckets.
 * Cash covers the next 2 years of spending, Income (low risk) years 3–7, Growth the rest.
 * Each April, Income refills Cash back to 2 years; Growth refills Income, except after a down
 * year for growth (then we wait, so nothing is sold low). "Money lasts until age" comes from the
 * median path (Likely) and the 10th-percentile path (Almost sure).
 */
import { makeRng } from './core';

export type BucketState = { cash: number; income: number; growth: number };

export type WithdrawalSpec = {
  buckets: BucketState;
  /** Spending per month in today's rupees. */
  spendMonthly: number;
  /** Pension per month in rupees (not inflation-linked unless `pensionIndexed`). */
  pensionMonthly: number;
  pensionIndexed?: boolean;
  inflationPct: number;
  /** Expected yearly return % per bucket. */
  returnPct: BucketState;
  /** Yearly volatility % per bucket. */
  volatilityPct: BucketState;
  startAge: number;
  /** Month index (0 = Jan) of the first simulated month. */
  startMonth: number;
  maxAge: number;
  cashYears: number;
  incomeYears: number;
};

export type WithdrawalPath = {
  /** Age (in whole years) at which the money runs out, or maxAge if it never does. */
  lastsUntil: number;
  /** Total in rupees at the end of each year. */
  yearly: number[];
  refills: { month: number; amount: number }[];
};

function step(spec: WithdrawalSpec, draw: () => { cash: number; income: number; growth: number }): WithdrawalPath {
  const b = { ...spec.buckets };
  const H = (spec.maxAge - spec.startAge) * 12;
  const yearly: number[] = [];
  const refills: { month: number; amount: number }[] = [];
  const infl = spec.inflationPct / 100;
  let growthYearStart = b.growth;
  for (let m = 0; m < H; m++) {
    const cm = (spec.startMonth + m) % 12;
    const priceLevel = Math.pow(1 + infl, m / 12);
    const spend = spec.spendMonthly * priceLevel;
    const pension = spec.pensionMonthly * (spec.pensionIndexed ? priceLevel : 1);
    if (cm === 3 && m > 0) {
      const yearSpend = Math.max(0, spend - pension) * 12;
      // Income → cash, back to `cashYears` of spending.
      const toCash = Math.max(0, Math.min(b.income, spec.cashYears * yearSpend - b.cash));
      b.income -= toCash;
      b.cash += toCash;
      if (toCash > 0) refills.push({ month: m, amount: toCash });
      // Growth → income, only if growth didn't fall this year.
      const growthUp = b.growth >= growthYearStart;
      if (growthUp) {
        const toIncome = Math.max(0, Math.min(b.growth, spec.incomeYears * yearSpend - b.income));
        b.growth -= toIncome;
        b.income += toIncome;
      }
      growthYearStart = b.growth;
    }
    let need = Math.max(0, spend - pension);
    for (const k of ['cash', 'income', 'growth'] as const) {
      const t = Math.min(need, b[k]);
      b[k] -= t;
      need -= t;
    }
    if (need > 1) {
      return { lastsUntil: spec.startAge + Math.floor(m / 12), yearly, refills };
    }
    const g = draw();
    b.cash *= g.cash;
    b.income *= g.income;
    b.growth *= g.growth;
    if (m % 12 === 11) yearly.push(b.cash + b.income + b.growth);
  }
  return { lastsUntil: spec.maxAge, yearly, refills };
}

const mrate = (pct: number) => Math.pow(1 + pct / 100, 1 / 12);

export function withdrawalLikely(spec: WithdrawalSpec): WithdrawalPath {
  const g = { cash: mrate(spec.returnPct.cash), income: mrate(spec.returnPct.income), growth: mrate(spec.returnPct.growth) };
  return step(spec, () => g);
}

/** Monte Carlo of the withdrawal plan. Returns the age money lasts until at the 10th and 50th percentiles. */
export function withdrawalRanges(spec: WithdrawalSpec, paths = 1000, seed = 7): { almostSure: number; likely: number } {
  const rnd = makeRng(seed);
  const normal = () => {
    const u1 = Math.max(rnd(), 1e-12);
    const u2 = rnd();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const ages: number[] = [];
  const ks = ['cash', 'income', 'growth'] as const;
  const mu = Object.fromEntries(ks.map((k) => [k, Math.log(1 + spec.returnPct[k] / 100) / 12])) as BucketState;
  const sig = Object.fromEntries(ks.map((k) => [k, spec.volatilityPct[k] / 100 / Math.sqrt(12)])) as BucketState;
  for (let p = 0; p < paths; p++) {
    const r = step(spec, () => ({
      cash: Math.exp(mu.cash + sig.cash * normal()),
      income: Math.exp(mu.income + sig.income * normal()),
      growth: Math.exp(mu.growth + sig.growth * normal()),
    }));
    ages.push(r.lastsUntil);
  }
  ages.sort((a, b) => a - b);
  return { almostSure: ages[Math.floor(paths * 0.1)], likely: ages[Math.floor(paths * 0.5)] };
}

/** Withdrawal rate: yearly draw from savings as a share of the corpus. */
export const withdrawalRate = (fromSavingsMonthly: number, corpus: number) => (fromSavingsMonthly * 12) / corpus;
