/**
 * Onboarding (1.1–1.7): turn the user's answers into a full PlanInput.
 * Pure TS. Owner decisions (24 Nov 2026):
 * - First split: by priority — commitments, safety net top-up, then each goal up to its required
 *   amount (must → should → nice, nearest date first), extra to the furthest-behind goal.
 * - Existing holdings: auto-assigned by horizon (cash → safety net, then nearest goals first,
 *   matched to each goal's mix, up to its present-day need; the rest → Retirement).
 * - Income and expenses are asked on 1.2.
 * Drafted content (risk questions, templates) is listed in docs/progress.md for owner review.
 */
import { CLASS_INDEX, GLOBAL_SHARE_OF_EQUITY, N_CLASSES, PROFILE_MIX, monthlyRate, requiredMonthlyExact, roundUp500, targetWeights } from './core';
import { goalSpec, planGoals, retirementDate } from './plan';
import {
  PLANNED_CLASSES,
  RISK_ORDER,
  type Assumptions,
  type FlowRule,
  type Goal,
  type Holding,
  type HoldingGoal,
  type Loan,
  type PlanInput,
  type Priority,
  type Profile,
  type RiskProfile,
  type Stage,
  type Work,
  type YM,
} from './types';

// ---------- life stage ----------

export function stageFor(age: number, work: Work): Stage {
  if (work === 'retired' || age >= 60) return 'retiree';
  if (age >= 56) return 'preRetiree';
  if (age >= 41) return 'peak';
  if (age >= 28) return 'builder';
  return 'starter';
}

/** Months of expenses the safety net holds: 6 salaried, 9 business or freelance, 0 retired (three buckets instead). */
export function safetyMonthsFor(work: Work): number {
  return work === 'salaried' ? 6 : work === 'retired' ? 0 : 9;
}

// ---------- risk check (DRAFT questions, flagged for owner review) ----------

export type RiskAnswerKey = 'stability' | 'savings' | 'fall' | 'choice' | 'experience';
export type RiskQuestion = { key: RiskAnswerKey; scores: 'capacity' | 'tolerance'; question: string; options: { label: string; points: number }[] };

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    key: 'stability',
    scores: 'capacity',
    question: 'How steady is the money that comes in each month?',
    options: [
      { label: 'Very steady, same every month', points: 20 },
      { label: 'Mostly steady', points: 13 },
      { label: 'It goes up and down', points: 5 },
    ],
  },
  {
    key: 'savings',
    scores: 'capacity',
    question: 'If your income stopped, how long could your savings cover your expenses?',
    options: [
      { label: 'Less than 3 months', points: 4 },
      { label: '3 to 6 months', points: 12 },
      { label: 'More than 6 months', points: 20 },
    ],
  },
  {
    // Verbatim from 02-SCREENS.md (1.3).
    key: 'fall',
    scores: 'tolerance',
    question: 'Your ₹10 L falls to ₹7.5 L in a bad year. What do you do?',
    options: [
      { label: 'Sell everything to stop the loss', points: 0 },
      { label: 'Sell some and wait', points: 10 },
      { label: 'Do nothing and keep going', points: 25 },
      { label: 'Invest more while it is cheap', points: 35 },
    ],
  },
  {
    key: 'choice',
    scores: 'tolerance',
    question: 'You put in ₹10 L for 5 years. Which would you pick?',
    options: [
      { label: '₹13 L, almost sure', points: 0 },
      { label: 'Likely ₹16 L, could be ₹11 L', points: 20 },
      { label: 'Likely ₹19 L, could be ₹8 L', points: 35 },
    ],
  },
  {
    key: 'experience',
    scores: 'tolerance',
    question: 'Have you stayed invested through a big fall before?',
    options: [
      { label: "I haven't invested yet", points: 0 },
      { label: "I've invested, but not through a big fall", points: 10 },
      { label: 'Yes, and I held on', points: 20 },
      { label: 'Yes, and I put in more', points: 30 },
    ],
  },
];

/** Score 0–100 → profile. The same bands for capacity and tolerance. */
export function profileForScore(score: number): RiskProfile {
  if (score < 30) return 'safetyFirst';
  if (score < 45) return 'cautious';
  if (score < 60) return 'balanced';
  if (score < 88) return 'growth';
  return 'aggressive';
}

