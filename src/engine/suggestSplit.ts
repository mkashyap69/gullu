/**
 * Suggests how the money a user already has is shared across their goals (owner direction,
 * 24 Nov 2026: "smart enough to decide from the user's data, and the user can accept or edit").
 *
 * 1. Cash (then debt) fills the safety net.
 * 2. Locked retirement money (PPF, EPF, NPS) stays with Retirement.
 * 3. Everything else starts with Retirement. A chunk moves to another goal only when it lowers
 *    what the whole plan needs each month (the goal's relief minus what Retirement loses). Short
 *    goals only take safe money (cash, debt, gold); equity goes only where the horizon allows it.
 * 4. It stops as soon as the monthly amount covers every goal, so nothing is over-funded and the
 *    rest keeps compounding for Retirement.
 *
 * The result is per goal and per class; `toHoldingGoals` turns it into holding → goal percentages.
 * Pure TS, no React.
 */
import { CLASS_INDEX, GLOBAL_SHARE_OF_EQUITY, N_CLASSES, PROFILE_MIX, requiredMonthlyExact, targetWeights, type SimSpec } from './core';
import { commitmentsThisMonth, effectiveRisk, goalSpec, planGoals } from './plan';
import type { Goal, Holding, HoldingGoal, PlanInput } from './types';

export type ClassAmounts = number[]; // 5 classes, core.ts order
/** goalId → amounts per class taken from free (unlocked) money. Retirement holds the rest. */
export type Split = Record<string, ClassAmounts>;

export type GoalSuggestion = {
  goalId: string;
  name: string;
  amount: number;
  /** Required monthly with none of the existing money, and with the suggested amount. */
  requiredWithout: number;
  requiredWith: number;
  reason: 'safetyNet' | 'covers' | 'lowers' | 'none' | 'rest';
};

export type SplitSuggestion = {
  split: Split;
  /** Locked retirement money per class (PPF, EPF, NPS). */
  locked: ClassAmounts;
  /** Free money per class (planned holdings, not locked). */
  free: ClassAmounts;
  goals: GoalSuggestion[];
  /** What the monthly amount has to cover across goals (after PPF and the safety-net top-up). */
  budget: number;
  /** Total required monthly across goals with the suggested split. */
  required: number;
};

const LOCKED_TYPES: Holding['type'][] = ['ppf', 'epf', 'nps'];
const SAFE: number[] = [CLASS_INDEX.cash, CLASS_INDEX.debt, CLASS_INDEX.gold];
const EQUITY: number[] = [CLASS_INDEX.indianEquity, CLASS_INDEX.globalEquity];
const zero = () => [0, 0, 0, 0, 0];
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export const isLocked = (h: Pick<Holding, 'type'>) => LOCKED_TYPES.includes(h.type);

function classOf(h: Holding): number {
  return h.assetClass === 'other' ? -1 : CLASS_INDEX[h.assetClass];
}

/** Money the user can put in each month across goals: total minus commitments and the safety-net top-up. */
export function goalBudget(input: PlanInput, safetyHave: number): number {
  const commitments = commitmentsThisMonth(input).reduce((a, c) => a + c.amount, 0);
  const sn = input.goals.find((g) => g.isSafetyNet);
  const target = sn ? input.profile.monthlyExpenses * (sn.safetyMonths ?? 0) : 0;
  const topUp = Math.max(0, target - safetyHave) / 12;
  return Math.max(0, input.profile.monthly - commitments - topUp);
}

type Ctx = {
  input: PlanInput;
  goals: Goal[];
  retire: Goal | undefined;
  specs: Map<string, SimSpec>;
  locked: ClassAmounts;
  free: ClassAmounts;
};

function context(input: PlanInput): Ctx {
  const planned = input.holdings.filter((h) => h.planned && classOf(h) >= 0);
  const locked = zero();
  const free = zero();
  for (const h of planned) (isLocked(h) ? locked : free)[classOf(h)] += h.value;
  // Specs built with no assignments (everything defaults to Retirement); starts are set per call.
  const bare: PlanInput = { ...input, holdingGoals: [] };
  const goals = planGoals(input);
  const specs = new Map(goals.map((g) => [g.id, goalSpec(bare, g)]));
  return { input, goals, retire: goals.find((g) => g.isRetirement), specs, locked, free };
}

/** Required monthly for a goal starting from `start`; Infinity when out of reach. */
function req(ctx: Ctx, goalId: string, start: ClassAmounts): number {
  const spec = ctx.specs.get(goalId)!;
  const r = requiredMonthlyExact({ ...spec, start });
  return r == null ? Infinity : r;
}

function retireStart(ctx: Ctx, split: Split): ClassAmounts {
  const used = zero();
  for (const [id, a] of Object.entries(split)) if (id !== ctx.retire?.id) for (let k = 0; k < N_CLASSES; k++) used[k] += a[k];
  return ctx.free.map((f, k) => Math.max(0, f - used[k]) + ctx.locked[k]);
}

