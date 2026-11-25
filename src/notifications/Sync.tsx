/**
 * Keeps notifications and widgets in step with the data: after any change (debounced) the next 8
 * weeks of notifications are rescheduled and the widget snapshot is republished. Going to the
 * background also schedules any in-app moment the user hasn't seen yet (goal reached, safety net).
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useLevel, useStreak } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useHabitsStore, useHoldingsStore, usePaydayStore, useSettingsStore } from '@/state/stores';
import { publishWidgetSnapshot } from '@/widgets/publish';

import { reschedule, setupNotifications } from './schedule';

export function NotificationSync() {
  const input = usePlanInput();
  const streak = useStreak();
  const level = useLevel();
  const settings = useSettingsStore();
  const paydays = usePaydayStore((s) => s.paydays);
  const moves = usePaydayStore((s) => s.moves);
  const events = useHabitsStore((s) => s.events);
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const latest = useRef({ input, streak, enabled: settings.notifications });
  latest.current = { input, streak, enabled: settings.notifications };

  useEffect(() => {
    let off: (() => void) | undefined;
    setupNotifications().then((f) => (off = f));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') reschedule(latest.current.input, latest.current.streak, latest.current.enabled, true);
    });
    return () => {
      off?.();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      reschedule(input, streak, settings.notifications);
      publishWidgetSnapshot(input, streak, level);
    }, 800);
    return () => clearTimeout(t);
  }, [input, streak, level, settings, paydays, moves, events, snapshots]);

  return null;
}
