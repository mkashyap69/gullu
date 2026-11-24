/**
 * Onboarding draft: answers held in memory while the user moves through 1.2–1.6, written to the
 * encrypted database only when they tap "Show me the plan".
 */
import { create } from 'zustand';

import { DEMO_TODAY } from '../data/demo';
import { replaceAll, DEFAULT_SETTINGS, type HabitEvent } from '../data/repo';
import { safetyNet } from '../engine/plan';
import { ym } from '../engine/dates';
import { buildPlanInput, defaultGoals, scoreRisk, stageFor, type HoldingEntry, type OnboardingAnswers, type RiskAnswerKey, type TemplateId } from '../engine/onboarding';
import type { Loan, PlanInput, Work, YM } from '../engine/types';
import type { SplitSuggestion } from '../engine/suggestSplit';
import { getDb } from './dbHolder';
import { applyAppData } from './stores';

export type DraftGoal = { template: TemplateId; name: string; targetToday: number; date: YM; detail: string; ticked: boolean; retireAge?: number };

/** "Today" for a new plan: the current month. (Demo personas are pinned to 1 Apr 2028.) */
export function currentYM(): YM {
  const d = new Date();
  return ym(d.getFullYear(), d.getMonth() + 1);
}

type State = {
  today: YM;
  age: number;
  work: Work;
  dependents: number;
  payday: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  risk: Partial<Record<RiskAnswerKey, number>>;
  goals: DraftGoal[] | null; // null until 1.4 seeds them from the stage
  holdings: HoldingEntry[];
  loans: Loan[];
  monthly: number;
  raisePct: number;
  incomeVaries: boolean;
  needMonthly: number;
  pensionMonthly: number;
  /** The split of existing money the user accepted or edited (null = use the suggestion). */
  split: SplitSuggestion | null;
  /** True once the user changed the suggestion. */
  splitEdited: boolean;
  /** The inputs the edited split was made for; edits are dropped if these change. */
  splitFor: string;
  set: (p: Partial<State>) => void;
  reset: () => void;
};

const initial = () => ({
  today: currentYM(),
  age: 30,
  work: 'salaried' as Work,
  dependents: 0,
  payday: 1,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  risk: {},
  goals: null,
  holdings: [],
  loans: [],
  monthly: 20000,
  raisePct: 10,
  incomeVaries: false,
  needMonthly: 0,
  pensionMonthly: 0,
  split: null as SplitSuggestion | null,
  splitEdited: false,
  splitFor: '',
});

export const useOnboarding = create<State>()((set) => ({
  ...initial(),
  set: (p) => set(p),
  reset: () => set(initial()),
}));

export const isRetired = (s: Pick<State, 'work'>) => s.work === 'retired';

/** Input steps for the dots: retirees skip Goals (their goals are set for them). */
export type Step = 'about' | 'risk' | 'goals' | 'have' | 'monthly' | 'split';

/**
 * Input steps for the dots: retirees skip Goals (their goals are set for them) and the split (three
 * buckets instead); the split step only shows when there is existing money to share out.
 */
export function steps(work: Work, hasHoldings = false): Step[] {
  if (work === 'retired') return ['about', 'risk', 'have', 'monthly'];
  return hasHoldings ? ['about', 'risk', 'goals', 'have', 'monthly', 'split'] : ['about', 'risk', 'goals', 'have', 'monthly'];
}

/** Planned money entered on 1.5 (property, crypto and other aren't shared across goals). */
export const hasPlannedHoldings = (s: Pick<State, 'holdings'>) => s.holdings.some((h) => h.value > 0 && h.assetClass !== 'other');

/** Everything the split depends on, as a string (to tell when an edited split is out of date). */
export function splitInputs(s: Pick<State, 'holdings' | 'goals' | 'monthly' | 'risk' | 'age' | 'monthlyExpenses' | 'work' | 'raisePct' | 'loans'>): string {
  return JSON.stringify([s.holdings, s.goals?.filter((g) => g.ticked), s.monthly, s.risk, s.age, s.monthlyExpenses, s.work, s.raisePct, s.loans]);
}

/** The plan as it would be saved now, without saving (for the split step). */
export function draftPlan(split?: SplitSuggestion | null): PlanInput {
  const s = useOnboarding.getState();
  const emis = s.loans.reduce((x, l) => x + l.emi, 0);
  const risk = scoreRisk({ age: s.age, dependents: s.dependents, monthlyIncome: s.monthlyIncome, emis, answers: s.risk });
  return buildPlanInput(answers(), risk, split ?? undefined);
}

/** Seed (or re-seed after the stage changed) the goal list for 1.4. */
export function seedGoals(): DraftGoal[] {
  const s = useOnboarding.getState();
  const fresh = defaultGoals({ today: s.today, age: s.age, work: s.work, monthlyExpenses: s.monthlyExpenses });
  const prev = s.goals;
  // Keep the user's edits for templates that are still offered.
  const kept = fresh.map((g) => {
    const p = prev?.find((x) => x.template === g.template);
    return p ? { ...g, ...p, detail: p.name === g.name && p.date === g.date ? g.detail : p.detail } : g;
  });
  return [...kept, ...(prev?.filter((g) => g.template === 'custom') ?? [])];
}

export function answers(): OnboardingAnswers {
  const s = useOnboarding.getState();
  const goals = (s.goals ?? seedGoals()).filter((g) => g.ticked);
  return {
    today: s.today,
    age: s.age,
    work: s.work,
    dependents: s.dependents,
    payday: s.payday,
    monthlyIncome: s.monthlyIncome,
    monthlyExpenses: s.monthlyExpenses,
    risk: s.risk,
    goals: goals.map(({ template, name, targetToday, date, retireAge }) => ({ template, name, targetToday, date, retireAge })),
    holdings: s.holdings,
    loans: s.loans,
    monthly: s.monthly,
    raisePct: s.raisePct,
    incomeVaries: s.incomeVaries,
    needMonthly: s.needMonthly,
    pensionMonthly: s.pensionMonthly,
  };
}

/** Writes the whole plan (profile, goals, holdings, loans, rules) and loads it into the stores. */
function alreadyMet(input: PlanInput): HabitEvent[] {
  const out: HabitEvent[] = [];
  if (safetyNet(input)?.full) out.push({ kind: 'moment', data: { key: 'safety-full' }, at: input.today });
  if (input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0) >= 1_00_00_000) out.push({ kind: 'moment', data: { key: 'invested-1cr' }, at: input.today });
  return out;
}

export async function finishOnboarding(): Promise<void> {
  const s = useOnboarding.getState();
  const a = answers();
  const input = draftPlan(s.split);
  const { today: _t, ...rest } = input;
  const data = {
    input: rest,
    settings: { ...DEFAULT_SETTINGS },
    paydays: [],
    // Milestones already true on day one aren't celebrated later (they weren't earned in the app).
    habits: alreadyMet(input),
    snapshots: input.holdings.map((h) => ({ date: a.today, holdingId: h.id, assetClass: h.assetClass, value: h.value })),
  };
  await replaceAll(getDb(), data);
  applyAppData(data);
}

export { stageFor, DEMO_TODAY };
