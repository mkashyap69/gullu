/**
 * Onboarding draft: answers held in memory while the user moves through 1.2–1.6, written to the
 * encrypted database only when they tap "Show me the plan".
 */
import { create } from 'zustand';

import { DEMO_TODAY } from '../data/demo';
import { replaceAll, DEFAULT_SETTINGS } from '../data/repo';
import { ym } from '../engine/dates';
import { buildPlanInput, defaultGoals, scoreRisk, stageFor, type HoldingEntry, type OnboardingAnswers, type RiskAnswerKey, type TemplateId } from '../engine/onboarding';
import type { Loan, Work, YM } from '../engine/types';
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
});

export const useOnboarding = create<State>()((set) => ({
  ...initial(),
  set: (p) => set(p),
  reset: () => set(initial()),
}));

export const isRetired = (s: Pick<State, 'work'>) => s.work === 'retired';

/** Input steps for the dots: retirees skip Goals (their goals are set for them). */
export function steps(work: Work): ('about' | 'risk' | 'goals' | 'have' | 'monthly')[] {
  return work === 'retired' ? ['about', 'risk', 'have', 'monthly'] : ['about', 'risk', 'goals', 'have', 'monthly'];
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
export async function finishOnboarding(): Promise<void> {
  const s = useOnboarding.getState();
  const a = answers();
  const emis = s.loans.reduce((x, l) => x + l.emi, 0);
  const risk = scoreRisk({ age: s.age, dependents: s.dependents, monthlyIncome: s.monthlyIncome, emis, answers: s.risk });
  const input = buildPlanInput(a, risk);
  const { today: _t, ...rest } = input;
  const data = {
    input: rest,
    settings: { ...DEFAULT_SETTINGS },
    paydays: [],
    habits: [],
    snapshots: input.holdings.map((h) => ({ date: a.today, holdingId: h.id, assetClass: h.assetClass, value: h.value })),
  };
  await replaceAll(getDb(), data);
  applyAppData(data);
}

export { stageFor, DEMO_TODAY };
