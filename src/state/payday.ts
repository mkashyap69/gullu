/**
 * The monthly loop, end to end (4.2 → 4.4 → value update → 4.5): start a payday, place it, confirm
 * values, and evaluate habits (streak, shields, festival looks, levels). Writes through the stores.
 */
import type { CheckMove, HabitEvent } from '../data/repo';
import { festivalFor, LEVELS, nextUnlock, streakState, type Level } from '../engine/habits';
import { movesForPlan, paydayPlan, type PaydayKind } from '../engine/payday';
import { fyOf, goalResultFast, paidThisFy, planGoals } from '../engine/plan';
import type { AssetClass, PlanInput } from '../engine/types';
import { useGoalsStore, useHabitsStore, useHoldingsStore, usePaydayStore, useProfileStore } from './stores';

/** The plan input as the stores hold it right now. */
export function planInputNow(): PlanInput | null {
  const p = useProfileStore.getState();
  const g = useGoalsStore.getState();
  const h = useHoldingsStore.getState();
  if (!p.profile || !p.assumptions) return null;
  const d = new Date();
  const today = p.pinnedToday ?? d.getFullYear() * 12 + d.getMonth();
  return { today, profile: p.profile, assumptions: p.assumptions, goals: g.goals, flowRules: g.flowRules, holdings: h.holdings, holdingGoals: h.holdingGoals, loans: h.loans };
}

export function requiredMap(input: PlanInput): Map<string, number | null> {
  return new Map(planGoals(input).map((g) => [g.id, goalResultFast(input, g).requiredMonthly]));
}

/** Sets up this month's check-in from the payday amount (same, less or bonus). */
export async function startPayday(amount: number): Promise<{ kind: PaydayKind }> {
  const input = planInputNow();
  if (!input) throw new Error('No plan');
  const plan = paydayPlan(input, amount, requiredMap(input));
  const moves = movesForPlan(input, plan, usePaydayStore.getState().prefs);
  const month = input.today;
  const store = usePaydayStore.getState();
  await store.savePayday({ month, amount, kind: plan.kind, placedAt: null });
  const check: CheckMove[] = moves.map((m) => ({ month, key: m.key, holdingId: m.holdingId, assetClass: m.assetClass, planned: m.amount, actual: m.amount, done: false, parts: m.parts }));
  await store.setMoves(month, check);
  return { kind: plan.kind };
}

export type PlaceResult = { month: number; streak: number; shieldCovered: number[]; festival: string | null; levels: Level[] };

/**
 * Check-in "Done": the ticked moves are in. Holdings and loans move by what was actually put in,
 * PPF records what's paid this financial year, the payday is placed, and habits are evaluated.
 */
export async function placePayday(month: number): Promise<PlaceResult> {
  const input = planInputNow();
  if (!input) throw new Error('No plan');
  const pay = usePaydayStore.getState();
  const holdings = useHoldingsStore.getState();
  const goals = useGoalsStore.getState();
  const done = pay.moves.filter((m) => m.month === month && m.done && m.actual > 0);

  for (const m of done) {
    if (m.assetClass === 'loan') {
      const loanId = m.key.replace(/^loan:/, '');
      const l = holdings.loans.find((x) => x.id === loanId);
      if (l) await holdings.upsertLoan({ ...l, balance: Math.max(0, l.balance - m.actual) });
      continue;
    }
    const h = useHoldingsStore.getState().holdings.find((x) => x.id === m.holdingId);
    if (h) await useHoldingsStore.getState().upsertHolding({ ...h, value: h.value + m.actual, valueAt: month });
  }
  // Commitments: what went in counts towards this financial year's cap.
  const rules = goals.flowRules.map((r) => {
    if (r.type !== 'commitment') return r;
    const paid = done.filter((m) => m.holdingId === r.holdingId).reduce((a, m) => a + m.actual, 0);
    if (!paid) return r;
    return { ...r, paidThisYear: paidThisFy(r, month) + paid, paidFy: fyOf(month) };
  });
  await goals.setFlowRules(rules);

  const rec = pay.paydays.find((p) => p.month === month);
  await pay.savePayday({ month, amount: rec?.amount ?? done.reduce((a, m) => a + m.actual, 0), kind: rec?.kind ?? 'same', placedAt: month });

  // Habits.
  const habits = useHabitsStore.getState();
  const placed = usePaydayStore.getState().paydays.filter((p) => p.placedAt != null).map((p) => p.month);
  const used = habits.events.flatMap((e) => (e.kind === 'shield' && e.data.used ? [e.data.month] : []));
  const s = streakState(placed, used, month);
  const newShields = s.shielded.filter((m) => !used.includes(m));
  for (const m of newShields) await habits.add({ kind: 'shield', data: { month: m, used: true }, at: month });
  let festival: string | null = null;
  const f = festivalFor(month);
  if (f && !habits.events.some((e) => e.kind === 'skin' && e.data.label === f.label)) {
    await habits.add({ kind: 'skin', data: { skin: f.skin, label: f.label }, at: month });
    festival = f.label;
  }
  const levels = await unlockLevels(s.streak);
  return { month, streak: s.streak, shieldCovered: newShields, festival, levels };
}

/** Unlocks every level whose condition now holds, in order, once each. Levels never go down. */
export async function unlockLevels(streak?: number): Promise<Level[]> {
  const input = planInputNow();
  if (!input) return [];
  const habits = useHabitsStore.getState();
  const placed = usePaydayStore.getState().paydays.filter((p) => p.placedAt != null).map((p) => p.month);
  const used = habits.events.flatMap((e) => (e.kind === 'shield' && e.data.used ? [e.data.month] : []));
  const st = streak ?? streakState(placed, used, input.today).streak;
  let current = habits.events.reduce((m, e) => (e.kind === 'level' ? Math.max(m, e.data.level) : m), 0);
  const out: Level[] = [];
  for (;;) {
    const next = nextUnlock(current, input, st);
    if (!next) break;
    const events: HabitEvent[] = [
      { kind: 'level', data: { level: next.n }, at: input.today },
      { kind: 'skin', data: { skin: next.skin, label: next.name }, at: input.today },
      // The new look is worn straight away; the user can pick another in the collection.
      { kind: 'wear', data: { skin: next.skin }, at: input.today },
    ];
    for (const e of events) await useHabitsStore.getState().add(e);
    out.push(next);
    current = next.n;
  }
  return out;
}

/**
 * Value update (4.4b): the user confirms one value per asset class. Holdings in a class are
 * scaled to match, and each value plus the total is recorded (market-fall detection, stale nudges).
 */
export async function confirmValues(month: number, byClass: Partial<Record<AssetClass, number>>): Promise<void> {
  const hs = useHoldingsStore.getState();
  for (const [cls, value] of Object.entries(byClass) as [AssetClass, number][]) {
    const inClass = useHoldingsStore.getState().holdings.filter((h) => h.assetClass === cls);
    const sum = inClass.reduce((a, h) => a + h.value, 0);
    for (const h of inClass) {
      const v = sum > 0 ? (h.value / sum) * value : value / inClass.length;
      await hs.upsertHolding({ ...h, value: Math.round(v), valueAt: month });
      await hs.recordValue({ date: month, holdingId: h.id, assetClass: cls, value: Math.round(v) });
    }
  }
  const total = useHoldingsStore.getState().holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0);
  await hs.recordValue({ date: month, holdingId: null, assetClass: null, value: total });
}

export const levelByN = (n: number) => LEVELS[n - 1];
