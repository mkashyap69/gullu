/**
 * This month's payday (4.2–4.7): where the money goes, line by line, and the moves into the
 * user's own holdings. Pure TS.
 *
 * Usual month: every flow step gets its usual amount (safety-net top-up, costly-debt prepayment,
 * commitments spread to 31 March, each goal's own monthly amount).
 * Short month (4.6): the safety net and must-have goals keep their full amount first; the rest
 * follows the flow-rule order (4.7) and waits a month. A commitment that gets less "catches up
 * later": its yearly cap is re-spread over the months left.
 * Bonus month: the extra goes to the goals furthest behind their required amount, must first,
 * else Retirement.
 */
import { allocate, GLOBAL_SHARE_OF_EQUITY, PROFILE_MIX, targetWeights } from './core';
import { commitmentsThisMonth, effectiveRisk, goalBalances, holdingShares, planGoals, retirementDate, safetyNet } from './plan';
import { PLANNED_CLASSES, type FlowRule, type Goal, type Holding, type PlanInput, type PlannedClass, type Priority } from './types';

export type LineKind = 'safety' | 'debt' | 'commitment' | 'goal';
export type LineStatus = 'full' | 'partial' | 'catchUp' | 'next' | 'extra';

export type PaydayLine = {
  id: string; // goalId, rule id or loan id
  kind: LineKind;
  label: string;
  priority?: Priority;
  usual: number;
  amount: number;
  status: LineStatus;
  goalId?: string;
  ruleId?: string;
  loanId?: string;
  holdingId?: string;
};

export type PaydayKind = 'same' | 'less' | 'bonus';

export type PaydayPlan = { amount: number; usual: number; kind: PaydayKind; lines: PaydayLine[] };

const RANK: Record<Priority, number> = { must: 0, should: 1, nice: 2 };

/** Costly-debt prepayment while a loan is above the threshold: half of what's left after the safety net (draft rule). */
export const COSTLY_DEBT_SHARE = 0.5;

function costlyLoans(input: PlanInput) {
  const rule = input.flowRules.find((r) => r.type === 'costlyDebt' && r.enabled) as Extract<FlowRule, { type: 'costlyDebt' }> | undefined;
  if (!rule) return [];
  return input.loans.filter((l) => l.balance > 0 && l.ratePct > rule.thresholdPct).sort((a, b) => b.ratePct - a.ratePct);
}

/** The usual month, step by step in flow-rule order. */
export function usualLines(input: PlanInput): PaydayLine[] {
  const lines: PaydayLine[] = [];
  const rules = [...input.flowRules].filter((r) => r.enabled).sort((a, b) => a.order - b.order);
  const sn = safetyNet(input);
  const goals = planGoals(input);
  const comm = commitmentsThisMonth(input);
  let left = input.profile.monthly;
  for (const r of rules) {
    if (r.type === 'safetyNet' && sn && !sn.full) {
      const a = Math.min(left, Math.ceil((sn.target - sn.current) / 12 / 100) * 100);
      lines.push({ id: sn.goalId, kind: 'safety', label: 'Safety net', usual: a, amount: a, status: 'full', goalId: sn.goalId, priority: 'must' });
      left -= a;
    } else if (r.type === 'costlyDebt') {
      for (const l of costlyLoans(input)) {
        const a = Math.min(l.balance, Math.round((left * COSTLY_DEBT_SHARE) / 100) * 100);
        if (a <= 0) continue;
        lines.push({ id: l.id, kind: 'debt', label: l.name, usual: a, amount: a, status: 'full', loanId: l.id });
        left -= a;
      }
    } else if (r.type === 'commitment') {
      const c = comm.find((x) => x.rule.id === r.id);
      if (c && c.amount > 0) {
        const a = Math.round(c.amount);
        lines.push({ id: r.id, kind: 'commitment', label: r.instrument, usual: a, amount: a, status: 'full', ruleId: r.id, holdingId: r.holdingId });
        left -= a;
      }
    } else if (r.type === 'goals') {
      for (const g of goals) {
        lines.push({ id: g.id, kind: 'goal', label: g.name, priority: g.priority, usual: g.monthly, amount: g.monthly, status: 'full', goalId: g.id });
        left -= g.monthly;
      }
    }
  }
  return lines;
}

