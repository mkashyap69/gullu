/**
 * The v1 plan: goals × classes × flow rules → per-goal projections, required monthly,
 * chance bands, affordability words and this month's moves. Pure TS, no React, no I/O.
 */
import {
  CLASS_INDEX,
  CORRELATION,
  GLOBAL_SHARE_OF_EQUITY,
  N_CLASSES,
  PROFILE_MIX,
  allocate,
  cholesky,
  requiredMonthlyExact,
  roundUp500,
  simulateDeterministic,
  simulateMonteCarlo,
  targetWeights,
  type McResult,
  type SimSpec,
} from './core';
import { addMonths } from './dates';
import {
  PLANNED_CLASSES,
  RISK_ORDER,
  type Affordability,
  type ChanceBands,
  type FlowRule,
  type Goal,
  type GoalResult,
  type Holding,
  type MoveLine,
  type PlanInput,
  type PlannedClass,
  type Priority,
  type Profile,
  type RiskProfile,
} from './types';

/** Monte Carlo defaults: about 1,000 paths, seeded so results are stable between runs. */
export const MC_PATHS = 1000;
export const MC_SEED = 20280401;
/** How long past the goal date we keep simulating to find a late arrival. */
export const EXTRA_MONTHS = 36;
/**
 * Affordability thresholds (05-ENGINE.md step 9, tuned with the Manish fixture so Japan and
 * Retirement come out Comfortable, Home Manageable, Education Stretch):
 * Comfortable = actual ≥ required and either Almost sure reaches this share of the target, or the
 * actual amount carries this cushion over the exact required amount. Without the cushion, no
 * long-horizon goal could ever be Comfortable (its Almost sure path is far below its median).
 */
export const COMFORT_ALMOST_SURE_SHARE = 1;
export const COMFORT_CUSHION = 1.15;

export const CHOL = cholesky(CORRELATION, N_CLASSES);

/** Lower of capacity and tolerance wins, unless the user overrode it. */
export function effectiveRisk(p: Pick<Profile, 'riskCapacity' | 'riskTolerance' | 'riskOverride'>): RiskProfile {
  if (p.riskOverride) return p.riskOverride;
  const a = RISK_ORDER.indexOf(p.riskCapacity);
  const b = RISK_ORDER.indexOf(p.riskTolerance);
  return RISK_ORDER[Math.min(a, b)];
}

export function currentAge(p: Profile, today: number): number {
  return p.age + Math.floor((today - p.ageAt) / 12);
}

const PRIORITY_RANK: Record<Priority, number> = { must: 0, should: 1, nice: 2 };

function emptyClasses(): number[] {
  return [0, 0, 0, 0, 0];
}

function classIndex(c: Holding['assetClass']): number {
  return c === 'other' ? -1 : CLASS_INDEX[c];
}

// Per-input caches: inputs are treated as immutable snapshots (the stores replace, never mutate).
const sharesCache = new WeakMap<PlanInput, Map<string, Map<string, number>>>();
const balancesCache = new WeakMap<PlanInput, Map<string, number[]>>();
const flowsCache = new WeakMap<PlanInput, { months: number; map: Map<string, { cls: number; flows: number[] }> }>();

/** Holding → goal shares. Unassigned share goes to Retirement (05-ENGINE.md step 5). */
export function holdingShares(input: PlanInput): Map<string, Map<string, number>> {
  const cached = sharesCache.get(input);
  if (cached) return cached;
  const retire = input.goals.find((g) => g.isRetirement);
  const out = new Map<string, Map<string, number>>();
  for (const h of input.holdings) {
    const m = new Map<string, number>();
    let sum = 0;
    for (const hg of input.holdingGoals) {
      if (hg.holdingId !== h.id) continue;
      m.set(hg.goalId, (m.get(hg.goalId) ?? 0) + hg.pct / 100);
      sum += hg.pct / 100;
    }
    if (sum < 0.999 && retire) m.set(retire.id, (m.get(retire.id) ?? 0) + (1 - sum));
    out.set(h.id, m);
  }
  sharesCache.set(input, out);
  return out;
}

