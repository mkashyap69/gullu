// How payday lines look and read: bubble colour and short label (4.2 uses "Education", "Trip").
import type { PaydayLine } from '../../engine/payday';
import type { PlanInput } from '../../engine/types';
import { goalColor } from '../../lib/goalColors';
import { colors } from '../../theme/tokens';

const SHORT: Record<string, string> = { "Child's education": 'Education', 'Japan trip': 'Trip' };

export function lineLabel(l: PaydayLine): string {
  return SHORT[l.label] ?? l.label;
}

export function lineColor(l: PaydayLine, input: PlanInput): string {
  if (l.kind === 'commitment') return colors.goal[1];
  if (l.kind === 'debt') return colors.short;
  if (l.kind === 'safety') return colors.cash;
  const g = input.goals.find((x) => x.id === l.goalId);
  return g ? goalColor(g) : colors.goal[0];
}

/**
 * The 4.2 line under the amount: why the money goes where it goes. Verbatim for Manish's case
 * (safety net full, a cheap car loan); the other cases are drafts (docs/progress.md).
 */
export function whyLine(input: PlanInput, safetyFull: boolean): string {
  const rule = input.flowRules.find((r) => r.type === 'costlyDebt');
  const threshold = rule && rule.type === 'costlyDebt' ? rule.thresholdPct : 12;
  const loans = input.loans.filter((l) => l.balance > 0);
  const costly = loans.filter((l) => l.ratePct > threshold);
  const net = safetyFull ? 'Your safety net is full' : 'Your safety net comes first';
  if (costly.length) return `Every rupee gets a job. ${net}, then the ${costly[0].name.toLowerCase()} costs more than investing earns, so part goes there.`;
  if (loans.length) return `Every rupee gets a job. ${net} and the ${loans[0].name.toLowerCase()} is cheap, so it goes here.`;
  return `Every rupee gets a job. ${net}, so it goes here.`;
}
