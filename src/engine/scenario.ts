/**
 * What if (6.1–6.3): a sandbox over the user's plan. A scenario is a small set of changes; the
 * engine reports each goal before and after, on the fast single-line path (≤ 16ms per change).
 * The plan itself never changes until the user applies a scenario (6.2). Pure TS.
 */
import { labelYM } from './dates';
import { couldStopAt, goalResultFast, planGoals, retirementDate, safetyNet } from './plan';
import { replayRows, type ReplayYear } from './replay';
import type { Goal, GoalResult, PlanInput } from './types';

export type ScenarioChanges = {
  /** Months with no income: no money goes in; spending comes from the safety net, then investments. */
  noIncomeMonths?: number;
  replay?: ReplayYear;
  retireAge?: number;
  /** New monthly amounts per goal (the "fix" chip, or the + amount on 3.2). */
  monthlyByGoal?: Record<string, number>;
  /** Prepay a loan from savings. */
  prepay?: { loanId: string; amount: number };
};

export type Scenario = { id: string; name: string; changes: ScenarioChanges; createdAt: number };

export type GoalOutcome = { goalId: string; name: string; before: string; after: string; worse: boolean; broke: boolean; beforeR: GoalResult; afterR: GoalResult };

const L = (v: number) => {
  const l = Math.round(v / 1e5);
  return l >= 100 ? `₹${(l / 100).toFixed(1).replace(/\.0$/, '')} Cr` : `₹${l} L`;
};

/** Goals whose date can't move (a child starts college when they start); others can slip. */
const FIXED_DATE = new Set(['education', 'wedding']);
const canSlip = (g: Goal, r: GoalResult) => !FIXED_DATE.has(g.template) && r.projectedDate != null;

/** One line per goal, as 6.1 shows it: a date, "₹X short", or "at 56" for retirement. A goal whose
 * date can move shows when it would be reached; a fixed-date goal shows how short it would fall. */
export function outcomeLabel(g: Goal, r: GoalResult, input: PlanInput): string {
  if (g.isRetirement) return r.couldStopAt != null || r.onTrack ? `at ${r.couldStopAt ?? g.retirement?.retireAge ?? ''}` : `${L(r.shortBy)} short at ${g.retirement?.retireAge ?? ''}`;
  if (!r.onTrack && canSlip(g, r)) return labelYM(Math.max(r.projectedDate!, g.date));
  if (!r.onTrack && r.shortBy >= 50000) return `${L(r.shortBy)} short`;
  if (r.projectedDate != null && r.projectedDate > g.date) return labelYM(r.projectedDate);
  if (r.projectedDate != null && !r.onTrack) return labelYM(r.projectedDate);
  return labelYM(g.date);
}

/** How a scenario reshapes the plan input (for retire age and monthly amounts) and per-goal overrides. */
export function scenarioInput(input: PlanInput, c: ScenarioChanges): { input: PlanInput; drawFromInvestments: number; override: (g: Goal) => { pause?: number; replay?: number[][]; startDelta?: number } } {
  let goals = input.goals;
  if (c.retireAge) goals = goals.map((g) => (g.isRetirement && g.retirement ? { ...g, retirement: { ...g.retirement, retireAge: c.retireAge! } } : g));
  if (c.monthlyByGoal) goals = goals.map((g) => (c.monthlyByGoal![g.id] != null ? { ...g, monthly: c.monthlyByGoal![g.id] } : g));
  const next: PlanInput = { ...input, goals, profile: { ...input.profile, monthly: input.profile.monthly + Object.entries(c.monthlyByGoal ?? {}).reduce((a, [id, v]) => a + (v - (input.goals.find((g) => g.id === id)?.monthly ?? 0)), 0) } };
  // Months without income: the safety net pays spending first; past it, investments are drawn.
  const sn = safetyNet(input);
  const spend = input.profile.monthlyExpenses * (c.noIncomeMonths ?? 0);
  const drawFromInvestments = Math.max(0, spend - (sn?.current ?? 0));
  const plan = planGoals(next);
  const retire = plan.find((g) => g.isRetirement);
  const prepayFrom = c.prepay?.amount ?? 0;
  const replay = c.replay ? replayRows(c.replay) : undefined;
  return {
    input: next,
    drawFromInvestments,
    override: (g) => ({
      pause: c.noIncomeMonths || undefined,
      replay,
      // Drawn money and prepayments come out of the longest-horizon money first: Retirement.
      startDelta: g.id === retire?.id ? -(drawFromInvestments + prepayFrom) : undefined,
    }),
  };
}