/** Current balance per class for each goal, from the planned holdings assigned to it. */
export function goalBalances(input: PlanInput): Map<string, number[]> {
  const cached = balancesCache.get(input);
  if (cached) return cached;
  const shares = holdingShares(input);
  const out = new Map<string, number[]>();
  for (const g of input.goals) out.set(g.id, emptyClasses());
  for (const h of input.holdings) {
    const k = classIndex(h.assetClass);
    if (k < 0 || !h.planned) continue;
    for (const [goalId, s] of shares.get(h.id) ?? []) {
      const b = out.get(goalId);
      if (b) b[k] += h.value * s;
    }
  }
  balancesCache.set(input, out);
  return out;
}

/**
 * Fixed monthly flows per goal: commitment rules (PPF etc., spread evenly to 31 March) and
 * automatic money like EPF from salary (rising with the yearly raise).
 */
export function commitmentFlows(input: PlanInput, months: number): Map<string, { cls: number; flows: number[] }> {
  const cached = flowsCache.get(input);
  if (cached && cached.months >= months) return cached.map;
  const shares = holdingShares(input);
  const out = new Map<string, { cls: number; flows: number[] }>();
  const addFlows = (h: Holding, flows: number[]) => {
    const cls = Math.max(0, classIndex(h.assetClass));
    for (const [goalId, s] of shares.get(h.id) ?? []) {
      const prev = out.get(goalId);
      if (prev) for (let m = 0; m < months; m++) prev.flows[m] += flows[m] * s;
      else out.set(goalId, { cls, flows: flows.map((f) => f * s) });
    }
  };
  for (const h of input.holdings) {
    if (!h.autoMonthly || !h.planned) continue;
    const step = input.assumptions.stepUpPct / 100;
    addFlows(h, Array.from({ length: months }, (_, m) => h.autoMonthly! * Math.pow(1 + step, Math.floor(m / 12))));
  }
  for (const rule of input.flowRules) {
    if (rule.type !== 'commitment' || !rule.enabled) continue;
    const h = input.holdings.find((x) => x.id === rule.holdingId);
    if (!h) continue;
    let paid = rule.paidThisYear;
    const flows = new Array(months).fill(0);
    for (let m = 0; m < months; m++) {
      const cm = (input.today + m) % 12;
      if (cm === 3 && m > 0) paid = 0;
      const mlf = cm <= 2 ? 3 - cm : 15 - cm;
      const a = Math.max(0, rule.yearlyCap - paid) / mlf;
      flows[m] = a;
      paid += a;
    }
    addFlows(h, flows);
  }
  flowsCache.set(input, { months, map: out });
  return out;
}

/** The commitment amounts due this month, per rule. */
export function commitmentsThisMonth(input: PlanInput): { rule: Extract<FlowRule, { type: 'commitment' }>; amount: number }[] {
  const out: { rule: Extract<FlowRule, { type: 'commitment' }>; amount: number }[] = [];
  const cm = input.today % 12;
  const mlf = cm <= 2 ? 3 - cm : 15 - cm;
  for (const rule of input.flowRules) {
    if (rule.type !== 'commitment' || !rule.enabled) continue;
    out.push({ rule, amount: Math.max(0, rule.yearlyCap - rule.paidThisYear) / mlf });
  }
  return out;
}

/** Retirement corpus needed at `retireAge`, in today's rupees (annuity-due at the real return). */
export function retirementCorpus(goal: Goal, input: PlanInput, retireAge: number): number {
  const r = goal.retirement;
  if (!r) return goal.targetToday;
  const n = Math.max(1, r.untilAge - retireAge);
  const real = input.assumptions.retirementRealReturnPct / 100;
  const yearly = Math.max(0, r.targetMonthly - (r.pensionMonthly ?? 0)) * 12;
  const factor = real === 0 ? n : ((1 - Math.pow(1 + real, -n)) / real) * (1 + real);
  return yearly * factor;
}

export function retirementDate(goal: Goal, input: PlanInput, retireAge?: number): number {
  const age = retireAge ?? goal.retirement?.retireAge ?? 60;
  return input.profile.ageAt + (age - input.profile.age) * 12;
}

