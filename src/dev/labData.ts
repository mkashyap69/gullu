/**
 * Helpers that turn the engine's plan into what the motion prototypes show. Phase 4–5 screens will
 * grow these into proper selectors; for the Motion lab they keep the moments data-driven.
 */
import { commitmentsThisMonth, splitPayday, type Plan } from '../engine/plan';
import type { Affordability, PlanInput } from '../engine/types';
import { goalColor } from '../lib/goalColors';
import { colors } from '../theme/tokens';

export const SHORT_NAMES: Record<string, string> = { "Child's education": 'Education', 'Japan trip': 'Trip' };
export const shortName = (n: string) => SHORT_NAMES[n] ?? n;

export type PaydaySlice = { id: string; label: string; amount: number; color: string; kind: 'goal' | 'commitment' };

/** This month's payday, as bubbles: goals plus commitments, biggest first, coloured in that order. */
export function paydaySlices(input: PlanInput, amount: number): PaydaySlice[] {
  const goals = splitPayday(input, amount).map((s) => {
    const g = input.goals.find((x) => x.id === s.goalId)!;
    return { id: g.id, label: shortName(g.name), amount: s.amount, kind: 'goal' as const };
  });
  const comms = commitmentsThisMonth(input).map((c) => ({ id: c.rule.id, label: c.rule.instrument, amount: Math.round(c.amount), kind: 'commitment' as const }));
  return [...goals, ...comms]
    .filter((s) => s.amount > 0)
    // Biggest first; on a tie, commitments (PPF) come before goals, as on the Payday design.
    .sort((a, b) => b.amount - a.amount || (a.kind === 'commitment' ? -1 : b.kind === 'commitment' ? 1 : 0))
    .map((s, i) => ({ ...s, color: colors.goal[i % colors.goal.length] }));
}

/** The same accent a goal gets on Payday, for its ring. */
export function goalAccent(input: PlanInput, goalId: string): string {
  const s = paydaySlices(input, input.profile.monthly).find((x) => x.id === goalId);
  if (s) return s.color;
  const g = input.goals.find((x) => x.id === goalId);
  return g ? goalColor(g) : colors.goal[0];
}

export const WORD: Record<Affordability, string> = { comfortable: 'Comfortable', manageable: 'Manageable', stretch: 'Stretch' };
export const WORD_COLOR: Record<Affordability, string> = { comfortable: colors.comfortable, manageable: colors.manageable, stretch: colors.stretch };

/** Ring fill: how far the likely path gets toward the target (capped). */
export function ringProgress(g: Plan['goals'][number]): number {
  return Math.max(0.08, Math.min(1, g.current / g.targetToday || 0));
}
