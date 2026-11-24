// Habit selectors for the prototypes (Phase 9 builds the full rules from 06-HABITS.md).
import { usePaydayStore, useHabitsStore } from '../state/stores';

export function useLevel(): number {
  return useHabitsStore((s) => s.events.reduce((m, e) => (e.kind === 'level' ? Math.max(m, e.data.level) : m), 0));
}

/** Consecutive months placed (or covered by a shield), counting back from the latest placed month. */
export function useStreak(): number {
  const paydays = usePaydayStore((s) => s.paydays);
  const events = useHabitsStore((s) => s.events);
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
}
