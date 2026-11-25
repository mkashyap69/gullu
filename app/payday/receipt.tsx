/**
 * 4.5 Receipt (ember). The receipt slides out of a slot line by line with a ratchet haptic per line;
 * the streak row fills cell by cell (shield months dashed); the next-level card shimmers once.
 * After it, a new level gets its own moment (10.2).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { labelYM } from '@/engine/dates';
import { checkLevel, LEVELS, monthName, streakState } from '@/engine/habits';
import { Gullu, GulluStill } from '@/gullu/Gullu';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Particles } from '@/motion-kit/Particles';
import { useLevel } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { shareCard } from '@/share/shareCard';
import { useHabitsStore, usePaydayStore } from '@/state/stores';
import { duration, easing, spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function SlotLine({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(reduce ? 0 : -1);
  const [h, setH] = useState(40);
  useEffect(() => {
    if (reduce) return;
    const delay = duration.slow + index * duration.base;
    y.value = withDelay(delay, withSpring(0, spring.snappy));
    const t = setTimeout(() => haptics.ratchet(), delay);
    return () => clearTimeout(t);
  }, [index, reduce, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * h }], opacity: y.value < -0.98 ? 0 : 1 }));
  return (
    <View style={styles.clip} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <Animated.View style={a}>{children}</Animated.View>
    </View>
  );
}

function Cell({ i, kind, start }: { i: number; kind: 'placed' | 'shield' | 'now' | 'empty'; start: number }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.value = withDelay(start + i * stagger.list, withSpring(1, spring.snappy));
  }, [reduce, i, start, t]);
  const a = useAnimatedStyle(() => ({ opacity: 0.2 + 0.8 * t.value, transform: [{ scale: 0.6 + 0.4 * t.value }] }));
  return <Animated.View style={[styles.cell, styles[kind], a]} />;
}

function Shimmer({ delay }: { delay: number }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (!reduce) x.value = withDelay(delay, withTiming(1, { duration: duration.draw, easing: easing.inOut }));
  }, [delay, reduce, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 360 }, { rotate: '18deg' }], opacity: x.value > -1 && x.value < 1 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.shimmer, a]} pointerEvents="none">
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** "Fund Education fully to unlock it." from the level's blocker (verbatim for the design case). */
function unlockLine(blocker: string | null): string {
  if (!blocker) return 'It unlocks with your next placed payday.';
  const m = blocker.match(/^(.+) needs ₹[\d,]+ more$/);
  if (m) return `Fund ${m[1]} fully to unlock it.`;
  return `${blocker} to unlock it.`;
}