export function compareScenario(input: PlanInput, c: ScenarioChanges): { outcomes: GoalOutcome[]; drawFromInvestments: number } {
  const s = scenarioInput(input, c);
  const outcomes = planGoals(input).map((g) => {
    const beforeR = goalResultFast(input, g);
    const g2 = s.input.goals.find((x) => x.id === g.id)!;
    const ov = s.override(g2);
    const afterR = goalResultFast(s.input, g2, { ...ov, date: g2.isRetirement ? retirementDate(g2, s.input) : undefined });
    if (g2.isRetirement && c.retireAge) {
      // A chosen age: is the plan on track to stop then? (Not "the earliest age that works".)
      afterR.couldStopAt = afterR.onTrack ? c.retireAge : undefined;
    } else if (g2.isRetirement) afterR.couldStopAt = couldStopAtWith(s.input, g2, ov);
    const worse = afterR.likelyToday < beforeR.likelyToday - 1 || (afterR.projectedDate ?? 0) > (beforeR.projectedDate ?? 0);
    // "Breaks": a fixed-date goal falls short, or a goal that was on track never gets there.
    const broke = beforeR.onTrack && !afterR.onTrack && (g2.isRetirement ? !!c.retireAge : !canSlip(g2, afterR));
    return { goalId: g.id, name: g.name, before: outcomeLabel(g, beforeR, input), after: outcomeLabel(g2, afterR, s.input), worse, broke, beforeR, afterR };
  });
  return { outcomes, drawFromInvestments: s.drawFromInvestments };
}

/** "Could stop at" under a scenario's overrides (replay, pause, draw). */
function couldStopAtWith(input: PlanInput, goal: Goal, ov: { pause?: number; replay?: number[][]; startDelta?: number }): number | undefined {
  if (!ov.pause && !ov.replay && !ov.startDelta) return couldStopAt(input, goal);
  const r = goal.retirement;
  if (!r) return undefined;
  let best: number | undefined;
  for (let a = r.retireAge + 5; a > input.profile.age; a--) {
    const res = goalResultFast(input, { ...goal, retirement: { ...r, retireAge: a } }, { ...ov, date: retirementDate(goal, input, a) });
    if (res.onTrack && res.likelyToday >= res.targetToday) best = a;
    else if (best != null) break;
  }
  return best;
}

/** The 6.1 headline (verbatim for the design's case; the rest drafted). */
export function scenarioHeadline(outcomes: GoalOutcome[]): string {
  const broke = outcomes.filter((o) => o.broke).length;
  const worse = outcomes.filter((o) => o.worse).length;
  const better = outcomes.filter((o) => !o.worse && o.after !== o.before).length;
  if (broke) return broke === 1 ? 'One goal would need help.' : `${broke} goals would need help.`;
  if (worse >= Math.ceil(outcomes.length / 2)) return 'Most goals slip a little. None break.';
  if (worse) return 'A goal slips a little. None break.';
  if (better) return 'Your goals move closer.';
  return 'Nothing moves. Your plan takes it.';
}

/** Monthly changes that put every off-track goal on track ("Fix off-track goals"). */
export function fixChanges(input: PlanInput): ScenarioChanges {
  const byGoal: Record<string, number> = {};
  for (const g of planGoals(input)) {
    const r = goalResultFast(input, g);
    if (!r.onTrack && r.requiredMonthly != null) byGoal[g.id] = r.requiredMonthly;
  }
  return { monthlyByGoal: byGoal };
}

