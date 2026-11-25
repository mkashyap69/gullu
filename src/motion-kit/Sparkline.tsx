/** A small trend line that draws in (5.1). Values are plotted left to right; at least two points. */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { duration, easing } from '../theme/motion';
import { colors } from '../theme/tokens';

export function Sparkline({ values, width, height, color = colors.white }: { values: number[]; width: number; height: number; color?: string }) {
  const reduce = useReduceMotion();
  const draw = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) draw.value = withTiming(1, { duration: duration.draw, easing: easing.out });
  }, [reduce, draw, values.length]);
  const path = useMemo(() => {
    const v = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
    const min = Math.min(...v);
    const max = Math.max(...v);
    const b = Skia.PathBuilder.Make();
    v.forEach((y, i) => {
      const px = (i / (v.length - 1)) * width;
      const py = 4 + (1 - (max > min ? (y - min) / (max - min) : 0.5)) * (height - 8);
      if (i === 0) b.moveTo(px, py);
      else b.lineTo(px, py);
    });
    return b.build();
  }, [values, width, height]);
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" color={color} start={0} end={draw} />
    </Canvas>
  );
}