export type RiskInputs = {
  age: number;
  dependents: number;
  monthlyIncome: number;
  emis: number;
  answers: Partial<Record<RiskAnswerKey, number>>; // option index per question
};

const pts = (key: RiskAnswerKey, idx: number | undefined) => {
  const q = RISK_QUESTIONS.find((x) => x.key === key)!;
  return idx == null ? 0 : (q.options[idx]?.points ?? 0);
};

/** Capacity: age, income stability, dependents, EMIs as a share of income, safety net. Max 100. */
export function capacityScore(r: RiskInputs): number {
  const age = r.age < 30 ? 25 : r.age < 40 ? 20 : r.age < 50 ? 14 : r.age < 60 ? 8 : 3;
  const deps = r.dependents <= 0 ? 20 : r.dependents === 1 ? 15 : r.dependents === 2 ? 11 : 6;
  const share = r.monthlyIncome > 0 ? r.emis / r.monthlyIncome : 0;
  const emi = share < 0.1 ? 15 : share < 0.25 ? 10 : share < 0.4 ? 5 : 0;
  return age + deps + emi + pts('stability', r.answers.stability) + pts('savings', r.answers.savings);
}

/** Tolerance: the two scenario questions plus experience. Max 100. */
export function toleranceScore(r: RiskInputs): number {
  return pts('fall', r.answers.fall) + pts('choice', r.answers.choice) + pts('experience', r.answers.experience);
}

export function scoreRisk(r: RiskInputs): { capacity: RiskProfile; tolerance: RiskProfile; profile: RiskProfile } {
  const capacity = profileForScore(capacityScore(r));
  const tolerance = profileForScore(toleranceScore(r));
  const profile = RISK_ORDER[Math.min(RISK_ORDER.indexOf(capacity), RISK_ORDER.indexOf(tolerance))];
  return { capacity, tolerance, profile };
}

// ---------- goal templates (DRAFT defaults, flagged for owner review) ----------

export type TemplateId = 'safety' | 'home' | 'education' | 'retirement' | 'travel' | 'car' | 'wedding' | 'parents' | 'health' | 'income' | 'legacy' | 'custom';

export type GoalTemplate = {
  id: TemplateId;
  name: string;
  priority: Priority;
  inflationPct: number;
  /** Target in today's rupees, from the user's numbers. */
  target: (ctx: TemplateCtx) => number;
  /** Months from today. */
  inMonths: (ctx: TemplateCtx) => number;
  /** The second line on 1.4. */
  detail: (ctx: TemplateCtx) => string;
};

export type TemplateCtx = { today: YM; age: number; work: Work; monthlyExpenses: number; retireAge: number };

const yearOf = (ctx: TemplateCtx, months: number) => Math.floor((ctx.today + months) / 12);

