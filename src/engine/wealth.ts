/**
 * Wealth (5.1–5.6): net worth, the mix check, the single-stock nudge, prepay-or-invest for loans,
 * and a class-by-class projection for the timeline. Pure TS.
 */
import { GLOBAL_SHARE_OF_EQUITY, PROFILE_MIX, allocate, monthlyRate, targetWeights } from './core';
import { effectiveRisk, goalBalances, goalSpec, planGoals } from './plan';
import { PLANNED_CLASSES, type Loan, type PlanInput, type PlannedClass } from './types';

export function netWorth(input: PlanInput) {
  const own = input.holdings.reduce((a, h) => a + h.value, 0);
  const owe = input.loans.reduce((a, l) => a + l.balance, 0);
  return { own, owe, total: own - owe };
}

export type MixRow = { cls: PlannedClass; actual: number; target: number; value: number };
export type MixCheck = {
  rows: MixRow[];
  equityActual: number;
  equityTarget: number;
  /** Equity percentage points over (+) or under (−) target. */
  drift: number;
  /** Months of new money (no selling) to bring equity back to target; 0 when within 2 points. */
  monthsToFix: number;
  planned: number;
};

/**
 * Actual mix of planned money vs the goals' combined target: each goal's horizon-capped mix,
 * weighted by the money it holds.
 */
export function mixCheck(input: PlanInput): MixCheck {
  const risk = effectiveRisk(input.profile);
  const actual = [0, 0, 0, 0, 0];
  for (const h of input.holdings) if (h.planned && h.assetClass !== 'other') actual[PLANNED_CLASSES.indexOf(h.assetClass)] += h.value;
  const planned = actual.reduce((a, b) => a + b, 0) || 1;
  const bal = goalBalances(input);
  const target = [0, 0, 0, 0, 0];
  let weight = 0;
  for (const g of input.goals.filter((x) => x.status === 'active')) {
    const b = (bal.get(g.id) ?? []).reduce((a, x) => a + x, 0);
    if (b <= 0) continue;
    const years = g.isSafetyNet ? 0 : Math.max(0, (goalSpec(input, g).months) / 12);
    const w = g.isSafetyNet ? [1, 0, 0, 0, 0] : targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], years);
    for (let k = 0; k < 5; k++) target[k] += w[k] * b;
    weight += b;
  }
  const t = target.map((v) => v / (weight || 1));
  const rows = PLANNED_CLASSES.map((cls, k) => ({ cls, actual: actual[k] / planned, target: t[k], value: actual[k] }));
  const eqA = rows[2].actual + rows[3].actual;
  const eqT = rows[2].target + rows[3].target;
  const equity = actual[2] + actual[3];
  // New money into non-equity until equity / total = target: equity / (planned + x) = eqT.
  const x = eqT > 0 ? equity / eqT - planned : 0;
  const drift = Math.round((eqA - eqT) * 100);
  const monthsToFix = Math.abs(drift) <= 2 || input.profile.monthly <= 0 ? 0 : Math.ceil(Math.max(0, x) / input.profile.monthly);
  return { rows, equityActual: eqA, equityTarget: eqT, drift, monthsToFix, planned };
}

/** Single stocks above 10% of investing (index and diversified funds, and stock groups, excluded). */
export function concentration(input: PlanInput): { holdingId: string; name: string; share: number }[] {
  const investing = input.holdings.filter((h) => h.planned && h.assetClass !== 'cash').reduce((a, h) => a + h.value, 0);
  if (investing <= 0) return [];
  return input.holdings
    .filter((h) => h.isStock && !h.group && h.value / investing > 0.1)
    .map((h) => ({ holdingId: h.id, name: h.name, share: h.value / investing }))
    .sort((a, b) => b.share - a.share);
}

