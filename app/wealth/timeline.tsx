/**
 * 5.5 Timeline (violet). Planned money by class, stacked, five years ahead. Play runs the months
 * forward (about 4s); the scrub lens snaps to months with a selection tick. "See your year in money"
 * opens a story-style recap. Reduced motion: play jumps to the end, no lens glide.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Amount } from '@/components/Amount';
import { GhostButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption } from '@/components/Text';
import { labelYM } from '@/engine/dates';
import { PLANNED_CLASSES } from '@/engine/types';
import { projectByClass } from '@/engine/wealth';
import { CLASS_DOT, CLASS_NAME } from '@/lib/classes';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { duration, signature } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const MONTHS = 60;
const H = 200;
const THUMB = 26;

export default function Timeline() {
  const input = usePlanInput();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [m, setM] = useState(16);
  const pos = useSharedValue(16 / MONTHS);
  const last = useSharedValue(16);
  const data = useMemo(() => (input ? projectByClass(input, MONTHS).slice(1) : []), [input]);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.byClass.reduce((a, b) => a + b, 0))) * 1.05, [data]);
  const paths = useMemo(() => {
    if (!w || !data.length) return [];
    const n = data.length - 1;
    const x = (i: number) => (i / n) * w;
    const y = (v: number) => H - (v / max) * H;
    const cum = data.map(() => 0);
    return PLANNED_CLASSES.map((cls, k) => {
      const lower = cum.slice();
      data.forEach((d, i) => (cum[i] += d.byClass[k]));
      const b = Skia.PathBuilder.Make();
      b.moveTo(0, y(cum[0]));
      for (let i = 1; i <= n; i++) b.lineTo(x(i), y(cum[i]));
      for (let i = n; i >= 0; i--) b.lineTo(x(i), y(lower[i]));
      b.close();
      return { cls, path: b.build() };
    });
  }, [w, data, max]);

  const tick = (i: number) => {
    haptics.selection();
    setM(i);
  };
  useAnimatedReaction(
    () => Math.round(pos.value * (MONTHS - 1)),
    (i) => {
      if (i !== last.value) {
        last.value = i;
        scheduleOnRN(tick, i);
      }
    },
  );
  const scrub = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      cancelAnimation(pos);
      pos.value = Math.min(1, Math.max(0, (e.x - THUMB / 2) / Math.max(1, w - THUMB)));
    },
    onUpdate: (e) => {
      'worklet';
      pos.value = Math.min(1, Math.max(0, (e.x - THUMB / 2) / Math.max(1, w - THUMB)));
    },
    onFinalize: () => {
      'worklet';
      // Snap to the month under the lens.
      pos.value = withTiming(Math.round(pos.value * (MONTHS - 1)) / (MONTHS - 1), { duration: duration.instant });
    },
  });
  const play = () => {
    if (reduce) {
      pos.value = 1;
      return;
    }
    const from = pos.value >= 0.999 ? 0 : pos.value;
    pos.value = from;
    pos.value = withTiming(1, { duration: signature.timelinePlay * (1 - from), easing: Easing.linear });
  };
  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * w - 1 }] }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * (w - THUMB) }] }));
  const fill = useAnimatedStyle(() => ({ width: THUMB / 2 + pos.value * (w - THUMB) }));

  if (!input || !data.length) return null;
  const at = data[Math.min(m, data.length - 1)];
  const total = at.byClass.reduce((a, b) => a + b, 0);

  return (
    <Screen background="violet" footer={<GhostButton label="See your year in money" color={colors.text} onPress={() => router.push('/wealth/year')} />}>
      <View style={styles.top}>
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={26} />
        </PressScale>
        <PressScale onPress={play} style={styles.play} accessibilityRole="button" accessibilityLabel="Play the next five years" testID="timeline-play">
          <Icon name="play" size={22} color={colors.ink} />
        </PressScale>
      </View>
      <Caption style={styles.when}>{labelYM(input.today + m + 1)} · planned money</Caption>
      <Amount value={total} compact variant="big" animate="none" />
      <GestureDetector gesture={scrub}>
        <View style={styles.chart} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="adjustable" accessibilityLabel="Month" accessibilityValue={{ text: labelYM(input.today + m + 1) }}>
          <Canvas style={{ width: w, height: H }} pointerEvents="none">
            {paths.map((p) => (
              <Path key={p.cls} path={p.path} color={CLASS_DOT[p.cls]} />
            ))}
          </Canvas>
          <Animated.View style={[styles.lens, lens]} pointerEvents="none" />
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, fill]} />
            <Animated.View style={[styles.thumb, thumb]} />
          </View>
        </View>
      </GestureDetector>
      <View style={styles.ends}>
        <Caption>{labelYM(input.today + 1)}</Caption>
        <Caption>{labelYM(input.today + MONTHS)}</Caption>
      </View>
      <View style={styles.legend}>
        {PLANNED_CLASSES.map((c) => (
          <View key={c} style={styles.key}>
            <View style={[styles.dot, { backgroundColor: CLASS_DOT[c] }]} />
            <Body color={colors.text}>{CLASS_NAME[c]}</Body>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  play: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  when: { marginTop: 16 },
  chart: { marginTop: 24, height: H + 40 },
  lens: { position: 'absolute', top: 0, width: 2, height: H, backgroundColor: colors.white },
  track: { position: 'absolute', top: H + 12, left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: colors.track },
  trackFill: { position: 'absolute', left: 0, top: 0, height: 8, borderRadius: 4, backgroundColor: colors.white },
  thumb: { position: 'absolute', top: -9, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.white },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