export const TEMPLATES: Record<TemplateId, GoalTemplate> = {
  safety: { id: 'safety', name: 'Safety net', priority: 'must', inflationPct: 6, target: (c) => c.monthlyExpenses * safetyMonthsFor(c.work), inMonths: () => 0, detail: (c) => `${safetyMonthsFor(c.work)} months of expenses` },
  home: { id: 'home', name: 'Home', priority: 'must', inflationPct: 6, target: () => 3000000, inMonths: () => 44, detail: () => 'Down payment' },
  education: {
    id: 'education',
    name: "Child's education",
    priority: 'must',
    inflationPct: 10,
    target: () => 4000000,
    // College at 18 for a child of about 2: Jun, 16 years on.
    inMonths: (c) => 16 * 12 + ((5 - (c.today % 12) + 12) % 12),
    detail: (c) => `College in ${yearOf(c, 16 * 12 + ((5 - (c.today % 12) + 12) % 12))}`,
  },
  retirement: { id: 'retirement', name: 'Retirement', priority: 'should', inflationPct: 6, target: () => 0, inMonths: (c) => (c.retireAge - c.age) * 12, detail: (c) => `Stop working at ${c.retireAge}` },
  travel: { id: 'travel', name: 'Travel', priority: 'nice', inflationPct: 6, target: () => 300000, inMonths: (c) => 18 + ((9 - ((c.today + 18) % 12) + 12) % 12), detail: (c) => `A big trip, ${yearOf(c, 18 + ((9 - ((c.today + 18) % 12) + 12) % 12))}` },
  car: { id: 'car', name: 'Car', priority: 'nice', inflationPct: 6, target: () => 800000, inMonths: () => 36, detail: (c) => `In ${yearOf(c, 36)}` },
  wedding: { id: 'wedding', name: 'Wedding', priority: 'should', inflationPct: 7, target: () => 1500000, inMonths: () => 48, detail: (c) => `In ${yearOf(c, 48)}` },
  parents: { id: 'parents', name: "Parents' care", priority: 'should', inflationPct: 9, target: () => 2000000, inMonths: () => 120, detail: () => 'Health and support, over 10 years' },
  health: { id: 'health', name: 'Health corpus', priority: 'must', inflationPct: 9, target: () => 2500000, inMonths: (c) => (c.work === 'retired' ? 12 : Math.max(12, (60 - c.age) * 12)), detail: () => 'For bills insurance won’t cover' },
  income: { id: 'income', name: 'Monthly income', priority: 'must', inflationPct: 6, target: () => 0, inMonths: () => 0, detail: () => 'Paid to you each month' },
  custom: { id: 'custom', name: 'My goal', priority: 'should', inflationPct: 6, target: () => 1000000, inMonths: () => 36, detail: (c) => `In ${yearOf(c, 36)}` },
  legacy: { id: 'legacy', name: 'Legacy', priority: 'nice', inflationPct: 6, target: () => 5000000, inMonths: () => 240, detail: () => 'Something to pass on' },
};

/** Templates shown on 1.4 for a stage, with the ones pre-ticked (01-PRODUCT life stages). */
export function templatesForStage(stage: Stage): { id: TemplateId; ticked: boolean }[] {
  const on = (ids: TemplateId[], off: TemplateId[] = []) => [...ids.map((id) => ({ id, ticked: true })), ...off.map((id) => ({ id, ticked: false }))];
  switch (stage) {
    case 'starter':
      return on(['safety', 'retirement', 'travel'], ['home', 'car', 'wedding']);
    case 'builder':
      return on(['safety', 'home', 'education', 'retirement', 'travel'], ['car', 'wedding']);
    case 'peak':
      return on(['safety', 'education', 'retirement', 'parents'], ['home', 'travel', 'car']);
    case 'preRetiree':
      return on(['safety', 'retirement', 'health'], ['travel', 'legacy']);
    case 'retiree':
      return on(['income', 'health'], ['legacy', 'travel']);
  }
}

export const defaultRetireAge = (age: number) => Math.max(age + 5, 58);

// ---------- holdings entered on 1.5 ----------

export type HoldingEntry = { id: string; name: string; type: Holding['type']; assetClass: Holding['assetClass']; value: number; isStock?: boolean; autoMonthly?: number };

// ---------- the onboarding answers ----------

export type OnboardingAnswers = {
  today: YM;
  age: number;
  work: Work;
  dependents: number;
  /** 1, 7, 0 = last day, -1 = it varies. */
  payday: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  risk: Partial<Record<RiskAnswerKey, number>>;
  goals: { template: TemplateId; name: string; targetToday: number; date: YM; retireAge?: number }[];
  holdings: HoldingEntry[];
  loans: Loan[];
  monthly: number;
  raisePct: number;
  incomeVaries: boolean;
  /** Retirees: spending needed and pension, per month. */
  needMonthly?: number;
  pensionMonthly?: number;
};

export const defaultAssumptions = (stepUpPct: number): Assumptions => ({
  returnPct: { cash: 5.5, debt: 7, indianEquity: 12, globalEquity: 11, gold: 8, other: 0 },
  volatilityPct: { cash: 0.5, debt: 2.5, indianEquity: 15, globalEquity: 14, gold: 12, other: 0 },
  inflationPct: 6,
  stepUpPct,
  retirementRealReturnPct: 2.5,
  showTodayRupees: true,
  preset: 'default',
});

