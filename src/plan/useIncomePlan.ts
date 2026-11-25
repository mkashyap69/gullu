// The retiree income plan: the quick numbers on first paint, the Monte Carlo age a beat later.
import { useEffect, useMemo, useState } from 'react';

import { incomePlan, type IncomePlan } from '@/engine/income';

import { usePlanInput } from './usePlan';

export function useIncomePlan(): IncomePlan | null {
  const input = usePlanInput();
  const quick = useMemo(() => (input ? incomePlan(input, 0) : null), [input]);
  const [full, setFull] = useState<{ key: unknown; plan: IncomePlan } | null>(null);
  useEffect(() => {
    if (!input) return;
    const t = setTimeout(() => setFull({ key: input, plan: incomePlan(input) }), 0);
    return () => clearTimeout(t);
  }, [input]);
  return full && full.key === input ? full.plan : quick;
}
