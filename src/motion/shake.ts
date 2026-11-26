// The soft shake (Collection locked tile, Money minute wrong pick): small, quick, settles to 0.
import { withSequence, withTiming } from 'react-native-reanimated';

import { signature } from '../theme/motion';

export function softShake(px: number = signature.softShakePx) {
  'worklet';
  const d = signature.softShakeStep;
  return withSequence(withTiming(-px, { duration: d * 0.8 }), withTiming(px, { duration: d * 1.2 }), withTiming(-px / 2, { duration: d }), withTiming(0, { duration: d }));
}