/** Default goal list for the answers so far (used to pre-fill 1.4). */
export function defaultGoals(a: Pick<OnboardingAnswers, 'today' | 'age' | 'work' | 'monthlyExpenses'>) {
  const stage = stageFor(a.age, a.work);
  const retireAge = defaultRetireAge(a.age);
  const ctx: TemplateCtx = { today: a.today, age: a.age, work: a.work, monthlyExpenses: a.monthlyExpenses, retireAge };
  return templatesForStage(stage).map(({ id, ticked }) => {
    const t = TEMPLATES[id];
    return { template: id, name: t.name, targetToday: t.target(ctx), date: a.today + t.inMonths(ctx), detail: t.detail(ctx), ticked, retireAge: id === 'retirement' ? retireAge : undefined };
  });
}

// ---------- auto-assign holdings by horizon ----------

/**
 * Present-day need: the balance that, growing at the goal's capped mix and with no new money,
 * reaches the goal's inflated target on its date.
 */
function presentNeed(input: PlanInput, goal: Goal): number {
  const spec = goalSpec(input, goal);
  const w = targetWeights(spec.mix, spec.globalShare, spec.months / 12);
  const r = w.reduce((acc, wk, k) => acc + wk * spec.ret[k], 0);
  const target = spec.targetToday * Math.pow(1 + spec.infl, spec.months / 12);
  return target / Math.pow(1 + monthlyRate(r), spec.months);
}

/**
 * Splits planned holdings across goals (owner decision): cash (then debt) fills the safety net;
 * then goals nearest-date first take what their mix can hold, up to their present-day need. Short
 * goals never take equity beyond their horizon cap. Whatever is left stays unassigned (→ Retirement).
 */
export function autoAssignHoldings(input: PlanInput): HoldingGoal[] {
  const holdings = input.holdings.filter((h) => h.planned && h.assetClass !== 'other');
  const pool = [0, 0, 0, 0, 0];
  for (const h of holdings) pool[CLASS_INDEX[h.assetClass as keyof typeof CLASS_INDEX]] += h.value;
  const total = pool.slice();
  const assigned = new Map<string, number[]>(); // goalId → per-class amounts
  const take = (goalId: string, k: number, amount: number) => {
    const a = Math.max(0, Math.min(amount, pool[k]));
    if (a <= 0) return 0;
    pool[k] -= a;
    const row = assigned.get(goalId) ?? [0, 0, 0, 0, 0];
    row[k] += a;
    assigned.set(goalId, row);
    return a;
  };

  // 1. Safety net: cash first, then debt.
  const sn = input.goals.find((g) => g.isSafetyNet);
  if (sn) {
    let need = input.profile.monthlyExpenses * (sn.safetyMonths ?? safetyMonthsFor(input.profile.work));
    need -= take(sn.id, CLASS_INDEX.cash, need);
    take(sn.id, CLASS_INDEX.debt, need);
  }

  // 2. Other goals, nearest date first; retirement keeps the rest.
  const risk = input.profile.riskOverride ?? RISK_ORDER[Math.min(RISK_ORDER.indexOf(input.profile.riskCapacity), RISK_ORDER.indexOf(input.profile.riskTolerance))];
  const goals = planGoals(input)
    .filter((g) => !g.isRetirement)
    .sort((a, b) => a.date - b.date);
  for (const g of goals) {
    let need = presentNeed(input, g);
    const years = Math.max(0, (g.date - input.today) / 12);
    const w = targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], years);
    // Phase A: by the goal's own mix.
    const want = w.map((wk) => wk * need);
    for (let k = 0; k < N_CLASSES; k++) need -= take(g.id, k, want[k]);
    // Phase B: fill the rest from what suits the horizon (short goals: no extra equity).
    const order = years < 7 ? [CLASS_INDEX.cash, CLASS_INDEX.debt, CLASS_INDEX.gold] : [CLASS_INDEX.indianEquity, CLASS_INDEX.globalEquity, CLASS_INDEX.debt, CLASS_INDEX.gold, CLASS_INDEX.cash];
    for (const k of order) {
      if (need <= 0) break;
      need -= take(g.id, k, need);
    }
  }

  // 3. Turn per-class amounts into holding → goal percentages (pro rata within each class).
  const out: HoldingGoal[] = [];
  for (const h of holdings) {
    const k = CLASS_INDEX[h.assetClass as keyof typeof CLASS_INDEX];
    if (total[k] <= 0) continue;
    for (const [goalId, row] of assigned) {
      const pct = Math.round((row[k] / total[k]) * 1000) / 10;
      if (pct > 0) out.push({ holdingId: h.id, goalId, pct });
    }
  }
  return out;
}

