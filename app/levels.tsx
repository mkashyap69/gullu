/**
 * 10.1 Levels (violet). Six levels tied to real progress. The ladder draws bottom-up, completed
 * checks pop in sequence, the current level glows, and the next level's ring fills to its progress
 * with the one thing blocking it. Reduced motion: everything appears in place.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { LEVELS, checkLevel } from '@/engine/habits';
import { GulluStill } from '@/gullu/Gullu';
import { maskRupees } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { useLevel, useStreak } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useSettingsStore } from '@/state/stores';
import { duration, easing, spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

const DOT = 56;
const ROW = 92;

function Check({ i }: { i: number }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) s.value = withDelay(duration.draw * 0.4 + i * stagger.rings * 2, withSpring(1, spring.bouncy));
  }, [reduce, i, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.dot, styles.done, a]}>
      <Icon name="check" size={22} color={colors.ink} />
    </Animated.View>
  );
}

function NextRing({ n, progress }: { n: number; progress: number }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(reduce ? progress : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(duration.draw, withTiming(progress, { duration: duration.draw, easing: easing.out }));
  }, [reduce, progress, p]);
  const arc = useMemo(() => Skia.PathBuilder.Make().addArc(Skia.XYWHRect(3, 3, DOT - 6, DOT - 6), -90, 359.9).build(), []);
  return (
    <View style={styles.dot}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={arc} style="stroke" strokeWidth={3} color={colors.track} />
        <Path path={arc} style="stroke" strokeWidth={3} strokeCap="round" color={colors.white} start={0} end={p} />
      </Canvas>
      <Label weight="800">{n}</Label>
    </View>
  );
}

export default function Levels() {
  const input = usePlanInput();
  const level = useLevel();
  const streak = useStreak();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const reduce = useReduceMotion();
  const line = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) line.value = withTiming(1, { duration: duration.draw, easing: easing.out });
  }, [reduce, line]);
  const lineStyle = useAnimatedStyle(() => ({ height: `${line.value * 100}%` }));
  if (!input) return null;
  const current = LEVELS.find((l) => l.n === level);
  const next = LEVELS.find((l) => l.n === level + 1);
  const check = next ? checkLevel(next.n, input, streak) : null;

  return (
    <Screen
      background="violet"
      scroll
      footer={
        <View style={styles.links}>
          <View style={styles.fill}>
            <PressScale style={styles.link} onPress={() => router.push('/streak')} accessibilityRole="button" testID="levels-streak">
              <Body color={colors.text} numberOfLines={1} adjustsFontSizeToFit>Streak and challenges</Body>
            </PressScale>
          </View>
          <View style={styles.fill}>
            <PressScale style={styles.link} onPress={() => router.push('/collection')} accessibilityRole="button" testID="levels-looks">
              <Body color={colors.text}>Gullu&apos;s looks</Body>
            </PressScale>
          </View>
        </View>
      }
    >
      <LabTop icon="back" />
      <View style={styles.head}>
        <GulluStill size={120} skin={skin} />
        <View style={styles.fill}>
          <Caption>{current ? "You're at" : 'Your first level'}</Caption>
          <H1>{current ? `Level ${current.n} · ${current.name}` : 'comes with your first payday'}</H1>
        </View>
      </View>
      <Body>Levels follow real progress, never app opens.</Body>
      <View style={styles.ladder}>
        <View style={styles.rail}>
          <Animated.View style={[styles.railFill, lineStyle]} />
        </View>
        {LEVELS.map((l, i) => {
          const done = l.n <= level;
          const isNext = l.n === level + 1;
          return (
            <View key={l.n} style={[styles.row, !done && !isNext && styles.dim]} accessibilityLabel={`Level ${l.n}, ${l.name}, ${done ? 'reached' : isNext ? 'next' : 'later'}`}>
              {done ? <Check i={i} /> : isNext && check ? <NextRing n={l.n} progress={check.progress} /> : <View style={[styles.dot, styles.later]}><Label weight="800" color={colors.textCaption}>{l.n}</Label></View>}
              <View style={styles.fill}>
                <Label weight="800" color={l.n === level ? colors.white : undefined} style={l.n === level ? styles.glow : undefined}>
                  {l.name}
                </Label>
                <Body>{l.rule}</Body>
                {isNext && check ? (
                  <View style={styles.progress}>
                    <Caption color={colors.text}>{check.detail}</Caption>
                    {check.blocker ? <Caption color={colors.stretch}>{maskRupees(check.blocker, hidden)}</Caption> : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  ladder: { marginTop: 24 },
  rail: { position: 'absolute', left: DOT / 2 - 1, top: DOT / 2, bottom: ROW - DOT / 2, width: 2, backgroundColor: colors.track, justifyContent: 'flex-end' },
  railFill: { width: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  row: { flexDirection: 'row', gap: 16, minHeight: ROW, alignItems: 'flex-start' },
  dim: { opacity: 0.45 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.white },
  later: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.textCaption },
  glow: { textShadowColor: 'rgba(255,220,120,0.8)', textShadowRadius: 12 },
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  links: { flexDirection: 'row', gap: 12 },
  link: { height: 52, borderRadius: radius.pill, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
});
