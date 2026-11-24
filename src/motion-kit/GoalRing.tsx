/**
 * GoalRing: a Skia arc ring in the goal's colour that fills from 0 to its value on first paint
 * (spring.gentle, staggered by `index × stagger.rings`). Shared-element source for Goal detail.
 * Reduced motion: appears filled.
 */
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import Animated, { useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { spring, stagger } from '../theme/motion';
import { colors } from '../theme/tokens';

export function GoalRing({
  progress,
  color,
  size = 72,
  stroke = 7,
  index = 0,
  sharedTag,
  trackColor = colors.track,
}: {
  progress: number;
  color: string;
  size?: number;
  stroke?: number;
  index?: number;
  sharedTag?: string;
  trackColor?: string;
}) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(reduce ? progress : 0);
  useEffect(() => {
    fill.value = reduce ? progress : withDelay(index * stagger.rings, withSpring(progress, spring.gentle));
  }, [progress, index, reduce, fill]);
  const r = (size - stroke) / 2;
  const arc = useMemo(() => {
    // Starts at 12 o'clock, clockwise.
    return Skia.PathBuilder.Make()
      .addArc(Skia.XYWHRect(stroke / 2, stroke / 2, r * 2, r * 2), -90, 359.9)
      .build();
  }, [r, stroke]);
  return (
    <Animated.View sharedTransitionTag={sharedTag} style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} style="stroke" strokeWidth={stroke} color={trackColor} />
        <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" color={color} start={0} end={fill} />
      </Canvas>
    </Animated.View>
  );
}
