/**
 * zustand stores per domain. They hydrate from SQLite on launch and write through on every change:
 * the repo write happens first, then the in-memory state is replaced (never mutated), so engine
 * caches keyed by input identity stay valid.
 */
import { create } from 'zustand';

import * as repo from '../data/repo';
import type { AppData, HabitEvent, Payday, Settings, ValueSnapshot } from '../data/repo';
import { DEFAULT_SETTINGS } from '../data/repo';
import type { Assumptions, FlowRule, Goal, Holding, HoldingGoal, Loan, Profile } from '../engine/types';
import { getDb } from './dbHolder';

type ProfileState = {
  profile: Profile | null;
  assumptions: Assumptions | null;
  setProfile: (p: Profile) => Promise<void>;
  setAssumptions: (a: Assumptions) => Promise<void>;
};
export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  assumptions: null,
  setProfile: async (p) => {
    await repo.saveProfile(getDb(), p);
    set({ profile: p });
  },
  setAssumptions: async (a) => {
    await repo.saveAssumptions(getDb(), a);
    set({ assumptions: a });
  },
}));

type GoalsState = {
  goals: Goal[];
  flowRules: FlowRule[];
  upsertGoal: (g: Goal) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  setFlowRules: (rules: FlowRule[]) => Promise<void>;
};
export const useGoalsStore = create<GoalsState>()((set, get) => ({
  goals: [],
  flowRules: [],
  upsertGoal: async (g) => {
    const goals = get().goals;
    const idx = goals.findIndex((x) => x.id === g.id);
    await repo.saveGoal(getDb(), g, idx < 0 ? goals.length : idx);
    set({ goals: idx < 0 ? [...goals, g] : goals.map((x) => (x.id === g.id ? g : x)) });
  },
  removeGoal: async (id) => {
    await repo.deleteGoal(getDb(), id);
    set({ goals: get().goals.filter((g) => g.id !== id) });
    useHoldingsStore.setState((s) => ({ holdingGoals: s.holdingGoals.filter((hg) => hg.goalId !== id) }));
  },
  setFlowRules: async (rules) => {
    for (const r of rules) await repo.saveFlowRule(getDb(), r);
    set({ flowRules: rules });
  },
}));

type HoldingsState = {
  holdings: Holding[];
  holdingGoals: HoldingGoal[];
  loans: Loan[];
  snapshots: ValueSnapshot[];
  upsertHolding: (h: Holding) => Promise<void>;
  setSplit: (holdingId: string, split: HoldingGoal[]) => Promise<void>;
  upsertLoan: (l: Loan) => Promise<void>;
  recordValue: (s: ValueSnapshot) => Promise<void>;
};
export const useHoldingsStore = create<HoldingsState>()((set, get) => ({
  holdings: [],
  holdingGoals: [],
  loans: [],
  snapshots: [],
  upsertHolding: async (h) => {
    const hs = get().holdings;
    const idx = hs.findIndex((x) => x.id === h.id);
    await repo.saveHolding(getDb(), h, idx < 0 ? hs.length : idx);
    set({ holdings: hs.some((x) => x.id === h.id) ? hs.map((x) => (x.id === h.id ? h : x)) : [...hs, h] });
  },
  setSplit: async (holdingId, split) => {
    await repo.saveHoldingSplit(getDb(), holdingId, split);
    set({ holdingGoals: [...get().holdingGoals.filter((x) => x.holdingId !== holdingId), ...split] });
  },
  upsertLoan: async (l) => {
    await repo.saveLoan(getDb(), l);
    const ls = get().loans;
    set({ loans: ls.some((x) => x.id === l.id) ? ls.map((x) => (x.id === l.id ? l : x)) : [...ls, l] });
  },
  recordValue: async (s) => {
    await repo.addSnapshot(getDb(), s);
    set({ snapshots: [...get().snapshots, s] });
  },
}));

type PaydayState = {
  paydays: Payday[];
  savePayday: (p: Payday) => Promise<void>;
};
export const usePaydayStore = create<PaydayState>()((set, get) => ({
  paydays: [],
  savePayday: async (p) => {
    await repo.savePayday(getDb(), p);
    set({ paydays: [...get().paydays.filter((x) => x.month !== p.month), p].sort((a, b) => a.month - b.month) });
  },
}));

type HabitsState = {
  events: HabitEvent[];
  add: (e: HabitEvent) => Promise<void>;
};
export const useHabitsStore = create<HabitsState>()((set, get) => ({
  events: [],
  add: async (e) => {
    await repo.addHabit(getDb(), e);
    set({ events: [...get().events, e] });
  },
}));

type SettingsState = Settings & {
  hydrated: boolean;
  update: (s: Partial<Settings>) => Promise<void>;
};
export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  update: async (s) => {
    set(s); // optimistic: toggles feel instant
    await repo.saveSettings(getDb(), s);
  },
}));

/** Replaces every store's state with `data` (after hydrate or a demo load). */
export function applyAppData(data: AppData | null): void {
  useProfileStore.setState({ profile: data?.input.profile ?? null, assumptions: data?.input.assumptions ?? null });
  useGoalsStore.setState({ goals: data?.input.goals ?? [], flowRules: data?.input.flowRules ?? [] });
  useHoldingsStore.setState({
    holdings: data?.input.holdings ?? [],
    holdingGoals: data?.input.holdingGoals ?? [],
    loans: data?.input.loans ?? [],
    snapshots: data?.snapshots ?? [],
  });
  usePaydayStore.setState({ paydays: data?.paydays ?? [] });
  useHabitsStore.setState({ events: data?.habits ?? [] });
  useSettingsStore.setState({ ...(data?.settings ?? DEFAULT_SETTINGS), hydrated: true });
}

export async function hydrate(): Promise<void> {
  applyAppData(await repo.loadAll(getDb()));
}

export async function loadDemo(data: AppData): Promise<void> {
  await repo.replaceAll(getDb(), data);
  await hydrate();
}
