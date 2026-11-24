/**
 * RangeBand: the fan chart. An expected (Likely) line plus the Almost sure–Possible band, an
 * optional dashed goal line, and a scrub lens.
 *
 * detail mode (3.2): the line draws left to right (duration.draw), then the band settles in from
 *   the centre line (duration.slow) — "here's the likely path, and here's how wide it could be".
 * calm mode (2.2): the line draws slowly (duration.calm, easing.out), then the band fades in behind
 *   it, so the fall visibly lands inside the range. No haptics in calm mode.
 * Data changes morph the paths (point arrays interpolate) instead of redrawing from zero.
 * `preview` (0..1 shared value) blends toward `previewData` — the band lifts live before committing.
 */
import { Canvas, DashPathEffect, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { formatINR } from '../lib/formatINR';
import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { textStyle } from '../components/Text';
import { duration, easing } from '../theme/motion';
import { colors } from '../theme/tokens';

export type BandData = {
  /** Expected (Likely) values. */
  line: number[];
  /** Almost sure (low) and Possible (high) values, same length as line. */
  lo: number[];
  hi: number[];
  /** Month (YM) of each point, for the lens and year-boundary haptics. */
  months?: number[];
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function lerpArr(a: number[], b: number[], t: number) {
  'worklet';
  const n = Math.min(a.length, b.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function RangeBand({
  data,
  previewData,
  preview,
  goal,
  width,
  height,
  mode = 'detail',
  trigger = 1,
  color = colors.white,
  bandColor = 'rgba(201,195,255,0.28)',
  min,
  max,
  scrub = true,
}: {
  data: BandData;
  previewData?: BandData;
  preview?: SharedValue<number>;
  goal?: number;
  width: number;
  height: number;
  mode?: 'detail' | 'calm';
  trigger?: number;
  color?: string;
  bandColor?: string;
  min?: number;
  max?: number;
  scrub?: boolean;
}) {
  const reduce = useReduceMotion();
  const calm = mode === 'calm';
  const draw = useSharedValue(reduce ? 1 : 0);
  const spread = useSharedValue(reduce ? 1 : 0);
  const morph = useSharedValue(1);
  const [prev, setPrev] = useState<BandData>(data);
  const lastData = useRef(data);

  // Reveal choreography.
  useEffect(() => {
    if (!trigger) return;
    if (reduce) {
      draw.value = 1;
      spread.value = 1;
      return;
    }
    draw.value = 0;
    spread.value = 0;
    const lineMs = calm ? duration.calm : duration.draw;
    draw.value = withTiming(1, { duration: lineMs, easing: easing.out });
    spread.value = withDelay(lineMs * (calm ? 0.8 : 0.9), withTiming(1, { duration: duration.slow, easing: easing.out }));
  }, [trigger, reduce, calm, draw, spread]);

  // Morph when the data changes.
  useEffect(() => {
    if (lastData.current === data) return;
    setPrev(lastData.current);
    lastData.current = data;
    morph.value = 0;
    morph.value = reduce ? 1 : withTiming(1, { duration: duration.slow, easing: easing.inOut });
  }, [data, reduce, morph]);

  const all = [...data.lo, ...data.hi, ...data.line, ...(previewData ? [...previewData.hi, ...previewData.lo] : []), ...(goal ? [goal] : [])];
  const yMin = min ?? Math.min(...all) * 0.95;
  const yMax = max ?? Math.max(...all) * 1.04;
  const n = data.line.length;
  const padTop = 8;
  const X = (i: number) => {
    'worklet';
    return (i / Math.max(1, n - 1)) * width;
  };
  const Y = (v: number) => {
    'worklet';
    return padTop + (1 - (v - yMin) / (yMax - yMin)) * (height - padTop * 2);
  };

  const cur = useDerivedValue(() => {
    const m = morph.value;
    let line = lerpArr(prev.line, data.line, m);
    let lo = lerpArr(prev.lo, data.lo, m);
    let hi = lerpArr(prev.hi, data.hi, m);
    if (preview && previewData) {
      const p = preview.value;
      line = lerpArr(line, previewData.line, p);
      lo = lerpArr(lo, previewData.lo, p);
      hi = lerpArr(hi, previewData.hi, p);
    }
    return { line, lo, hi };
  });

  const linePath = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const l = cur.value.line;
    for (let i = 0; i < l.length; i++) {
      if (i === 0) b.moveTo(X(i), Y(l[i]));
      else b.lineTo(X(i), Y(l[i]));
    }
    return b.build();
  });

  const bandPath = useDerivedValue(() => {
    const { line, lo, hi } = cur.value;
    const s = calm ? 1 : spread.value; // detail: expand from the centre line
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < hi.length; i++) {
      const v = line[i] + (hi[i] - line[i]) * s;
      if (i === 0) b.moveTo(X(i), Y(v));
      else b.lineTo(X(i), Y(v));
    }
    for (let i = lo.length - 1; i >= 0; i--) b.lineTo(X(i), Y(line[i] + (lo[i] - line[i]) * s));
    b.close();
    return b.build();
  });
  const bandOpacity = useDerivedValue(() => (calm ? spread.value : Math.min(1, spread.value * 1.5)));

  // ---- scrub lens ----
  const lensX = useSharedValue(-1);
  const lastIdx = useSharedValue(-1);
  const months = data.months;
  const pan = usePanGesture({
    enabled: scrub,
    minDistance: 0,
    onUpdate: (e) => {
      'worklet';
      const i = Math.max(0, Math.min(n - 1, Math.round((e.x / width) * (n - 1))));
      lensX.value = X(i); // follows the finger with no smoothing lag, snapped to points
      if (i !== lastIdx.value) {
        if (!calm && months && lastIdx.value >= 0 && Math.floor(months[i] / 12) !== Math.floor(months[lastIdx.value] / 12)) {
          scheduleOnRN(haptics.selection);
        }
        lastIdx.value = i;
      }
    },
    onFinalize: () => {
      'worklet';
      lensX.value = -1;
      lastIdx.value = -1;
    },
  });
  const lensLine = useDerivedValue(() => [vec(lensX.value, 0), vec(lensX.value, height)]);
  const lensP1 = useDerivedValue(() => lensLine.value[0]);
  const lensP2 = useDerivedValue(() => lensLine.value[1]);
  const lensOpacity = useDerivedValue(() => (lensX.value < 0 ? 0 : 1));
  const labelProps = useAnimatedProps(() => {
    const i = lastIdx.value < 0 ? n - 1 : lastIdx.value;
    return { text: formatINR(cur.value.line[i] ?? 0, { compact: true }) } as unknown as Record<string, unknown>;
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: lensX.value < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(0, Math.min(width - 80, lensX.value - 40)) }],
  }));

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={pan}>
        <View style={{ width, height }}>
          <Canvas style={{ width, height }} pointerEvents="none">
            {goal != null ? (
              <Line p1={vec(0, Y(goal))} p2={vec(width, Y(goal))} color={colors.stretch} strokeWidth={2}>
                <DashPathEffect intervals={[8, 8]} />
              </Line>
            ) : null}
            <Group opacity={bandOpacity}>
              <Path path={bandPath} color={bandColor} />
            </Group>
            <Path path={linePath} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" color={color} start={0} end={draw} />
            <Group opacity={lensOpacity}>
              <Line p1={lensP1} p2={lensP2} color="rgba(255,255,255,0.5)" strokeWidth={1} />
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
      <Animated.View style={[styles.lensLabel, labelStyle]} pointerEvents="none">
        <AnimatedTextInput editable={false} animatedProps={labelProps} defaultValue="" style={[textStyle('micro', colors.text, '700'), styles.lensText]} />
      </Animated.View>
    </View>
  );
}

/** Build band data from an engine Monte Carlo result (nominal → today's rupees). */
export function bandFromMc(
  mc: { sampleMonths: number[]; p10: number[]; p50: number[]; p90: number[] },
  opts: { today: number; inflationPct: number; centre?: (m: number) => number; upTo?: number },
): BandData {
  const months: number[] = [];
  const line: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  mc.sampleMonths.forEach((m, i) => {
    if (opts.upTo != null && m > opts.upTo) return;
    const d = Math.pow(1 + opts.inflationPct / 100, (m + 1) / 12);
    const c = opts.centre ? opts.centre(m) / d : mc.p50[i] / d;
    const scale = mc.p50[i] > 0 ? c / (mc.p50[i] / d) : 1;
    months.push(opts.today + m + 1);
    line.push(c);
    lo.push((mc.p10[i] / d) * scale);
    hi.push((mc.p90[i] / d) * scale);
  });
  return { line, lo, hi, months };
}

const styles = StyleSheet.create({
  lensLabel: { position: 'absolute', top: -22, left: 0, width: 80, alignItems: 'center' },
  lensText: { padding: 0, textAlign: 'center' },
});