/** The simulation spec for one goal. `override` lets What if and "could stop at" vary inputs. */
export function goalSpec(
  input: PlanInput,
  goal: Goal,
  override: { monthly?: number; date?: number; targetToday?: number; replay?: number[][] } = {},
): SimSpec {
  const risk = effectiveRisk(input.profile);
  const date = override.date ?? (goal.isRetirement ? retirementDate(goal, input) : goal.date);
  const months = Math.max(0, date - input.today);
  const extra = EXTRA_MONTHS;
  const comm = commitmentFlows(input, months + extra).get(goal.id);
  const a = input.assumptions;
  const ret = PLANNED_CLASSES.map((c) => a.returnPct[c] / 100);
  const vol = PLANNED_CLASSES.map((c) => a.volatilityPct[c] / 100);
  const targetToday =
    override.targetToday ??
    (goal.isRetirement ? retirementCorpus(goal, input, goal.retirement?.retireAge ?? 60) : goal.targetToday);
  return {
    start: (goalBalances(input).get(goal.id) ?? emptyClasses()).slice(),
    months,
    extraMonths: extra,
    monthly: override.monthly ?? goal.monthly,
    stepUp: a.stepUpPct / 100,
    fixed: comm ? comm.flows.slice(0, months + extra) : new Array(months + extra).fill(0),
    fixedClass: comm?.cls ?? CLASS_INDEX.debt,
    mix: [...PROFILE_MIX[risk]],
    globalShare: GLOBAL_SHARE_OF_EQUITY[risk],
    ret,
    vol,
    targetToday,
    infl: goal.inflationPct / 100,
    replay: override.replay,
  };
}

/**
 * Affordability word (05-ENGINE.md step 9).
 * Stretch: actual < required. Comfortable: actual ≥ required and Almost sure reaches the target
 * (within COMFORT_ALMOST_SURE_SHARE). Manageable: actual ≥ required otherwise.
 */
export function affordabilityWord(
  actual: number,
  required: number | null,
  requiredExact: number | null,
  almostSure: number | null,
  target: number,
): Affordability {
  if (required == null || requiredExact == null || actual < required) return 'stretch';
  if (almostSure != null && almostSure >= target * COMFORT_ALMOST_SURE_SHARE) return 'comfortable';
  if (actual >= requiredExact * COMFORT_CUSHION) return 'comfortable';
  return 'manageable';
}

function mixOf(bal: number[]): Record<PlannedClass, number> {
  const tot = bal.reduce((x, y) => x + y, 0) || 1;
  const out = {} as Record<PlannedClass, number>;
  PLANNED_CLASSES.forEach((c, k) => {
    out[c] = bal[k] / tot;
  });
  return out;
}

/** Earliest retirement age at which the likely path covers the corpus needed for that age. */
export function couldStopAt(input: PlanInput, goal: Goal): number | undefined {
  const r = goal.retirement;
  if (!r) return undefined;
  const age = currentAge(input.profile, input.today);
  let best: number | undefined;
  for (let a = r.retireAge; a > age; a--) {
    const spec = goalSpec(input, goal, { date: retirementDate(goal, input, a), targetToday: retirementCorpus(goal, input, a) });
    const det = simulateDeterministic(spec, undefined, false);
    const need = spec.targetToday * Math.pow(1 + spec.infl, spec.months / 12);
    if (det.final >= need) best = a;
    else break;
  }
  return best;
}

/** Fast single-line result for one goal (no Monte Carlo). */
export function goalResultFast(input: PlanInput, goal: Goal, override: Parameters<typeof goalSpec>[2] = {}): GoalResult {
  const spec = goalSpec(input, goal, override);
  const det = simulateDeterministic(spec);
  const exact = requiredMonthlyExact(spec);
  const req = exact == null ? null : roundUp500(exact);
  const deflate = Math.pow(1 + spec.infl, spec.months / 12);
  const likelyToday = det.final / deflate;
  const affordability = affordabilityWord(spec.monthly, req, exact, null, spec.targetToday);
  return {
    goalId: goal.id,
    name: goal.name,
    priority: goal.priority,
    months: spec.months,
    targetToday: spec.targetToday,
    targetNominal: spec.targetToday * deflate,
    current: spec.start.reduce((a, b) => a + b, 0),
    actualMonthly: spec.monthly,
    requiredMonthly: req,
    requiredExact: exact,
    likelyToday,
    bands: null,
    projectedDate: det.cross >= 0 ? addMonths(input.today, det.cross) : null,
    dateRange: null,
    affordability,
    onTrack: affordability !== 'stretch',
    shortBy: Math.max(0, spec.targetToday - likelyToday),
    mixNow: mixOf(spec.start),
    couldStopAt: goal.isRetirement ? couldStopAt(input, goal) : undefined,
  };
}

