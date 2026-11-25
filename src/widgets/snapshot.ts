/**
 * The widget snapshot (07 Widgets): everything the widgets show, as ready-to-render strings, built in
 * one place. With Hide amounts on, every rupee figure is `₹ ••••••`. Pure TS (no React, no native).
 */
import type { Plan } from '../engine/plan';
import type { PlanInput } from '../engine/types';
import { formatINR, maskRupees } from '../lib/formatINR';

export type WidgetGoal = { id: string; name: string; status: string; short: boolean };
export type WidgetSnapshot = {
  onTrack: number;
  total: number;
  /** "3 of 4" */
  count: string;
  /** "3 of 4 goals on track" */
  headline: string;
  /** "Education needs ₹3,500 more a month", or "" */
  focus: string;
  goals: WidgetGoal[];
  payday: { due: boolean; amount: string };
  moves: { month: string; done: number; total: number; next: string | null } | null;
  /** Lock screen: next level progress, e.g. "11 of 12". */
  progress: string;
  skin: string;
  hidden: boolean;
  /** Deep links (moneyplan://…) for each widget. */
  links: { home: string; payday: string; goals: string; checkIn: string };
};

const SHORT_NAME: Record<string, string> = { "Child's education": 'Education' };
const short = (n: string) => SHORT_NAME[n] ?? n;

export function buildWidgetSnapshot(a: {
  input: PlanInput;
  plan: Plan;
  hidden: boolean;
  due: number | null;
  moves: { name: string; amount: number; done: boolean }[];
  progress: string;
  skin: string;
}): WidgetSnapshot {
  const { input, plan, hidden } = a;
  const money = (v: number, compact = false) => formatINR(v, { compact, hidden });
  const goals = plan.goals.slice(0, 4).map((g) => {
    const shortBy = g.bands ? Math.max(0, g.targetToday - g.bands.likely) : g.shortBy;
    const isShort = !g.onTrack && shortBy >= 50000;
    return { id: g.goalId, name: short(g.name), status: g.onTrack ? 'On track' : isShort ? `${money(Math.round(shortBy / 1e5) * 1e5, true)} short` : 'Needs a little more', short: !g.onTrack };
  });
  const focus = plan.focus ? `${short(input.goals.find((g) => g.id === plan.focus!.goalId)?.name ?? '')} needs ${money(plan.focus.extraMonthly)} more a month` : '';
  const left = a.moves.filter((m) => !m.done);
  return {
    onTrack: plan.onTrack,
    total: plan.total,
    count: `${plan.onTrack} of ${plan.total}`,
    headline: `${plan.onTrack} of ${plan.total} goals on track`,
    focus: maskRupees(focus, hidden),
    goals,
    payday: { due: a.due != null, amount: money(a.due ?? input.profile.monthly) },
    moves: a.moves.length ? { month: MONTHS_LONG[input.today % 12], done: a.moves.length - left.length, total: a.moves.length, next: left[0] ? `${left[0].name} · ${money(left[0].amount)}` : null } : null,
    progress: a.progress,
    skin: a.skin,
    hidden,
    links: { home: 'moneyplan://home', payday: 'moneyplan://payday', goals: 'moneyplan://goals', checkIn: 'moneyplan://payday/check-in' },
  };
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
