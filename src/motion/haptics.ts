/**
 * Every haptic goes through here (04-MOTION.md haptics map). Respects the global "Haptics" setting
 * and a "quiet" scope: the market-fall screen turns haptics off entirely while it's mounted.
 * Safe to call from worklets via `scheduleOnRN(haptics.x)`.
 */
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '../state/stores';

let quietDepth = 0;
const enabled = () => quietDepth === 0 && useSettingsStore.getState().haptics;
const run = (f: () => Promise<void>) => {
  if (!enabled()) return;
  f().catch(() => undefined);
};

export const haptics = {
  /** Primary button press-in. */
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Pill/segment change, list reorder slot, dial tick, scrub year boundary, bubble arrive. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Payday bubble pop (light tick per bubble), hop. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Check-in tick. */
  tick: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Coin caught, Gullu lands. */
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Receipt line ratchet. */
  ratchet: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Level up, milestone, goal reached. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Destructive confirm. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

/** Silence haptics while a calm screen is mounted. Returns the release function. */
export function quietHaptics(): () => void {
  quietDepth++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    quietDepth = Math.max(0, quietDepth - 1);
  };
}