/** EMIs left: from the loan's own end date when known, else by amortising the balance. */
export function emisLeft(l: Pick<Loan, 'balance' | 'ratePct' | 'emi'> & { endDate?: number }, today?: number): number {
  if (l.endDate != null && today != null && l.endDate > today) return l.endDate - today;
  const r = l.ratePct / 1200;
  let b = l.balance;
  let n = 0;
  while (b > 0.5 && n < 600) {
    const before = b * (1 + r);
    b = before - l.emi;
    n++;
    // A small leftover (under half an EMI) is paid with the last one, not as an EMI of its own.
    if (b > 0.5 && b * (1 + r) < l.emi * 0.5) break;
  }
  return n;
}

function totalInterest(balance: number, ratePct: number, emi: number): number {
  const r = ratePct / 1200;
  let b = balance;
  let paid = 0;
  let n = 0;
  while (b > 0.5 && n < 600) {
    const interest = b * r;
    const pay = Math.min(emi, b + interest);
    paid += pay;
    b = b + interest - pay;
    n++;
  }
  return paid - balance;
}

/**
 * Prepay ₹X now vs invest it (5.4): interest saved for sure, against the likely growth of the same
 * money over the loan's remaining months at the plan's expected mix return.
 */
export function prepayOrInvest(input: PlanInput, loan: Loan, amount = 100000) {
  const saved = totalInterest(loan.balance, loan.ratePct, loan.emi) - totalInterest(Math.max(0, loan.balance - amount), loan.ratePct, loan.emi);
  const months = emisLeft(loan, input.today);
  const risk = effectiveRisk(input.profile);
  const w = targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], months / 12);
  const r = w.reduce((a, wk, k) => a + wk * (input.assumptions.returnPct[PLANNED_CLASSES[k]] / 100), 0);
  const likely = amount * (Math.pow(1 + monthlyRate(r), months) - 1);
  return { saved: Math.round(saved / 100) * 100, likely: Math.round(likely / 100) * 100, months };
}

/** Planned money by class, month by month, for `months` ahead (5.5), each goal on its own mix and glide. */
export function projectByClass(input: PlanInput, months: number): { m: number; byClass: number[] }[] {
  const out = Array.from({ length: months + 1 }, (_, m) => ({ m, byClass: [0, 0, 0, 0, 0] }));
  const goals = [...planGoals(input), ...input.goals.filter((g) => g.isSafetyNet)];
  for (const g of goals) {
    const spec = goalSpec(input, g);
    const rates = spec.ret.map((r) => monthlyRate(r));
    const bal = spec.start.slice();
    for (let k = 0; k < 5; k++) out[0].byClass[k] += bal[k];
    for (let m = 0; m < months; m++) {
      const w = g.isSafetyNet ? [1, 0, 0, 0, 0] : targetWeights(spec.mix, spec.globalShare, Math.max(0, (spec.months - m) / 12));
      const c = m < spec.months || g.isRetirement ? spec.monthly * Math.pow(1 + spec.stepUp, Math.floor(m / 12)) : 0;
      allocate(bal, c, w);
      if (spec.fixed[m]) bal[spec.fixedClass] += spec.fixed[m];
      for (let k = 0; k < 5; k++) {
        bal[k] *= 1 + rates[k];
        out[m + 1].byClass[k] += bal[k];
      }
    }
  }
  return out;
}

/** Days since a value was last confirmed, from months (stale after 60 days). */
export const staleDays = (today: number, valueAt: number) => Math.round(Math.max(0, today - valueAt) * 30.4);

/** Holding split (5.6): moves goal `id` to `pct`; the other explicit shares absorb the change in
 * proportion, so they never total more than 100% (the rest counts towards Retirement). */
export function pushShares(shares: Record<string, number>, id: string, pct: number): Record<string, number> {
  const others = Object.keys(shares).filter((k) => k !== id);
  const room = 100 - pct;
  const otherSum = others.reduce((a, k) => a + shares[k], 0);
  const next: Record<string, number> = { [id]: pct };
  for (const k of others) next[k] = otherSum > room ? (otherSum > 0 ? Math.round((shares[k] / otherSum) * room) : 0) : shares[k];
  return next;
}