/** Free money not yet given to a goal, per class (it sits with Retirement). */
export function unassigned(s: Pick<SplitSuggestion, 'free' | 'split'>, retireId?: string): ClassAmounts {
  const used = zero();
  for (const [id, a] of Object.entries(s.split)) if (id !== retireId) for (let k = 0; k < N_CLASSES; k++) used[k] += a[k];
  return s.free.map((f, k) => Math.max(0, f - used[k]));
}

/**
 * A chunk of money for a goal, shaped like the goal's own mix (so equity never exceeds its horizon
 * cap). Goals under 3 years take safe money only. If a class is short, its share is made up from
 * classes of the same kind (safe ↔ safe, equity ↔ equity); only goals 7+ years away may use equity
 * in place of missing safe money.
 */
function chunkFor(ctx: Ctx, g: Goal, avail: ClassAmounts, chunk: number, current: ClassAmounts = zero()): ClassAmounts {
  const risk = effectiveRisk(ctx.input.profile);
  const years = Math.max(0, (g.date - ctx.input.today) / 12);
  const w = g.isSafetyNet ? [1, 0, 0, 0, 0] : targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], years);
  if (years < 3) {
    // Safe money only.
    const safe = w[CLASS_INDEX.cash] + w[CLASS_INDEX.debt] + w[CLASS_INDEX.gold] || 1;
    for (const k of EQUITY) w[k] = 0;
    for (const k of SAFE) w[k] = w[k] / safe;
  }
  const out = zero();
  let safeShort = 0;
  for (const group of [SAFE, EQUITY]) {
    let want = group.reduce((a, k) => a + w[k] * chunk, 0) + (group === EQUITY ? safeShort : 0);
    // First by the mix, then top up from the same group.
    for (const k of group) {
      const t = Math.min(w[k] * chunk, avail[k]);
      out[k] += t;
      want -= t;
    }
    for (const k of group) {
      if (want <= 1) break;
      const t = Math.min(want, avail[k] - out[k]);
      if (t > 0) {
        out[k] += t;
        want -= t;
      }
    }
    // Goals 7+ years away may hold equity where safe money has run out: existing portfolios often
    // carry more equity than the plan's mix, and long goals are where it belongs (new money brings
    // the mix back, 5.2). Shorter goals never take on extra risk.
    if (group === SAFE && years >= 7 && !g.isSafetyNet) safeShort = Math.max(0, want);
  }
  if (years < 7) {
    // Hold the goal's equity to its horizon cap against the safe money it actually has, so a
    // shortage of safe money can't let equity creep up chunk by chunk.
    const eqShare = EQUITY.reduce((a, k) => a + w[k], 0);
    const safeTotal = SAFE.reduce((a, k) => a + current[k] + out[k], 0);
    const eqNow = EQUITY.reduce((a, k) => a + current[k], 0);
    const eqMax = eqShare >= 1 ? Infinity : (eqShare / (1 - eqShare)) * safeTotal;
    let room = Math.max(0, eqMax - eqNow);
    for (const k of EQUITY) {
      out[k] = Math.min(out[k], room);
      room -= out[k];
    }
  }
  return out;
}

const PRIORITY_WEIGHT = { must: 1.15, should: 1, nice: 0.9 } as const;

export function suggestSplit(input: PlanInput): SplitSuggestion {
  const ctx = context(input);
  const split: Split = {};
  const pool = ctx.free.slice();

  // 1. Safety net: cash, then debt.
  const sn = input.goals.find((g) => g.isSafetyNet);
  let safetyHave = 0;
  if (sn) {
    let need = input.profile.monthlyExpenses * (sn.safetyMonths ?? 0);
    const a = zero();
    for (const k of [CLASS_INDEX.cash, CLASS_INDEX.debt]) {
      const t = Math.min(need, pool[k]);
      a[k] += t;
      pool[k] -= t;
      need -= t;
    }
    if (sum(a) > 0) split[sn.id] = a;
    safetyHave = sum(a);
  }

  const budget = goalBudget(input, safetyHave);
  const others = ctx.goals.filter((g) => !g.isRetirement);
  const withoutReq = new Map(ctx.goals.map((g) => [g.id, req(ctx, g.id, g.isRetirement ? retireStart(ctx, split) : zero())]));
  for (const g of others) split[g.id] = zero();

  // 2–4. Greedy: move chunks from Retirement while it lowers the plan's total monthly need.
  const totalFree = sum(pool);
  const chunk = Math.max(25000, totalFree / 30);
  const reqNow = new Map<string, number>(withoutReq);
  const total = () => [...reqNow.values()].reduce((a, b) => a + Math.max(0, b), 0);
  for (let iter = 0; iter < 120 && others.length; iter++) {
    if (total() <= budget) break;
    const rStart = retireStart(ctx, split);
    const rNow = ctx.retire ? reqNow.get(ctx.retire.id)! : 0;
    let best: { g: Goal; add: ClassAmounts; gain: number; gReq: number; rReq: number } | null = null;
    for (const g of others) {
      const gNow = reqNow.get(g.id)!;
      if (gNow <= 0) continue;
      const avail = rStart.map((v, k) => Math.max(0, v - ctx.locked[k]));
      const add = chunkFor(ctx, g, avail, chunk, split[g.id]);
      const c = sum(add);
      if (c <= 1) continue;
      const next = split[g.id].map((v, k) => v + add[k]);
      const gReq = req(ctx, g.id, next);
      let rReq = rNow;
      if (ctx.retire) rReq = req(ctx, ctx.retire.id, rStart.map((v, k) => v - add[k]));
      const gain = ((gNow - Math.max(0, gReq)) * PRIORITY_WEIGHT[g.priority] - (rReq - rNow)) / c;
      if (gain > 0 && (!best || gain > best.gain)) best = { g, add, gain, gReq, rReq };
    }
    if (!best) break;
    split[best.g.id] = split[best.g.id].map((v, k) => v + best!.add[k]);
    reqNow.set(best.g.id, Math.max(0, best.gReq));
    if (ctx.retire) reqNow.set(ctx.retire.id, best.rReq);
  }

  for (const id of Object.keys(split)) if (sum(split[id]) <= 0) delete split[id];
  return summarise(ctx, split, budget, withoutReq);
}

