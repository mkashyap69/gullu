// Selectors shared by the screens: streak, level, payday due, display names.
import { useMemo } from 'react';

import { shownKeys } from '../engine/moments';
import { useHabitsStore, usePaydayStore, useProfileStore } from '../state/stores';
import { useToday } from './usePlan';

export function useLevel(): number {
  return useHabitsStore((s) => s.events.reduce((m, e) => (e.kind === 'level' ? Math.max(m, e.data.level) : m), 0));
}

/** Consecutive months placed (or covered by a shield), counting back from the latest placed month. */
export function useStreak(): number {
  const paydays = usePaydayStore((s) => s.paydays);
  const events = useHabitsStore((s) => s.events);
  return useMemo(() => {
    const placed = new Set(paydays.filter((p) => p.placedAt != null).map((p) => p.month));
    const shielded = new Set(events.flatMap((e) => (e.kind === 'shield' && e.data.used ? [e.data.month] : [])));
    if (placed.size === 0) return 0;
    let m = Math.max(...placed);
    let n = 0;
    while (placed.has(m) || shielded.has(m)) {
      n++;
      m--;
    }
    return n;
  }, [paydays, events]);
}

export function useShown(): Set<string> {
  const events = useHabitsStore((s) => s.events);
  return useMemo(() => shownKeys(events), [events]);
}

/**
 * This month's money, if it has landed and isn't placed yet: a recorded unplaced payday, or (for
 * real plans) the payday date has come this month.
 */
export function usePaydayDue(): number | null {
  const today = useToday();
  const paydays = usePaydayStore((s) => s.paydays);
  const profile = useProfileStore((s) => s.profile);
  const pinned = useProfileStore((s) => s.pinnedToday);
  if (!profile || profile.work === 'retired' || profile.monthly <= 0) return null;
  const rec = paydays.find((p) => p.month === today);
  if (rec) return rec.placedAt == null ? rec.amount : null;
  if (pinned != null) return null;
  if (profile.incomeVaries || profile.paydayDay === -1) return null; // money in is logged, not dated
  const day = new Date().getDate();
  const last = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const due = profile.paydayDay === 0 ? last : profile.paydayDay;
  return day >= due ? profile.monthly : null;
}

const SHORT: Record<string, string> = { "Child's education": 'Education', 'Japan trip': 'Japan trip' };
/** Ring labels on Home (Known design fix 1: "Education", capitalised). */
export const ringName = (name: string) => SHORT[name] ?? name;