/**
 * Adds Monte Carlo ranges to a fast result. The single line stays the centre ("Likely"), so the
 * number on a slider and the number on the band always agree; Monte Carlo supplies the spread
 * (10th and 90th percentiles relative to its own median).
 */
export function withRanges(input: PlanInput, fast: GoalResult, mc: McResult): GoalResult {
  const [q10, q50, q90] = mc.atDateToday;
  const centre = fast.likelyToday;
  const p10 = q50 > 0 ? (centre * q10) / q50 : q10;
  const p90 = q50 > 0 ? (centre * q90) / q50 : q90;
  const bands: ChanceBands = { almostSure: p10, likely: centre, possible: p90 };
  const affordability = affordabilityWord(fast.actualMonthly, fast.requiredMonthly, fast.requiredExact, p10, fast.targetToday);
  const early = mc.crossMonths[0];
  const late = mc.crossMonths[2];
  return {
    ...fast,
    bands,
    dateRange: early >= 0 && late >= 0 ? [addMonths(input.today, early), addMonths(input.today, late)] : null,
    affordability,
    onTrack: affordability !== 'stretch',
  };
}

/** Plan goals: everything except the safety net. */
export function planGoals(input: PlanInput): Goal[] {
  return input.goals.filter((g) => !g.isSafetyNet && g.status === 'active');
}

export type SafetyNetResult = { goalId: string; target: number; current: number; full: boolean; months: number };

export function safetyNet(input: PlanInput): SafetyNetResult | null {
  const g = input.goals.find((x) => x.isSafetyNet);
  if (!g) return null;
  const months = g.safetyMonths ?? (input.profile.work === 'salaried' ? 6 : 9);
  const target = input.profile.monthlyExpenses * months;
  const current = (goalBalances(input).get(g.id) ?? emptyClasses()).reduce((a, b) => a + b, 0);
  return { goalId: g.id, target, current, full: current >= target - 1, months };
}

export type Plan = {
  goals: GoalResult[];
  safetyNet: SafetyNetResult | null;
  onTrack: number;
  total: number;
  /** The off-track goal with the biggest monthly gap, for the headline. */
  focus: { goalId: string; extraMonthly: number; shortBy: number } | null;
};

function summarise(input: PlanInput, goals: GoalResult[]): Plan {
  const off = goals
    .filter((g) => !g.onTrack && g.requiredMonthly != null)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.requiredMonthly! - b.actualMonthly) - (a.requiredMonthly! - a.actualMonthly));
  const f = off[0];
  return {
    goals,
    safetyNet: safetyNet(input),
    onTrack: goals.filter((g) => g.onTrack).length,
    total: goals.length,
    focus: f ? { goalId: f.goalId, extraMonthly: f.requiredMonthly! - f.actualMonthly, shortBy: f.bands ? Math.max(0, f.targetToday - f.bands.likely) : f.shortBy } : null,
  };
}

/** Single-line plan. ≤ 16ms budget: used live while sliders move. */
export function computePlanFast(input: PlanInput): Plan {
  return summarise(input, planGoals(input).map((g) => goalResultFast(input, g)));
}

/** Full plan with Monte Carlo ranges, run synchronously (tests, background runtime). */
export function computePlan(input: PlanInput, paths = MC_PATHS, seed = MC_SEED): Plan {
  const goals = planGoals(input).map((g, i) => {
    const fast = goalResultFast(input, g);
    const mc = simulateMonteCarlo(goalSpec(input, g), paths, seed + i * 7919, CHOL);
    return withRanges(input, fast, mc);
  });
  return summarise(input, goals);
}

// ---------- This month's moves ----------

/**
 * Splits this month's payday into goals (user-set amounts; owner decision 24 Nov 2026).
 * Short month: cut nice → should → must, and within a priority, the goals furthest ahead of
 * their required amount first. Extra money: goals furthest behind their required amount, by priority.
 */
