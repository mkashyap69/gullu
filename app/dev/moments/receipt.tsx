/**
 * Signature moment 4 (part 2) · Receipt (4.5, ember).
 * The receipt slides out of a slot line by line with a ratchet haptic per line. The streak row
 * fills cell by cell (the shield month shows dashed). The "Level 4 is one step away" card shimmers once.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useStreak } from '@/dev/useHabits';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { labelYM, ymMonth } from '@/engine/dates';
import { Gullu, GulluStill } from '@/gullu/Gullu';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Particles } from '@/motion-kit/Particles';
import { useToday } from '@/plan/usePlan';
import { useHabitsStore } from '@/state/stores';
import { duration, easing, spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function SlotLine({ index, children, run }: { index: number; children: ReactNode; run: number }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(reduce ? 0 : -1);
  const [h, setH] = useState(40);
  useEffect(() => {
    if (reduce) {
      y.value = 0;
      return;
    }
    y.value = -1;
    const delay = duration.slow + index * duration.base;
    y.value = withDelay(delay, withSpring(0, spring.snappy));
    const t = setTimeout(() => haptics.ratchet(), delay);
    return () => clearTimeout(t);
  }, [index, reduce, run, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * h }], opacity: y.value < -0.98 ? 0 : 1 }));
  return (
    <View style={styles.clip} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <Animated.View style={a}>{children}</Animated.View>
    </View>
  );
}

function StreakCell({ i, kind, run, start }: { i: number; kind: 'placed' | 'shield' | 'now'; run: number; start: number }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? 1 : 0;
    if (!reduce) t.value = withDelay(start + i * stagger.list, withSpring(1, spring.snappy));
  }, [run, reduce, i, start, t]);
  const a = useAnimatedStyle(() => ({ opacity: 0.2 + 0.8 * t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  return <Animated.View style={[styles.cell, kind === 'shield' ? styles.cellShield : kind === 'now' ? styles.cellNow : styles.cellPlaced, a]} />;
}

function Shimmer({ delay, run }: { delay: number; run: number }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduce) return;
    x.value = -1;
    x.value = withDelay(delay, withTiming(1, { duration: duration.draw, easing: easing.inOut }));
  }, [delay, run, reduce, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 360 }, { rotate: '18deg' }], opacity: x.value > -1 && x.value < 1 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.shimmer, a]} pointerEvents="none">
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export default function Receipt() {
  const skin = useHabitSkin();
  const today = useToday();
  const streak = useStreak() + 1; // this payday just placed
  const shield = useHabitsStore((s) => s.events.find((e) => e.kind === 'shield' && e.data.used));
  const [run, setRun] = useState(1);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBurst((b) => b + 1), duration.slow);
    return () => clearTimeout(t);
  }, [run]);

  const shieldMonth = shield?.kind === 'shield' ? shield.data.month : null;
  const cells = Array.from({ length: 12 }, (_, i) => today - 11 + i).map((m) => (m === today ? 'now' : m === shieldMonth ? 'shield' : 'placed') as 'placed' | 'shield' | 'now');
  const lineStart = duration.slow + 2 * duration.base;

  return (
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton label="Back home" onPress={() => router.dismissTo('/dev/moments/home-rings')} />
          <GhostButton label="Share card, amounts hidden" />
        </>
      }
    >
      <LabTop onReplay={() => setRun((r) => r + 1)} />
      <View style={styles.hero}>
        <Gullu size={180} skin={skin} key={run} />
        <Particles trigger={burst} kinds={['coin', 'petal']} count={16} width={240} height={200} origin={{ x: 120, y: 70 }} lifeMs={duration.celebrate * 0.7} />
      </View>
      <View style={styles.slot} />
      <View style={styles.lines} key={run}>
        <SlotLine index={0} run={run}>
          <H1 center>{MONTH_NAMES[ymMonth(today)]} placed.</H1>
        </SlotLine>
        <SlotLine index={1} run={run}>
          <Body center>
            Streak: {streak} months.{shieldMonth != null ? ` Your shield covered ${labelYM(shieldMonth)}.` : ''}
          </Body>
        </SlotLine>
        <SlotLine index={2} run={run}>
          <View style={styles.cells}>
            {cells.map((k, i) => (
              <StreakCell key={i} i={i} kind={k} run={run} start={lineStart} />
            ))}
          </View>
        </SlotLine>
        <SlotLine index={3} run={run}>
          <GlassCard strong style={styles.level}>
            <GulluStill size={48} skin="builder" aura={false} />
            <View style={styles.levelText}>
              <Label>Level 4 is one step away.</Label>
              <Body color={colors.text}>Fund Education fully to unlock it.</Body>
            </View>
            <Icon name="chevron" size={18} color={colors.textCaption} />
            <Shimmer delay={duration.slow + 4 * duration.base} run={run} />
          </GlassCard>
        </SlotLine>
      </View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', marginTop: -8 },
  slot: { height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.25)', marginHorizontal: 40, marginTop: 4 },
  lines: { gap: 14, marginTop: 6 },
  clip: { overflow: 'hidden' },
  cells: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cell: { width: 24, height: 26, borderRadius: 7 },
  cellPlaced: { backgroundColor: 'rgba(255,255,255,0.5)' },
  cellShield: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)' },
  cellNow: { backgroundColor: colors.white },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderRadius: radius.lg },
  levelText: { flex: 1 },
  shimmer: { position: 'absolute', top: -20, bottom: -20, left: -120, width: 90 },
});
