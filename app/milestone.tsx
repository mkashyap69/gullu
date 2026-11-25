/**
 * 2.3 Milestone (ember). Habits only, never market luck: 6 and 12 paydays, safety net full, first
 * ₹1 Cr invested. Confetti of tiny coins and marigold petals (about 40, gravity, 1.6s), Gullu
 * celebrates, the number counts up, success haptic. Reduced motion: a static badge, no confetti.
 * Copy for 12 paydays is from 02-SCREENS; the others are drafts (docs/progress.md).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { useCountUp } from '@/components/Count';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/Text';
import { ShareSheet } from '@/share/ShareSheet';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import type { MilestoneKey } from '@/engine/moments';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Particles } from '@/motion-kit/Particles';
import { useToday } from '@/plan/usePlan';
import { useHabitsStore } from '@/state/stores';
import { duration, spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const COPY: Record<MilestoneKey, { n?: number; title: (n: number) => string; body: string }> = {
  'paydays-12': { n: 12, title: (n) => `${n} paydays, all placed.`, body: 'A full year without missing a month. That habit matters more than any market.' },
  'paydays-6': { n: 6, title: (n) => `${n} paydays, all placed.`, body: 'Half a year without missing a month. That habit is what moves every goal.' },
  'safety-full': { title: () => 'Your safety net is full.', body: 'Months of spending, ready any time. From now, payday money flows on to your goals.' },
  'invested-1cr': { title: () => '₹1 Cr put to work.', body: 'Built one payday at a time. Gullu is proud of the habit, not the market.' },
};

function Cell({ i, run }: { i: number; run: number }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? 1 : 0;
    if (!reduce) t.value = withDelay(duration.slow + i * stagger.list, withSpring(1, spring.snappy));
  }, [i, run, reduce, t]);
  const a = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  return <Animated.View style={[styles.cell, a]} />;
}

export default function Milestone() {
  const { kind = 'paydays-12', preview } = useLocalSearchParams<{ kind?: MilestoneKey; preview?: string }>();
  const c = COPY[kind] ?? COPY['paydays-12'];
  const skin = useHabitSkin();
  const today = useToday();
  const reduce = useReduceMotion();
  const add = useHabitsStore((s) => s.add);
  const { width, height } = useWindowDimensions();
  const gullu = useRef<GulluHandle>(null);
  const [run, setRun] = useState(1);
  const [share, setShare] = useState(false);
  const [rain, setRain] = useState(0);
  const n = useCountUp(c.n ?? 0, run, reduce ? 0 : duration.slow, duration.draw);

  useEffect(() => {
    if (!preview) add({ kind: 'moment', data: { key: kind }, at: today }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      gullu.current?.celebrate();
      setRain((r) => r + 1);
      haptics.success();
    }, reduce ? 0 : duration.base);
    return () => clearTimeout(t);
  }, [run, reduce]);

  return (
    <View style={styles.shareWrap}>
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton label="Back home" onPress={() => router.back()} />
          <GhostButton label="Share it, amounts hidden" onPress={() => setShare(true)} />
        </>
      }
    >
      <LabTop onReplay={preview ? () => setRun((r) => r + 1) : undefined} />
      <View style={styles.hero}>
        <Gullu ref={gullu} key={run} size={220} skin={skin} expression="celebrate" />
      </View>
      <Rise index={0}>
        <H1>{c.title(c.n ? n : 0)}</H1>
        <Body>{c.body}</Body>
      </Rise>
      {c.n ? (
        <View style={styles.cells}>
          {Array.from({ length: c.n }, (_, i) => (
            <Cell key={`${run}-${i}`} i={i} run={run} />
          ))}
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
        <Particles trigger={rain} kinds={['coin', 'petal']} count={40} mode="rain" width={width} height={height} />
      </View>
    </Screen>
    <ShareSheet card={{ kind: 'milestone', title: c.title(c.n ? n : 0), line: c.body }} open={share} onClose={() => setShare(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shareWrap: { flex: 1 },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  cells: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  cell: { width: 24, height: 26, borderRadius: 7, backgroundColor: colors.white },
});
