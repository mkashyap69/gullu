/**
 * publishWidgetSnapshot(): the one function that refreshes every widget. Called after payday,
 * check-in, value update, goal edits and settings changes (hide amounts, Gullu's look).
 */
import { LEVELS, checkLevel } from '@/engine/habits';
import { computePlanFast } from '@/engine/plan';
import type { PlanInput } from '@/engine/types';
import { ringName } from '@/plan/selectors';
import { useHabitsStore, usePaydayStore, useSettingsStore } from '@/state/stores';

import { buildWidgetSnapshot } from './snapshot';

export function publishWidgetSnapshot(input: PlanInput | null, streak: number, level: number): void {
  if (!input || input.profile.work === 'retired') return;
  try {
    // Loaded lazily so the widget runtime and its native module never load in tests or on web.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const w = require('./MoneyPlanWidgets') as typeof import('./MoneyPlanWidgets');
    const pay = usePaydayStore.getState();
    const rec = pay.paydays.find((p) => p.month === input.today);
    const due = rec && rec.placedAt == null ? rec.amount : null;
    const names = new Map(input.holdings.map((h) => [h.id, h.name]));
    const moves = pay.moves.filter((m) => m.month === input.today).map((m) => ({ name: names.get(m.holdingId) ?? 'New holding', amount: m.actual, done: m.done }));
    const next = LEVELS[level];
    const events = useHabitsStore.getState().events;
    const wear = [...events].reverse().find((e) => e.kind === 'wear');
    const snap = buildWidgetSnapshot({
      input,
      plan: computePlanFast(input),
      hidden: useSettingsStore.getState().hideAmounts,
      due,
      moves,
      progress: next ? checkLevel(next.n, input, streak).detail : `Level ${level}`,
      skin: wear?.kind === 'wear' ? wear.data.skin : 'base',
    });
    w.statusWidget.updateSnapshot(snap);
    w.paydayWidget.updateSnapshot(snap);
    w.movesWidget?.updateSnapshot(snap);
    if (w.goalWidget) {
      w.goalWidget.updateSnapshot(snap);
      w.goalWidget.setConfigurationParameterEnum('goal', input.goals.filter((g) => !g.isSafetyNet).map((g) => ({ name: ringName(g.name), value: g.id })));
    }
  } catch {
    // Widgets are a bonus: a missing extension (Expo Go, dev client without prebuild) never breaks the app.
  }
}