// ---------- first monthly split by priority ----------

const PRIORITY_RANK: Record<Priority, number> = { must: 0, should: 1, nice: 2 };

/**
 * Sets each goal's monthly amount from the total (owner decision): commitments and the safety-net
 * top-up come off first; then goals by priority (must → should → nice), nearest date first, each
 * up to its required amount; anything left goes to the goal furthest behind, else Retirement.
 */
export function allocateMonthly(input: PlanInput, commitments: number): Goal[] {
  const goals = input.goals.map((g) => ({ ...g, monthly: 0 }));
  const base: PlanInput = { ...input, goals };
  const sn = goals.find((g) => g.isSafetyNet);
  let pool = Math.max(0, input.profile.monthly - commitments);
  if (sn) {
    // A gap in the safety net is filled first, spread over at most 12 months.
    const target = input.profile.monthlyExpenses * (sn.safetyMonths ?? 0);
    const have = input.holdings.reduce((acc, h) => acc + h.value * ((input.holdingGoals.find((x) => x.holdingId === h.id && x.goalId === sn.id)?.pct ?? 0) / 100), 0);
    const topUp = Math.min(pool, Math.max(0, target - have) / 12);
    sn.monthly = Math.round(topUp / 100) * 100;
    pool -= sn.monthly;
  }
  const order = planGoals(base).sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.isRetirement ? retirementDate(a, input) : a.date) - (b.isRetirement ? retirementDate(b, input) : b.date),
  );
  const required = new Map<string, number>();
  for (const g of order) {
    const r = requiredMonthlyExact(goalSpec(base, g));
    required.set(g.id, r == null ? Infinity : roundUp500(r));
  }
  for (const g of order) {
    const give = Math.min(pool, required.get(g.id) ?? 0);
    g.monthly = give;
    pool -= give;
  }
  if (pool > 0 && order.length) {
    const behind = order.filter((g) => g.monthly < (required.get(g.id) ?? 0)).sort((a, b) => (required.get(b.id)! - b.monthly) - (required.get(a.id)! - a.monthly))[0];
    const to = behind ?? order.find((g) => g.isRetirement) ?? order[0];
    to.monthly += pool;
  }
  return goals;
}