/** The list of plan changes a scenario would make (6.2): only lasting changes can be applied. */
export function applicableChanges(input: PlanInput, c: ScenarioChanges): { goalId: string; label: string; field: string; from: number; to: number }[] {
  const out: { goalId: string; label: string; field: string; from: number; to: number }[] = [];
  for (const [id, v] of Object.entries(c.monthlyByGoal ?? {})) {
    const g = input.goals.find((x) => x.id === id);
    if (g && g.monthly !== v) out.push({ goalId: g.id, label: g.name, field: 'Monthly amount', from: g.monthly, to: v });
  }
  const r = input.goals.find((g) => g.isRetirement);
  if (c.retireAge && r?.retirement && r.retirement.retireAge !== c.retireAge) out.push({ goalId: r.id, label: 'Retirement', field: 'Stop working at', from: r.retirement.retireAge, to: c.retireAge });
  return out;
}

/** Line 2 of a 6.3 card: what the scenario changes, in words (drafted copy). */
export function describeChanges(input: PlanInput, c: ScenarioChanges): string {
  const parts: string[] = [];
  if (c.noIncomeMonths) parts.push(`No income for ${c.noIncomeMonths} month${c.noIncomeMonths === 1 ? '' : 's'}`);
  if (c.replay) parts.push(`Markets like ${c.replay}, from now`);
  const r = input.goals.find((g) => g.isRetirement)?.retirement;
  if (c.retireAge && r) {
    const d = r.retireAge - c.retireAge;
    parts.push(d === 0 ? `Retire at ${c.retireAge}` : `${Math.abs(d)} year${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'earlier' : 'later'}`);
  }
  const extra = Object.entries(c.monthlyByGoal ?? {}).reduce((a, [id, v]) => a + v - (input.goals.find((g) => g.id === id)?.monthly ?? 0), 0);
  if (c.monthlyByGoal && Object.keys(c.monthlyByGoal).length) parts.push(`${extra >= 0 ? '+' : '−'}₹${Math.abs(extra).toLocaleString('en-IN')} a month`);
  if (c.prepay) {
    const l = input.loans.find((x) => x.id === c.prepay!.loanId);
    parts.push(`Prepay ₹${Math.round(c.prepay.amount / 1e5)} L of ${l?.name ?? 'a loan'}`);
  }
  return parts.join(' · ') || 'No changes';
}

/** Line 3 of a 6.3 card: the outcome in one phrase (drafted, except the design's three). */
export function scenarioResult(input: PlanInput, c: ScenarioChanges, outcomes: GoalOutcome[]): string {
  const s = scenarioInput(input, c);
  const broke = outcomes.filter((o) => o.broke);
  if (broke.length) {
    const more = broke.reduce((a, o) => a + Math.max(0, (o.afterR.requiredMonthly ?? 0) - (s.input.goals.find((g) => g.id === o.goalId)?.monthly ?? 0)), 0);
    return more > 0 ? `Needs ₹${(Math.ceil(more / 500) * 500).toLocaleString('en-IN')} more a month` : `${broke[0].name} would need help`;
  }
  const shown = (o: GoalOutcome, r: GoalResult) => Math.max(r.projectedDate ?? 0, input.goals.find((g) => g.id === o.goalId)?.date ?? 0);
  const slips = outcomes
    .filter((o) => o.worse && !input.goals.find((g) => g.id === o.goalId)?.isRetirement && o.beforeR.projectedDate != null && o.afterR.projectedDate != null)
    .map((o) => ({ o, m: shown(o, o.afterR) - shown(o, o.beforeR) }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m);
  if (slips.length) return `${slips[0].o.name} slips ${slips[0].m} month${slips[0].m === 1 ? '' : 's'}`;
  const ret = outcomes.find((o) => o.worse && input.goals.find((g) => g.id === o.goalId)?.isRetirement);
  if (ret) return `Retirement moves to ${ret.after}`;
  return 'All goals still reached';
}

/** The default name for a saved scenario: the chip that made it. */
export function scenarioName(c: ScenarioChanges): string {
  if (c.noIncomeMonths) return `No income ${c.noIncomeMonths} months`;
  if (c.replay) return `Replay ${c.replay}`;
  if (c.retireAge) return `Retire at ${c.retireAge}`;
  if (c.prepay) return 'Prepay a loan';
  if (c.monthlyByGoal) return 'Fix off-track goals';
  return 'My scenario';
}
