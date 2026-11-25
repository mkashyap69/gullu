/**
 * "See your year in money" (from 5.5): a story-style recap of the last 12 months, one card at a time.
 * Tap to go on; never auto-advances (no timers). All copy here is drafted (see docs/progress.md).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { labelYM } from '@/engine/dates';
import { useReduceMotion } from '@/motion/prefs';
import { useStreak } from '@/plan/selectors';
import { usePlan, usePlanInput } from '@/plan/usePlan';
import { useHoldingsStore, usePaydayStore } from '@/state/stores';
import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

/** Total planned money confirmed on or before `date` (latest total snapshot). */
function totalAt(snapshots: { date: number; holdingId: string | null; value: number }[], date: number): number | null {
  const t = snapshots.filter((s) => s.holdingId == null && s.date <= date).sort((a, b) => b.date - a.date)[0];
  return t ? t.value : null;
}

export default function YearInMoney() {
  const input = usePlanInput();
  const { plan } = usePlan();
  const paydays = usePaydayStore((s) => s.paydays);
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const streak = useStreak();
  const reduce = useReduceMotion();
  const [i, setI] = useState(0);
  if (!input || !plan) return null;
  const from = input.today - 11;
  const placed = paydays.filter((p) => p.placedAt != null && p.month >= from && p.month <= input.today);
  const moved = placed.reduce((a, p) => a + p.amount, 0);
  const start = totalAt(snapshots, from);
  const now = input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0);

  const cards = [
    <View key="0" style={styles.card}>
      <Caption>
        {labelYM(from)} to {labelYM(input.today)}
      </Caption>
      <H1>Your year in money.</H1>
      <Body>Tap to go on.</Body>
    </View>,
    <View key="1" style={styles.card}>
      <H1>{placed.length === 1 ? 'You placed 1 payday.' : `You placed ${placed.length} paydays.`}</H1>
      {moved > 0 ? (
        <>
          <Amount value={moved} compact variant="big" />
          <Body>went into your goals.</Body>
        </>
      ) : null}
      {streak > 1 ? <Body>{`That's a ${streak}-month streak.`}</Body> : null}
    </View>,
    <View key="2" style={styles.card}>
      <H1>Your planned money</H1>
      {start != null ? (
        <>
          <Body>was</Body>
          <Amount value={start} compact variant="h1" />
          <Body>and is now</Body>
        </>
      ) : null}
      <Amount value={now} compact variant="big" />
      <Caption>New money and market moves together. Markets go both ways.</Caption>
    </View>,
    <View key="3" style={styles.card}>
      <H1>{plan.total > 0 ? `${plan.onTrack} of ${plan.total} goals on track.` : 'Add a goal to start.'}</H1>
      <Body>Same plan, one more year.</Body>
    </View>,
  ];
  const next = () => (i < cards.length - 1 ? setI(i + 1) : router.back());
  return (
    <Screen background="violet">
      <LabTop icon="close" />
      <View style={styles.bars}>
        {cards.map((_, k) => (
          <View key={k} style={[styles.bar, k <= i && styles.barOn]} />
        ))}
      </View>
      <Pressable style={styles.fill} onPress={next} accessibilityRole="button" accessibilityLabel="Next" testID="year-next">
        <Animated.View key={i} style={styles.fill} entering={reduce ? undefined : FadeIn.duration(duration.slow)} exiting={reduce ? undefined : FadeOut.duration(duration.fast)}>
          {cards[i]}
        </Animated.View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.white },
  card: { flex: 1, justifyContent: 'center', gap: 8 },
});