export function paydayPlan(input: PlanInput, amount: number, required: Map<string, number | null> = new Map()): PaydayPlan {
  const lines = usualLines(input).map((l) => ({ ...l }));
  const usual = lines.reduce((a, l) => a + l.usual, 0);
  if (amount < usual) {
    // Protect the safety net and must-have goals first, then the rest in flow-rule order.
    for (const l of lines) l.amount = 0;
    let pool = amount;
    const protectedFirst = lines.filter((l) => l.kind === 'safety' || (l.kind === 'goal' && l.priority === 'must'));
    const rest = lines.filter((l) => !protectedFirst.includes(l));
    for (const l of [...protectedFirst, ...rest]) {
      const a = Math.min(pool, l.usual);
      l.amount = a;
      pool -= a;
    }
    for (const l of lines) {
      if (l.amount >= l.usual) l.status = 'full';
      else if (l.kind === 'commitment') l.status = 'catchUp';
      else l.status = l.amount <= 0 ? 'next' : 'partial';
    }
    return { amount, usual, kind: 'less', lines };
  }
  if (amount > usual) {
    let extra = amount - usual;
    const goals = lines.filter((l) => l.kind === 'goal');
    const gap = (l: PaydayLine) => Math.max(0, (required.get(l.goalId!) ?? l.usual) - l.amount);
    for (const l of [...goals].sort((a, b) => RANK[a.priority ?? 'nice'] - RANK[b.priority ?? 'nice'] || gap(b) - gap(a))) {
      const add = Math.min(extra, gap(l));
      if (add > 0) {
        l.amount += add;
        l.status = 'extra';
        extra -= add;
      }
    }
    if (extra > 0) {
      const retire = goals.find((l) => input.goals.find((g) => g.id === l.goalId)?.isRetirement) ?? goals[0];
      if (retire) {
        retire.amount += extra;
        retire.status = 'extra';
      }
    }
    return { amount, usual, kind: 'bonus', lines };
  }
  return { amount, usual, kind: 'same', lines };
}

export type Move = {
  key: string; // holdingId, or `class:<cls>` / `loan:<id>` when there is no holding
  holdingId: string;
  assetClass: PlannedClass | 'loan';
  amount: number;
  /** Which lines (goals, commitments) this money serves, with how much each. */
  parts: { lineId: string; amount: number }[];
};

/** Preferred holding per goal and class ("Use a different holding of the same kind", 4.3). */
export type HoldingPrefs = Record<string, string>; // `${goalId}:${class}` → holdingId
export const prefKey = (goalId: string, cls: PlannedClass) => `${goalId}:${cls}`;

/**
 * Splits each line into the user's own holdings. Goals follow their mix (new money fills the gap
 * to target first, so the mix glides without selling). Commitments go to their holding; the
 * safety-net top-up to cash; debt prepayment to the loan.
 */