export function splitPayday(
  input: PlanInput,
  amount: number,
  required: Map<string, number | null> = new Map(),
): { goalId: string; amount: number }[] {
  const goals = planGoals(input);
  const commitments = commitmentsThisMonth(input).reduce((a, c) => a + c.amount, 0);
  const sn = safetyNet(input);
  const snTopUp = sn && !sn.full ? sn.target - sn.current : 0;
  let pool = Math.max(0, amount - commitments - snTopUp);
  const base = goals.map((g) => ({ goal: g, amount: g.monthly }));
  const planned = base.reduce((a, b) => a + b.amount, 0);
  const slack = (g: Goal) => g.monthly - (required.get(g.id) ?? g.monthly);
  if (pool < planned) {
    let cut = planned - pool;
    const order = [...base].sort(
      (a, b) => PRIORITY_RANK[b.goal.priority] - PRIORITY_RANK[a.goal.priority] || slack(b.goal) - slack(a.goal),
    );
    for (const o of order) {
      const c = Math.min(cut, o.amount);
      o.amount -= c;
      cut -= c;
      if (cut <= 0) break;
    }
  } else if (pool > planned) {
    let extra = pool - planned;
    const order = [...base].sort(
      (a, b) => PRIORITY_RANK[a.goal.priority] - PRIORITY_RANK[b.goal.priority] || slack(a.goal) - slack(b.goal),
    );
    for (const o of order) {
      const gap = Math.max(0, -slack(o.goal));
      const add = Math.min(extra, gap);
      o.amount += add;
      extra -= add;
    }
    if (extra > 0 && order.length) order[0].amount += extra;
  }
  pool = 0;
  return base.map((b) => ({ goalId: b.goal.id, amount: b.amount }));
}

/**
 * This month's moves into the user's own holdings: each goal's amount is split by the goal's
 * mix (new money fills the gap to target first, so the mix glides without selling), then within a
 * class across that goal's holdings in proportion to what each already holds for the goal.
 */
export function movesThisMonth(input: PlanInput, split: { goalId: string; amount: number }[]): MoveLine[] {
  const risk = effectiveRisk(input.profile);
  const shares = holdingShares(input);
  const balances = goalBalances(input);
  const moves: MoveLine[] = [];
  for (const { rule, amount } of commitmentsThisMonth(input)) {
    const h = input.holdings.find((x) => x.id === rule.holdingId);
    if (!h || amount <= 0 || h.assetClass === 'other') continue;
    const [goalId] = [...(shares.get(h.id)?.keys() ?? [])];
    moves.push({ holdingId: h.id, goalId: goalId ?? '', assetClass: h.assetClass, amount });
  }
  const commitmentIds = new Set(
    input.flowRules.filter((r) => r.type === 'commitment' && r.enabled).map((r) => (r as { holdingId: string }).holdingId),
  );
  for (const { goalId, amount } of split) {
    const goal = input.goals.find((g) => g.id === goalId);
    if (!goal || amount <= 0) continue;
    const date = goal.isRetirement ? retirementDate(goal, input) : goal.date;
    const w = targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], Math.max(0, (date - input.today) / 12));
    const bal = (balances.get(goalId) ?? emptyClasses()).slice();
    const before = bal.slice();
    allocate(bal, amount, w);
    PLANNED_CLASSES.forEach((cls, k) => {
      const add = bal[k] - before[k];
      if (add < 0.5) return;
      const hs = input.holdings.filter(
        (h) => h.planned && h.assetClass === cls && !commitmentIds.has(h.id) && (shares.get(h.id)?.get(goalId) ?? 0) > 0,
      );
      const weights = hs.map((h) => h.value * (shares.get(h.id)?.get(goalId) ?? 0));
      const wsum = weights.reduce((a, b) => a + b, 0);
      if (hs.length === 0) {
        moves.push({ holdingId: '', goalId, assetClass: cls, amount: add });
        return;
      }
      hs.forEach((h, i) => moves.push({ holdingId: h.id, goalId, assetClass: cls, amount: wsum > 0 ? (add * weights[i]) / wsum : add / hs.length }));
    });
  }
  return moves;
}

/** Moves grouped by holding, rounded to ₹100, for the check-in list. */
export function movesByHolding(moves: MoveLine[]): { holdingId: string; assetClass: PlannedClass; amount: number }[] {
  const m = new Map<string, { holdingId: string; assetClass: PlannedClass; amount: number }>();
  for (const mv of moves) {
    const key = mv.holdingId || `class:${mv.assetClass}`;
    const prev = m.get(key);
    if (prev) prev.amount += mv.amount;
    else m.set(key, { holdingId: mv.holdingId, assetClass: mv.assetClass, amount: mv.amount });
  }
  return [...m.values()].map((x) => ({ ...x, amount: Math.round(x.amount / 100) * 100 })).sort((a, b) => b.amount - a.amount);
}