// ---------- everything together ----------

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function buildPlanInput(a: OnboardingAnswers, risk: { capacity: RiskProfile; tolerance: RiskProfile }): PlanInput {
  const stage = stageFor(a.age, a.work);
  const retired = a.work === 'retired';
  const profile: Profile = {
    name: '',
    age: a.age,
    ageAt: a.today,
    work: a.work,
    dependents: a.dependents,
    paydayDay: a.payday,
    stage,
    riskCapacity: risk.capacity,
    riskTolerance: risk.tolerance,
    riskOverride: null,
    riskCheckedAt: a.today,
    monthlyExpenses: a.monthlyExpenses,
    monthlyIncome: a.monthlyIncome,
    incomeVaries: a.incomeVaries || a.payday === -1,
    monthly: retired ? 0 : a.monthly,
  };
  const goals: Goal[] = a.goals.map((g) => {
    const t = TEMPLATES[g.template];
    const isSafetyNet = g.template === 'safety';
    const isRetirement = g.template === 'retirement' || g.template === 'income';
    return {
      id: newId(g.template),
      name: g.name,
      template: isSafetyNet ? 'safetyNet' : isRetirement ? 'retirement' : g.template === 'education' ? 'education' : g.template === 'home' ? 'home' : g.template === 'travel' ? 'travel' : g.template === 'health' ? 'health' : 'custom',
      targetToday: g.targetToday,
      inflationPct: t.inflationPct,
      date: g.date,
      priority: t.priority,
      monthly: 0,
      isSafetyNet,
      isRetirement,
      retirement: isRetirement
        ? retired
          ? { targetMonthly: a.needMonthly ?? a.monthlyExpenses, retireAge: a.age, untilAge: 90, pensionMonthly: a.pensionMonthly ?? 0 }
          : { targetMonthly: a.monthlyExpenses, retireAge: g.retireAge ?? defaultRetireAge(a.age), untilAge: 85 }
        : undefined,
      safetyMonths: isSafetyNet ? safetyMonthsFor(a.work) : undefined,
      status: 'active',
      createdAt: a.today,
    };
  });
  const holdings: Holding[] = a.holdings
    .filter((h) => h.value > 0)
    .map((h) => ({
      id: h.id,
      name: h.name,
      type: h.type,
      assetClass: h.assetClass,
      isStock: h.isStock ?? h.type === 'stock',
      planned: h.assetClass !== 'other',
      value: h.value,
      ...(h.autoMonthly ? { autoMonthly: h.autoMonthly } : {}),
      valueAt: a.today,
      createdAt: a.today,
    }));
  const ppf = holdings.find((h) => h.type === 'ppf');
  const flowRules: FlowRule[] = [
    { id: 'r-safety', order: 1, enabled: true, type: 'safetyNet' },
    { id: 'r-debt', order: 2, enabled: true, type: 'costlyDebt', thresholdPct: 12 },
    ...(ppf && !retired ? [{ id: 'r-ppf', order: 3, enabled: true, type: 'commitment' as const, instrument: 'PPF' as const, holdingId: ppf.id, yearlyCap: 150000, paidThisYear: 0 }] : []),
    { id: 'r-goals', order: 4, enabled: true, type: 'goals' },
  ];
  let input: PlanInput = { today: a.today, profile, assumptions: defaultAssumptions(a.raisePct), goals, holdings, holdingGoals: [], flowRules, loans: a.loans };
  input = { ...input, holdingGoals: autoAssignHoldings(input) };
  if (!retired) {
    const cm = a.today % 12;
    const mlf = cm <= 2 ? 3 - cm : 15 - cm;
    const commitments = ppf ? 150000 / mlf : 0;
    input = { ...input, goals: allocateMonthly(input, commitments) };
  }
  return input;
}

export { PLANNED_CLASSES };

// ---------- retirees: three buckets from what they have ----------

/**
 * Withdrawal plan for a retiree (DRAFT until Phase 8): cash covers the next 2 years of spending from
 * savings, income (low risk) years 3–7, growth the rest. Growth earns the profile's equity share.
 */
export function retireeWithdrawalSpec(input: PlanInput) {
  const g = input.goals.find((x) => x.isRetirement);
  const spend = g?.retirement?.targetMonthly ?? input.profile.monthlyExpenses;
  const pension = g?.retirement?.pensionMonthly ?? 0;
  const draw = Math.max(0, spend - pension) * 12;
  const total = input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0);
  const cash = Math.min(total, 2 * draw);
  const income = Math.min(total - cash, 5 * draw);
  const growth = Math.max(0, total - cash - income);
  const risk = input.profile.riskOverride ?? RISK_ORDER[Math.min(RISK_ORDER.indexOf(input.profile.riskCapacity), RISK_ORDER.indexOf(input.profile.riskTolerance))];
  const eq = Math.min(0.8, PROFILE_MIX[risk][0] * 1.4); // growth holds the plan's equity
  return {
    buckets: { cash, income, growth },
    spendMonthly: spend,
    pensionMonthly: pension,
    inflationPct: input.assumptions.inflationPct,
    returnPct: { cash: input.assumptions.returnPct.cash, income: input.assumptions.returnPct.debt, growth: eq * input.assumptions.returnPct.indianEquity + (1 - eq) * input.assumptions.returnPct.debt },
    volatilityPct: { cash: 0.5, income: input.assumptions.volatilityPct.debt, growth: eq * input.assumptions.volatilityPct.indianEquity },
    startAge: input.profile.age,
    startMonth: input.today % 12,
    maxAge: 110,
    cashYears: 2,
    incomeYears: 5,
  };
}
