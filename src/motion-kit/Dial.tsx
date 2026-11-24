/**
 * Dial: 60 ticks around Gullu (Answer, Home variants). On reveal the ticks light up one by one,
 * 15ms apart, in a hue sweep from 0° to 135°, up to `value` (0..1). Unlit ticks sit at track white.
 * Drawn as one Skia picture per frame from a single progress value. Reduced motion: drawn lit.
 */
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Easing, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { signature } from '../theme/motion';

function hsl(h: number, s: number, l: number): string {
  'worklet';
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255);
  return `rgb(${to(f(0))},${to(f(8))},${to(f(4))})`;
}

export function Dial({ size, value, trigger = 1, delay = 0, tickLength = 12, inset = 0 }: { size: number; value: number; trigger?: number; delay?: number; tickLength?: number; inset?: number }) {
  const reduce = useReduceMotion();
  const N = signature.dialTicks;
  const lit = useSharedValue(reduce ? value * N : 0);
  useEffect(() => {
    if (!trigger) return;
    const target = value * N;
    if (reduce) {
      lit.value = target;
      return;
    }
    lit.value = 0;
    lit.value = withDelay(delay, withTiming(target, { duration: target * signature.dialTickGap, easing: Easing.linear }));
  }, [trigger, value, reduce, delay, N, lit]);

  const picture = useDerivedValue<SkPicture>(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const p = Skia.Paint();
    p.setStyle(1);
    p.setStrokeWidth(3);
    p.setStrokeCap(1);
    const cx = size / 2;
    const R = size / 2 - inset - 2;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const on = i < lit.value;
      // The tick that is lighting right now flashes in slightly longer.
      const grow = on && i > lit.value - 1 ? 1 + (lit.value - i) * 0.2 : 1;
      if (on) p.setColor(Skia.Color(hsl((i / (N - 1)) * signature.dialHueEnd, 0.85, 0.6)));
      else p.setColor(Skia.Color('rgba(255,255,255,0.14)'));
      const r0 = R - tickLength * grow;
      c.drawLine(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0, cx + Math.cos(a) * R, cx + Math.sin(a) * R, p);
    }
    return rec.finishRecordingAsPicture();
  });

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
