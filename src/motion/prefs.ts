/**
 * Reduced motion and ambient-loop plumbing (04-MOTION.md).
 * - Reduced motion = the OS setting OR You → Settings → "Reduce animations".
 * - Ambient loops run only while the screen is focused, the app is active, and Low Power Mode is off.
 *   Every component using this renders inside an Expo Router screen, so focus always has a navigator.
 */
import { useLowPowerMode } from './lowPower';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useSettingsStore } from '../state/stores';

export function useReduceMotion(): boolean {
  const os = useReducedMotion();
  const forced = useSettingsStore((s) => s.reduceMotion);
  return os || forced;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** True when ambient loops (breathing, drift, bobbing) should run. */
export function useAmbient(): boolean {
  const reduce = useReduceMotion();
  const focused = useIsFocused();
  const active = useAppActive();
  const lowPower = useLowPowerMode();
  return !reduce && focused && active && !lowPower;
}
