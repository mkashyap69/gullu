// Builds the planner's input from the stores (the one place that reads app state for notifications).
import { ymMonth, ymYear } from '@/engine/dates';
import { reachedGoal, pendingMilestone, shownKeys } from '@/engine/moments';
import { paidThisFy, planGoals, retirementDate } from '@/engine/plan';
import type { PlanInput, YM } from '@/engine/types';
import { ringName } from '@/plan/selectors';
import { useHabitsStore, useHoldingsStore, usePaydayStore, useSettingsStore } from '@/state/stores';

import type { NotifyInput, NotifyPrefs } from './plan';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toDate = (m: YM) => new Date(ymYear(m), ymMonth(m), 1);

export function notifyPrefs(): NotifyPrefs {
  const s = useSettingsStore.getState();
  return { payday: s.nPayday, checkIn: s.nCheckIn, valueUpdate: s.nValues, milestones: s.nMilestones, goalChanges: s.nGoalChanges, ppf: s.nPpf, yearly: s.nYearly, hideOnLockScreen: s.nHideLock || s.hideAmounts, quietHours: s.nQuiet };
}

export function notifyInput(input: PlanInput, streak: number, withPending: boolean, now = new Date()): NotifyInput {
  const paydays = usePaydayStore.getState();
  const snapshots = useHoldingsStore.getState().snapshots;
  const events = useHabitsStore.getState().events;
  const placed = paydays.paydays.some((p) => p.month === input.today && p.placedAt != null);
  const moves = paydays.moves.filter((m) => m.month === input.today);
  const goals = planGoals(input).filter((g) => !g.isSafetyNet);
  const commitments = input.flowRules.filter((r) => r.type === 'commitment' && r.enabled);
  const ppf = input.flowRules.find((r) => r.type === 'commitment' && r.instrument === 'PPF');
  const lastValue = snapshots.filter((s) => s.holdingId == null).reduce((m, s) => Math.max(m, s.date), -1);
  const shown = shownKeys(events);
  const pending: NonNullable<NotifyInput['pending']> = [];
  if (withPending) {
    const r = reachedGoal(input, shown);
    if (r) pending.push({ kind: 'goalReached', goalId: r.goalId, name: ringName(input.goals.find((g) => g.id === r.goalId)?.name ?? 'A goal'), amount: r.amount });
    if (pendingMilestone(input, streak, shown) === 'safety-full') pending.push({ kind: 'safetyNet', nextMonth: MONTHS[(ymMonth(input.today) + 1) % 12] });
  }
  const nGoals = goals.length;
  const extra = commitments.map((r) => (r.type === 'commitment' ? `your ${r.instrument}` : '')).filter(Boolean);
  return {
    now,
    prefs: notifyPrefs(),
    paydayDay: input.profile.incomeVaries ? -1 : input.profile.paydayDay,
    monthly: input.profile.monthly,
    splitLine: `${nGoals} goal${nGoals === 1 ? '' : 's'}${extra.length ? ` and ${extra.join(' and ')}` : ''}`,
    placedThisMonth: placed,
    moves: moves.length ? { ticked: moves.filter((m) => m.done).length, total: moves.length } : null,
    lastValueAt: lastValue >= 0 ? toDate(lastValue) : null,
    goals: goals.filter((g) => !g.isRetirement).map((g) => ({ id: g.id, name: ringName(g.name), date: toDate(g.isRetirement ? retirementDate(g, input) : g.date) })),
    ppf: ppf && ppf.type === 'commitment' ? { left: Math.max(0, ppf.yearlyCap - paidThisFy(ppf, input.today)), cap: ppf.yearlyCap } : null,
    riskCheckedAt: input.profile.riskCheckedAt != null ? toDate(input.profile.riskCheckedAt) : null,
    pending,
  };
}