export default function Receipt() {
  const { levels, festival } = useLocalSearchParams<{ levels?: string; festival?: string }>();
  const input = usePlanInput();
  const skin = useHabitSkin();
  const level = useLevel();
  const paydays = usePaydayStore((s) => s.paydays);
  const events = useHabitsStore((s) => s.events);
  const [burst, setBurst] = useState(0);
  const unlocked = (levels ?? '').split(',').filter(Boolean).map(Number);
  useEffect(() => {
    const t = setTimeout(() => setBurst(1), duration.slow);
    return () => clearTimeout(t);
  }, []);
  const state = useMemo(() => {
    if (!input) return null;
    const placed = paydays.filter((p) => p.placedAt != null).map((p) => p.month);
    const used = events.flatMap((e) => (e.kind === 'shield' && e.data.used ? [e.data.month] : []));
    return { s: streakState(placed, used, input.today), placed: new Set(placed), used };
  }, [input, paydays, events]);
  if (!input || !state) return null;
  const month = input.today;
  const lastShield = state.s.shielded.at(-1);
  const cells = Array.from({ length: 12 }, (_, i) => month - 11 + i).map((m) =>
    (m === month ? 'now' : state.s.shielded.includes(m) ? 'shield' : state.placed.has(m) ? 'placed' : 'empty') as 'placed' | 'shield' | 'now' | 'empty',
  );
  const next = LEVELS[level] ?? null;
  const check = next ? checkLevel(next.n, input, state.s.streak) : null;
  const lineStart = duration.slow + 2 * duration.base;

  const home = () => {
    if (unlocked.length) router.replace({ pathname: '/level-up', params: { n: String(unlocked[unlocked.length - 1]) } });
    else router.dismissTo('/home');
  };

  return (
    <Screen
      background="ember"
      footer={
        <>
          <PrimaryButton testID="receipt-home" label="Back home" onPress={home} />
          <GhostButton label="Share card, amounts hidden" onPress={() => shareCard({ kind: 'receipt', title: `${monthName(month)} placed.`, line: `Streak: ${state.s.streak} months.` })} />
        </>
      }
    >
      <LabTop onReplay={undefined} />
      <View style={styles.hero}>
        <Gullu size={170} skin={skin} />
        <Particles trigger={burst} kinds={['coin', 'petal']} count={16} width={240} height={200} origin={{ x: 120, y: 70 }} lifeMs={duration.celebrate * 0.7} />
      </View>
      <View style={styles.slot} />
      <View style={styles.lines}>
        <SlotLine index={0}>
          <H1 center>{monthName(month)} placed.</H1>
        </SlotLine>
        <SlotLine index={1}>
          <Body center>
            Streak: {state.s.streak} {state.s.streak === 1 ? 'month' : 'months'}.{lastShield != null ? ` Your shield covered ${labelYM(lastShield)}.` : ''}
            {festival ? ` Gullu earned a ${festival} look.` : ''}
          </Body>
        </SlotLine>
        <SlotLine index={2}>
          <View style={styles.cells}>
            {cells.map((k, i) => (
              <Cell key={i} i={i} kind={k} start={lineStart} />
            ))}
          </View>
        </SlotLine>
        {unlocked.length ? (
          <SlotLine index={3}>
            <PressScale onPress={home} accessibilityRole="button" accessibilityLabel="See your new level">
              <GlassCard strong style={styles.level}>
                <GulluStill size={48} skin={LEVELS[unlocked[unlocked.length - 1] - 1].skin} aura={false} />
                <View style={styles.flex}>
                  <Label>Level {unlocked[unlocked.length - 1]} unlocked.</Label>
                  <Body color={colors.text}>{LEVELS[unlocked[unlocked.length - 1] - 1].name}: tap to see Gullu&apos;s new look.</Body>
                </View>
                <Icon name="chevron" size={18} color={colors.textCaption} />
                <Shimmer delay={duration.slow + 4 * duration.base} />
              </GlassCard>
            </PressScale>
          </SlotLine>
        ) : next && check ? (
          <SlotLine index={3}>
            <PressScale onPress={() => router.push('/levels')} accessibilityRole="button" accessibilityLabel="Levels">
              <GlassCard strong style={styles.level}>
                <GulluStill size={48} skin={next.skin} aura={false} />
                <View style={styles.flex}>
                  <Body color={colors.text}>
                    <Label>Level {next.n} is one step away. </Label>
                    {unlockLine(check.blocker)}
                  </Body>
                </View>
                <Icon name="chevron" size={18} color={colors.textCaption} />
                <Shimmer delay={duration.slow + 4 * duration.base} />
              </GlassCard>
            </PressScale>
          </SlotLine>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  slot: { height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.25)', marginHorizontal: 40, marginTop: 4 },
  lines: { gap: 14, marginTop: 6 },
  clip: { overflow: 'hidden' },
  cells: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cell: { width: 24, height: 26, borderRadius: 7 },
  placed: { backgroundColor: 'rgba(255,255,255,0.5)' },
  shield: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)' },
  now: { backgroundColor: colors.white },
  empty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderRadius: radius.lg },
  flex: { flex: 1 },
  shimmer: { position: 'absolute', top: -20, bottom: -20, left: -120, width: 90 },
});
