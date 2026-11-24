// One accent per goal kind, used on 1.4 dots, rings and Payday bubbles (03-DESIGN-SYSTEM goal accents).
import type { Goal } from '../engine/types';
import { colors } from '../theme/tokens';

export function goalColor(g: Pick<Goal, 'template' | 'isSafetyNet' | 'isRetirement'> & { name?: string }): string {
  if (g.isSafetyNet) return colors.cash;
  if (g.isRetirement) return colors.goal[3];
  switch (g.template) {
    case 'home':
      return colors.goal[0];
    case 'education':
      return colors.goal[2];
    case 'travel':
      return colors.goal[4];
    case 'health':
      return colors.goal[1];
    default:
      return colors.goal[5];
  }
}
