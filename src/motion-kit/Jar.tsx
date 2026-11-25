/**
 * Jar (7.2): a rounded jar with liquid that rises to its level and settles with a slow wave. The
 * wave path is built on the UI thread from two shared values (level, phase); reduced motion and low
 * power show a still, flat surface.
 */
import { Canvas, Group, Path, RoundedRect, Skia, rrect, rect } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { useAmbient, useReduceMotion } from '../motion/prefs';
import { signature, spring } from '../theme/motion';
import { colors } from '../theme/tokens';

const R = 22;

export function Jar({ width, height, fill, color, delay = 0 }: { width: number; height: number; fill: number; color: string; delay?: number }) {
  const reduce = useReduceMotion();
  const ambient = useAmbient();
  const level = useSharedValue(reduce ? fill : 0);
  const phase = useSharedValue(0);
  const amp = useSharedValue(reduce ? 0 : 5);
  useEffect(() => {
    level.value = reduce ? fill : withDelay(delay, withSpring(fill, spring.gentle));
    if (reduce) amp.value = 0;
    else amp.value = withDelay(delay, withTiming(ambient ? 2 : 0, { duration: signature.ambientDrift / 4 }));
    if (ambient && !reduce) phase.value = withRepeat(withTiming(Math.PI * 2, { duration: signature.ambientDrift / 2, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [fill, reduce, ambient, delay, level, phase, amp]);
  const liquid = useDerivedValue(() => {
    const top = height * (1 - level.value);
    const b = Skia.PathBuilder.Make().moveTo(0, height).lineTo(0, top);
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const x = (width * i) / steps;
      b.lineTo(x, top + amp.value * Math.sin((i / steps) * Math.PI * 2 + phase.value));
    }
    return b.lineTo(width, height).close().build();
  });
  const clip = rrect(rect(0, 0, width, height), R, R);
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <RoundedRect x={0} y={0} width={width} height={height} r={R} color={colors.glass} />
      <Group clip={clip}>
        <Path path={liquid} color={color} />
      </Group>
    </Canvas>
  );
}
