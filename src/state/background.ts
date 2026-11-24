// The persistent background behind the navigator: screens declare their gradient on focus and the
// background cross-fades between variants (04-MOTION.md "Gradient cross-fade").
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { create } from 'zustand';

import type { GradientVariant } from '../components/ScreenBackground';

export const useBackgroundStore = create<{ variant: GradientVariant; set: (v: GradientVariant) => void }>()((set) => ({
  variant: 'dusk',
  set: (variant) => set({ variant }),
}));

export function useScreenBackground(variant: GradientVariant) {
  useFocusEffect(
    useCallback(() => {
      useBackgroundStore.getState().set(variant);
    }, [variant]),
  );
}
