/**
 * 3.4 Glide path (violet). Equity share falls as the date nears. The step chart draws year by year;
 * the "today" marker drops in with a bounce; each cap step highlights in sequence with its caption.
 * Body copy is verbatim for the "under 3 years" step and drafted for the others.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { PROFILE_MIX } from '@/engine/core';
import { labelYM } from '@/engine/dates';
import { glideSteps } from '@/engine/moments';
import { effectiveRisk, retirementDate } from '@/engine/plan';
import { goalColor } from '@/lib/goalColors';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { duration, easing, spring } from '@/theme/motion';
import { colors, layout } from '@/theme/tokens';

const H = 240;
const TOP = 30;

export default function GlidePath() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const input = usePlanInput();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const W = width - layout.screenPadding.horizontal * 2;
  const goal = input?.goals.find((g) => g.id === id);
  const date = goal && input ? (goal.isRetirement ? retirementDate(goal, input) : goal.date) : 0;
  const steps = useMemo(() => (input && goal ? glideSteps(input.today, date, PROFILE_MIX[effectiveRisk(input.profile)][0]) : []), [input, goal, date]);
  const span = Math.max(1, date - (input?.today ?? 0));
  const X = (m: number) => ((m - (input?.today ?? 0)) / span) * W;
  const Y = (cap: number) => TOP + (1 - cap) * (H - TOP);

  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    steps.forEach((s, i) => {
      const x = X(s.from);
      if (i === 0) b.moveTo(x, Y(s.cap));
      else b.lineTo(x, Y(steps[i - 1].cap)).lineTo(x, Y(s.cap));
    });
    if (steps.length) b.lineTo(W, Y(steps[steps.length - 1].cap));
    return b.build();
  }, [steps, W]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = useMemo(() => {
    const b = Skia.PathBuilder.Make().moveTo(0, H);
    steps.forEach((s, i) => {
      const x = X(s.from);
      if (i > 0) b.lineTo(x, Y(steps[i - 1].cap));
      b.lineTo(x, Y(s.cap));
    });
    if (steps.length) b.lineTo(W, Y(steps[steps.length - 1].cap));
    return b.lineTo(W, H).close().build();
  }, [steps, W]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draws year by year: one draw duration per year of the goal, within the signature budget.
  const draw = useSharedValue(reduce ? 1 : 0);
  const drop = useSharedValue(reduce ? 0 : -40);
  const [lit, setLit] = useState(reduce ? steps.length : 0);
  useEffect(() => {
    if (reduce) return;
    const years = Math.max(1, Math.round(span / 12));
    const ms = Math.min(duration.celebrate, duration.draw * Math.max(1, years / 4));
    draw.value = withTiming(1, { duration: ms, easing: easing.inOut });
    drop.value = withDelay(duration.base, withSpring(0, spring.bouncy));
    const timers = steps.map((s, i) => setTimeout(() => setLit(i + 1), ((s.from - (input?.today ?? 0)) / span) * ms + duration.fast));
    return () => timers.forEach(clearTimeout);
  }, [reduce, steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const marker = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }], opacity: drop.value < -35 ? 0 : 1 }));

  if (!input || !goal || steps.length === 0) return null;
  const next = steps[1];
  const last = steps[steps.length - 1];
  const pct = (c: number) => `${Math.round(c * 100)}%`;
  const bandWords = (y: number) => (y === 3 ? 'under 3 years' : y === 5 ? 'under 5 years' : 'under 7 years');
  const body = next
    ? `From ${labelYM(next.from)} the goal is ${bandWords(next.yearsLeft)} away, so new money moves its mix down to ${pct(next.cap)} equity. Nothing is sold to do it.`
    : `It's already ${steps[0].yearsLeft < 3 ? 'under 3 years' : 'close'} away, so new money keeps it at ${pct(last.cap)} equity or less. Nothing is sold to do it.`;

  return (
    <Screen background="violet" footer={<PrimaryButton label="Got it" onPress={() => router.back()} />}>
      <LabTop icon="back" />
      <Rise index={0}>
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: goalColor(goal) }]} />
          <Caption>
            {goal.name} · {labelYM(date)}
          </Caption>
        </View>
        <H1>Less equity as the date gets closer.</H1>
        <Body>{body}</Body>
      </Rise>
      <View style={[styles.chart, { width: W, height: H }]}>
        <Canvas style={{ width: W, height: H }} pointerEvents="none">
          <Path path={area} color="rgba(201,195,255,0.16)" opacity={draw} />
          <Path path={path} style="stroke" strokeWidth={3} strokeJoin="miter" color={colors.white} start={0} end={draw} />
        </Canvas>
        {steps.map((s, i) => (
          <View
            key={s.from}
            style={[
              styles.stepLabel,
              // Near the right edge the label sits left of its step, right-aligned, clear of the line.
              X(s.from) + 190 > W ? { left: Math.max(0, X(s.from) - 178), alignItems: 'flex-end' } : { left: X(s.from) + (i === 0 ? 18 : 12) },
              { top: Y(s.cap) - 28, opacity: i < lit ? 1 : 0.25 },
            ]}
          >
            {i === 0 ? <Label>{pct(s.cap)} today</Label> : <Body color={colors.text}>{`${pct(s.cap)} from ${labelYM(s.from)}`}</Body>}
          </View>
        ))}
        <Animated.View style={[styles.today, { top: Y(steps[0].cap) - 7, backgroundColor: goalColor(goal) }, marker]} />
      </View>
      <View style={styles.axis}>
        <Caption>{labelYM(input.today)}</Caption>
        <Caption>{labelYM(date)}</Caption>
      </View>
      <Caption style={styles.legend}>Equity share of this goal&apos;s money. The rest is debt and cash.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chart: { marginTop: 40, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  stepLabel: { position: 'absolute', width: 170 },
  today: { position: 'absolute', left: -7, width: 14, height: 14, borderRadius: 7 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legend: { marginTop: 24 },
});
