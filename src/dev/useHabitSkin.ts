// The look Gullu wears everywhere: the latest "wear" habit event, else base.
import type { Skin } from '../gullu/geometry';
import { useHabitsStore } from '../state/stores';

export function useHabitSkin(): Skin {
  return useHabitsStore((s) => {
    const wear = [...s.events].reverse().find((e) => e.kind === 'wear');
    return (wear?.kind === 'wear' ? wear.data.skin : 'base') as Skin;
  });
}
