/**
 * One-time moments the app shows from the user's own data (never from markets it can't see):
 * - Market fall (2.2): from the highest recorded total; fires once per fall when the drop crosses
 *   the profile's threshold (10%; 7% Cautious; 5% Safety-first) and re-arms only after a new high.
 * - Milestones (2.3): habits only — 6 and 12 paydays, safety net full, first ₹1 Cr invested.
 * - Goal day (3.5): a goal's money reaches its target.
 * Pure TS. "Shown" keys are stored as habit events of kind 'moment'.
 */
import { goalBalances, planGoals, safetyNet } from './plan';
import type { PlanInput, RiskProfile, YM } from './types';

export const FALL_THRESHOLD: Record<RiskProfile, number> = { safetyFirst: 0.05, cautious: 0.07, balanced: 0.1, growth: 0.1, aggressive: 0.1 };

export type Snapshot = { date: YM; holdingId: string | null; value: number };
export type FallMoment = { key: string; high: number; current: number; drop: number; pct: number; asOf: YM };

/**
 * Total invested by date. Confirmed totals (holdingId null) win; otherwise the latest value of each
 * holding is carried forward and summed.
 */
export function totalsByDate(snapshots: Snapshot[]): { date: YM; total: number }[] {
  const dates = [...new Set(snapshots.map((s) => s.date))].sort((a, b) => a - b);
  const latest = new Map<string, number>();
  const out: { date: YM; total: number }[] = [];
  for (const d of dates) {
    const at = snapshots.filter((s) => s.date === d);
    for (const s of at) if (s.holdingId) latest.set(s.holdingId, s.value);
    const confirmed = at.find((s) => s.holdingId == null);
    out.push({ date: d, total: confirmed ? confirmed.value : [...latest.values()].reduce((a, b) => a + b, 0) });
  }
  return out;
}

export function marketFall(snapshots: Snapshot[], risk: RiskProfile, shown: Set<string>): FallMoment | null {
  const totals = totalsByDate(snapshots);
  if (totals.length < 2) return null;
  const high = Math.max(...totals.map((t) => t.total));
  const last = totals[totals.length - 1];
  if (high <= 0) return null;
  const pct = (high - last.total) / high;
  const key = `fall-${Math.round(high)}`; // once per high: a new high re-arms it
  if (pct < FALL_THRESHOLD[risk] || shown.has(key)) return null;
  return { key, high, current: last.total, drop: high - last.total, pct, asOf: last.date };
}

export type MilestoneKey = 'paydays-6' | 'paydays-12' | 'safety-full' | 'invested-1cr';

export function pendingMilestone(input: PlanInput, streak: number, shown: Set<string>): MilestoneKey | null {
  const invested = input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0);
  const sn = safetyNet(input);
  const due: [MilestoneKey, boolean][] = [
    ['paydays-12', streak >= 12],
    ['paydays-6', streak >= 6],
    ['safety-full', !!sn && sn.target > 0 && sn.full],
    ['invested-1cr', invested >= 1_00_00_000],
  ];
  return due.find(([k, ok]) => ok && !shown.has(k))?.[0] ?? null;
}

/** Goals whose money has reached the target (today's rupees), not yet celebrated. */
export function reachedGoal(input: PlanInput, shown: Set<string>): { goalId: string; amount: number } | null {
  const bal = goalBalances(input);
  for (const g of planGoals(input)) {
    if (g.isRetirement || g.targetToday <= 0) continue;
    const have = (bal.get(g.id) ?? []).reduce((a, b) => a + b, 0);
    if (have >= g.targetToday && !shown.has(`goal-${g.id}`)) return { goalId: g.id, amount: have };
  }
  return null;
}

/**
 * Whether a fall sits inside what the plan expects for this profile in a bad year: the equity
 * share × typical equity volatility × 1.645 (a 1-in-20 year). Balanced: about 15%.
 */
export function expectedBadYearDrop(profileEquity: number, equityVolatilityPct = 15): number {
  return profileEquity * (equityVolatilityPct / 100) * 1.645;
}

export type GlideStep = { from: YM; cap: number; yearsLeft: number };

/**
 * The goal's equity cap over time (3.4): the profile's mix far out, then 60% inside 7 years, 40%
 * inside 5 and 20% inside 3. Only steps that actually lower the cap are listed.
 */
export function glideSteps(today: YM, date: YM, profileEquity: number): GlideStep[] {
  const bands = [
    { years: 7, cap: 0.6 },
    { years: 5, cap: 0.4 },
    { years: 3, cap: 0.2 },
  ];
  const left = (date - today) / 12;
  const start = left >= 7 ? profileEquity : left >= 5 ? Math.min(profileEquity, 0.6) : left >= 3 ? Math.min(profileEquity, 0.4) : Math.min(profileEquity, 0.2);
  const steps: GlideStep[] = [{ from: today, cap: start, yearsLeft: left }];
  for (const b of bands) {
    const at = date - b.years * 12;
    const cap = Math.min(profileEquity, b.cap);
    if (at > today && cap < steps[steps.length - 1].cap) steps.push({ from: at, cap, yearsLeft: b.years });
  }
  return steps;
}

/** Shown keys from habit events. */
export const shownKeys = (events: { kind: string; data: unknown }[]) =>
  new Set(events.filter((e) => e.kind === 'moment').map((e) => (e.data as { key: string }).key));
