/**
 * Standard screen-enter: rises distance.enter px and fades in over duration.base (easing.out),
 * staggered by `index × stagger.cards`. Reduced motion: a plain fade over duration.fast.
 * Never blocks input: entering animations don't disable touches.
 */
import type { ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { distance, duration, easing, stagger } from '../theme/motion';

export function Rise({ index = 0, delay = 0, children, style }: { index?: number; delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  // Web preview only: Reanimated's web entering animations take the wrapper out of flow, so the
  // preview skips them. iOS/Android always animate.
  const entering = Platform.OS === 'web'
    ? undefined
    : reduce
    ? FadeIn.duration(duration.fast).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(duration.base)
        .easing(easing.out)
        .delay(delay + index * stagger.cards)
        .withInitialValues({ opacity: 0, transform: [{ translateY: distance.enter }] })
        .reduceMotion(ReduceMotion.Never);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