function summarise(ctx: Ctx, split: Split, budget: number, withoutReq?: Map<string, number>): SplitSuggestion {
  const snId = ctx.input.goals.find((x) => x.isSafetyNet)?.id;
  const baseSplit: Split = snId && split[snId] ? { [snId]: split[snId] } : {};
  const without = withoutReq ?? new Map(ctx.goals.map((g) => [g.id, req(ctx, g.id, g.isRetirement ? retireStart(ctx, baseSplit) : zero())]));
  const goals: GoalSuggestion[] = [];
  const sn = ctx.input.goals.find((g) => g.isSafetyNet);
  if (sn && split[sn.id]) goals.push({ goalId: sn.id, name: sn.name, amount: sum(split[sn.id]), requiredWithout: 0, requiredWith: 0, reason: 'safetyNet' });
  let required = 0;
  for (const g of ctx.goals) {
    const start = g.isRetirement ? retireStart(ctx, split) : (split[g.id] ?? zero());
    const w = Math.max(0, req(ctx, g.id, start));
    required += w;
    const amount = sum(start);
    goals.push({
      goalId: g.id,
      name: g.name,
      amount,
      requiredWithout: Math.max(0, without.get(g.id) ?? w),
      requiredWith: w,
      reason: g.isRetirement ? 'rest' : amount <= 0 ? 'none' : w <= 0 ? 'covers' : 'lowers',
    });
  }
  return { split, locked: ctx.locked, free: ctx.free, goals, budget, required };
}

/**
 * The user changes how much of their money a goal gets. Extra comes from what sits with
 * Retirement (only kinds the goal's horizon allows); less goes back to Retirement.
 * Returns the updated suggestion with fresh monthly needs.
 */
export function setGoalAmount(input: PlanInput, s: SplitSuggestion, goalId: string, amount: number): SplitSuggestion {
  const ctx = context(input);
  const split: Split = Object.fromEntries(Object.entries(s.split).map(([k, v]) => [k, v.slice()]));
  const g = input.goals.find((x) => x.id === goalId);
  if (!g || g.isRetirement) return s;
  const cur = split[goalId] ?? zero();
  let delta = amount - sum(cur);
  if (delta < 0) {
    // Give back: riskiest first for short goals doesn't matter; reduce proportionally.
    const t = sum(cur);
    const f = t > 0 ? amount / t : 0;
    split[goalId] = cur.map((v) => v * f);
  } else {
    const free = unassigned({ free: s.free, split }, ctx.retire?.id);
    const add = chunkFor(ctx, g, free, delta, cur);
    split[goalId] = cur.map((v, k) => v + add[k]);
  }
  if (sum(split[goalId]) <= 0) delete split[goalId];
  return summarise(ctx, split, s.budget);
}

/** Most a goal could take: what it has plus the free money its horizon allows. */
export function maxForGoal(input: PlanInput, s: SplitSuggestion, goalId: string): number {
  const ctx = context(input);
  const g = input.goals.find((x) => x.id === goalId);
  if (!g || g.isRetirement) return 0;
  const free = unassigned(s, ctx.retire?.id);
  // Shaped like the goal's mix, so the most it can take is bounded by its scarcest kind of money.
  return sum(s.split[goalId] ?? zero()) + sum(chunkFor(ctx, g, free, sum(free), s.split[goalId] ?? zero()));
}

/** Holding → goal percentages: locked holdings and the rest stay with Retirement (unassigned). */
export function toHoldingGoals(input: PlanInput, s: Pick<SplitSuggestion, 'split' | 'free'>): HoldingGoal[] {
  const out: HoldingGoal[] = [];
  const retireId = input.goals.find((g) => g.isRetirement)?.id;
  for (const h of input.holdings) {
    const k = classOf(h);
    if (k < 0 || !h.planned || isLocked(h) || s.free[k] <= 0) continue;
    for (const [goalId, a] of Object.entries(s.split)) {
      if (goalId === retireId) continue;
      const pct = Math.round((a[k] / s.free[k]) * 10000) / 100;
      if (pct > 0) out.push({ holdingId: h.id, goalId, pct });
    }
  }
  return out;
}