export function movesForPlan(input: PlanInput, plan: PaydayPlan, prefs: HoldingPrefs = {}): Move[] {
  const risk = effectiveRisk(input.profile);
  const shares = holdingShares(input);
  const balances = goalBalances(input);
  const commitmentIds = new Set(input.flowRules.flatMap((r) => (r.type === 'commitment' ? [r.holdingId] : [])));
  const out = new Map<string, Move>();
  const add = (key: string, holdingId: string, cls: Move['assetClass'], lineId: string, amount: number) => {
    if (amount < 0.5) return;
    const m = out.get(key) ?? { key, holdingId, assetClass: cls, amount: 0, parts: [] };
    m.amount += amount;
    m.parts.push({ lineId, amount });
    out.set(key, m);
  };
  const open = (h: Holding, cls: PlannedClass) => h.planned && h.assetClass === cls && !commitmentIds.has(h.id) && !h.autoMonthly;

  for (const l of plan.lines) {
    if (l.amount <= 0) continue;
    if (l.kind === 'debt') {
      add(`loan:${l.loanId}`, '', 'loan', l.id, l.amount);
      continue;
    }
    if (l.kind === 'commitment') {
      const h = input.holdings.find((x) => x.id === l.holdingId);
      add(h ? h.id : `class:debt`, h?.id ?? '', (h?.assetClass as PlannedClass) ?? 'debt', l.id, l.amount);
      continue;
    }
    const goal = input.goals.find((g) => g.id === l.goalId) as Goal;
    const date = goal.isRetirement ? retirementDate(goal, input) : goal.date;
    const w = l.kind === 'safety' ? [1, 0, 0, 0, 0] : targetWeights([...PROFILE_MIX[risk]], GLOBAL_SHARE_OF_EQUITY[risk], Math.max(0, (date - input.today) / 12));
    const bal = (balances.get(goal.id) ?? [0, 0, 0, 0, 0]).slice();
    const before = bal.slice();
    allocate(bal, l.amount, w);
    PLANNED_CLASSES.forEach((cls, k) => {
      const amt = bal[k] - before[k];
      if (amt < 0.5) return;
      const pref = prefs[prefKey(goal.id, cls)];
      const preferred = pref ? input.holdings.find((h) => h.id === pref && open(h, cls)) : undefined;
      let pick = preferred ? [preferred] : input.holdings.filter((h) => open(h, cls) && (shares.get(h.id)?.get(goal.id) ?? 0) > 0);
      // Funds before single stocks; else the user's biggest holding of the kind.
      const funds = pick.filter((h) => !h.isStock);
      if (funds.length) pick = funds;
      if (pick.length === 0) pick = input.holdings.filter((h) => open(h, cls)).sort((a, b) => b.value - a.value).slice(0, 1);
      if (pick.length === 0) return add(`class:${cls}`, '', cls, l.id, amt);
      // Within a class, the goal's biggest holding of that kind gets it (one move, not many).
      const h = pick.sort((a, b) => b.value * (shares.get(b.id)?.get(goal.id) ?? 0) - a.value * (shares.get(a.id)?.get(goal.id) ?? 0))[0];
      add(h.id, h.id, cls, l.id, amt);
    });
  }
  // Round to ₹100 per move; the remainder goes to the biggest so the total is exact.
  const moves = [...out.values()].map((m) => ({ ...m, amount: Math.round(m.amount / 100) * 100 })).filter((m) => m.amount > 0);
  moves.sort((a, b) => b.amount - a.amount);
  const total = plan.lines.reduce((a, l) => a + l.amount, 0);
  const diff = Math.round(total) - moves.reduce((a, m) => a + m.amount, 0);
  if (moves.length && Math.abs(diff) < 100 * moves.length) moves[0].amount += diff;
  // Commitments first (PPF leads the check-in list), then by size.
  const isCommitment = (m: Move) => m.parts.some((p) => plan.lines.find((l) => l.id === p.lineId)?.kind === 'commitment');
  return moves.sort((a, b) => Number(isCommitment(b)) - Number(isCommitment(a)) || b.amount - a.amount);
}

/** The holdings a goal-line's money went to, for 4.3 "Split by this goal's mix". */
export function linesMoves(moves: Move[], lineId: string): { key: string; holdingId: string; assetClass: Move['assetClass']; amount: number }[] {
  return moves.flatMap((m) => m.parts.filter((p) => p.lineId === lineId).map((p) => ({ key: m.key, holdingId: m.holdingId, assetClass: m.assetClass, amount: Math.round(p.amount / 100) * 100 })));
}
