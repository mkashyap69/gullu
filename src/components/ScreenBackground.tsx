/**
 * Full-bleed gradient background (03-DESIGN-SYSTEM.md rule 1), drawn in Skia so it can move:
 * - cross-fades over duration.slow when the variant changes (persistent layer behind the navigator),
 * - drifts slowly on dusk and ember (stops shift a few percent over ~10s, looping),
 * - drift pauses off-screen, in the background, in Low Power Mode and with reduced motion.
 */
import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useAmbient, useReduceMotion } from '../motion/prefs';
import { duration, easing, signature } from '../theme/motion';
import { gradients } from '../theme/tokens';

export type GradientVariant = keyof typeof gradients;
const DRIFTS: GradientVariant[] = ['dusk', 'ember'];
const DRIFT_SHIFT = 0.03;

function GradientLayer({ variant, drift, opacity, width, height }: {
  variant: GradientVariant;
  drift: { value: number };
  opacity: { value: number } | number;
  width: number;
  height: number;
}) {
  const g = gradients[variant];
  const base = g.locations as readonly number[];
  const positions = useDerivedValue(() => {
    const d = DRIFTS.includes(variant) ? (drift.value - 0.5) * 2 * DRIFT_SHIFT : 0;
    // First and last stops stay put so the status bar always sits on near-black.
    return base.map((p, i) => (i === 0 || i === base.length - 1 ? p : Math.min(0.98, Math.max(0.02, p + d * (1 - p)))));
  });
  return (
    <Group opacity={opacity as number}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[...g.colors]} positions={positions} />
      </Rect>
    </Group>
  );
}

export function ScreenBackground({ variant }: { variant: GradientVariant }) {
  const { width, height } = useWindowDimensions();
  const ambient = useAmbient();
  const reduce = useReduceMotion();
  const [layers, setLayers] = useState<{ prev: GradientVariant | null; cur: GradientVariant }>({ prev: null, cur: variant });
  const fade = useSharedValue(1);
  const drift = useSharedValue(0.5);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLayers((l) => (l.cur === variant ? l : { prev: l.cur, cur: variant }));
    fade.value = 0;
    fade.value = withTiming(1, { duration: reduce ? duration.fast : duration.slow, easing: easing.inOut });
  }, [variant, reduce, fade]);

  useEffect(() => {
    if (ambient && DRIFTS.includes(layers.cur)) {
      drift.value = withRepeat(withTiming(1, { duration: signature.ambientDrift / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      cancelAnimation(drift);
    }
    return () => cancelAnimation(drift);
  }, [ambient, layers.cur, drift]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.prev ? <GradientLayer variant={layers.prev} drift={drift} opacity={1} width={width} height={height} /> : null}
      <GradientLayer variant={layers.cur} drift={drift} opacity={fade} width={width} height={height} />
    </Canvas>
  );
}
