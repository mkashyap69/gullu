/**
 * usePlan(): the derived plan for the screens. The single-line plan is computed synchronously
 * (≤ 16ms); Monte Carlo ranges arrive a moment later from the background runtime and are merged in.
 * Memoised on the store snapshots, so it only recomputes when inputs change.
 */
import { useEffect, useMemo, useState } from 'react';

import { DEMO_TODAY } from '../data/demo';
import { CHOL, MC_PATHS, MC_SEED, computePlanFast, goalSpec, planGoals, withRanges, type Plan } from '../engine/plan';
import type { McResult } from '../engine/core';
import type { PlanInput } from '../engine/types';
import { useGoalsStore, useHoldingsStore, useProfileStore } from '../state/stores';
import { runMonteCarlo } from './runMonteCarlo';

/** "Today" for the plan. The demo personas are pinned to 1 Apr 2028 so screens match the designs. */
export function useToday(): number {
  return DEMO_TODAY;
}

export function usePlanInput(): PlanInput | null {
  const profile = useProfileStore((s) => s.profile);
  const assumptions = useProfileStore((s) => s.assumptions);
  const goals = useGoalsStore((s) => s.goals);
  const flowRules = useGoalsStore((s) => s.flowRules);
  const holdings = useHoldingsStore((s) => s.holdings);
  const holdingGoals = useHoldingsStore((s) => s.holdingGoals);
  const loans = useHoldingsStore((s) => s.loans);
  const today = useToday();
  return useMemo(
    () => (profile && assumptions ? { today, profile, assumptions, goals, holdings, holdingGoals, flowRules, loans } : null),
    [today, profile, assumptions, goals, holdings, holdingGoals, flowRules, loans],
  );
}

export type PlanState = { plan: Plan | null; ranges: McResult[] | null; rangesReady: boolean };

export function usePlan(): PlanState {
  const input = usePlanInput();
  const fast = useMemo(() => (input ? computePlanFast(input) : null), [input]);
  const [mc, setMc] = useState<{ input: PlanInput; results: McResult[] } | null>(null);
  useEffect(() => {
    if (!input) return;
    let live = true;
    const specs = planGoals(input).map((g) => goalSpec(input, g));
    runMonteCarlo(specs, MC_PATHS, MC_SEED, CHOL)
      .then((results) => {
        if (live) setMc({ input, results });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [input]);
  const plan = useMemo(() => {
    if (!fast || !input) return null;
    if (!mc || mc.input !== input) return fast;
    const goals = fast.goals.map((g, i) => withRanges(input, g, mc.results[i]));
    const onTrack = goals.filter((g) => g.onTrack).length;
    return { ...fast, goals, onTrack };
  }, [fast, mc, input]);
  return { plan, ranges: mc && mc.input === input ? mc.results : null, rangesReady: !!mc && mc.input === input };
}
