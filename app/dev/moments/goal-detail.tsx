/**
 * Signature moment 3 (part 2) · Goal detail (3.2, violet). The tapped ring scales up and morphs
 * into this chart's frame (shared element), then the fan chart draws left to right and the three
 * bands settle in from the centre line. Scrub the chart for a lens (haptic on year boundaries).
 * Press and hold "Add ₹3,500 a month" to preview: the band lifts live before you commit.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, Caption, H1 } from '@/components/Text';
import { WORD, WORD_COLOR } from '@/dev/labData';
import { simulateDeterministic, type McResult } from '@/engine/core';
import { labelYM, ymYear } from '@/engine/dates';
import { CHOL, MC_PATHS, MC_SEED, effectiveRisk, goalSpec, planGoals } from '@/engine/plan';
import { PROFILE_MIX } from '@/engine/core';
import { formatINR } from '@/lib/formatINR';
import { RangeBand, bandFromMc, type BandData } from '@/motion-kit/RangeBand';
import { runMonteCarlo } from '@/plan/runMonteCarlo';
import { usePlan, usePlanInput } from '@/plan/usePlan';
import { useSettingsStore } from '@/state/stores';
import { spring } from '@/theme/motion';
import { colors, layout } from '@/theme/tokens';

const CHART_H = 220;

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const input = usePlanInput();
  const { plan, ranges } = usePlan();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const preview = useSharedValue(0);
  const [previewMc, setPreviewMc] = useState<McResult | null>(null);

  const goal = input?.goals.find((g) => g.id === id);
  const idx = input ? planGoals(input).findIndex((g) => g.id === id) : -1;
  const result = plan?.goals.find((g) => g.goalId === id);
  const extra = result && result.requiredMonthly != null ? Math.max(0, result.requiredMonthly - result.actualMonthly) : 0;

  // Preview: the same goal with the extra monthly amount, computed off the JS thread.
  useEffect(() => {
    if (!input || !goal || extra <= 0) return;
    let live = true;
    runMonteCarlo([goalSpec(input, goal, { monthly: goal.monthly + extra })], MC_PATHS, MC_SEED + 1, CHOL).then(([r]) => live && setPreviewMc(r));
    return () => {
      live = false;
    };
  }, [input, goal, extra]);

  const band: BandData | null = useMemo(() => {
    if (!input || !goal || idx < 0 || !ranges) return null;
    const spec = goalSpec(input, goal);
    const det = simulateDeterministic(spec);
    return bandFromMc(ranges[idx], { today: input.today, inflationPct: goal.inflationPct, centre: (m) => det.path[m], upTo: spec.months - 1 });
  }, [input, goal, idx, ranges]);
  const previewBand: BandData | undefined = useMemo(() => {
    if (!input || !goal || !previewMc) return undefined;
    const spec = goalSpec(input, goal, { monthly: goal.monthly + extra });
    const det = simulateDeterministic(spec);
    return bandFromMc(previewMc, { today: input.today, inflationPct: goal.inflationPct, centre: (m) => det.path[m], upTo: spec.months - 1 });
  }, [input, goal, previewMc, extra]);

  if (!input || !goal || !result) return null;
  const risk = effectiveRisk(input.profile);
  const mix = PROFILE_MIX[risk];
  const chartW = width - layout.screenPadding.horizontal * 2;
  const L = (v: number) => formatINR(Math.round(v / 1e5) * 1e5, { compact: true, hidden });
  const b = result.bands;

  return (
    <Screen
      background="violet"
      footer={
        extra > 0 ? (
          <View
            style={styles.full}
            onTouchStart={() => (preview.value = withSpring(1, spring.gentle))}
            onTouchEnd={() => (preview.value = withSpring(0, spring.gentle))}
            onTouchCancel={() => (preview.value = withSpring(0, spring.gentle))}
          >
            <PrimaryButton label={`Add ${formatINR(extra, { hidden })} a month`} />
          </View>
        ) : null
      }
    >
      <View style={styles.top}>
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={26} />
        </PressScale>
        <Body color={colors.text}>What if</Body>
      </View>
      <Rise index={0}>
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: WORD_COLOR[result.affordability] }]} />
          <Caption>
            {goal.name} · {labelYM(goal.date)} ·{' '}
          </Caption>
          <Caption color={WORD_COLOR[result.affordability]}>{WORD[result.affordability]}</Caption>
        </View>
        <H1>
          Likely {L(b?.likely ?? result.likelyToday)} of {L(result.targetToday)}.
        </H1>
        {b ? (
          <Body>
            In today&apos;s rupees. Almost sure: {L(b.almostSure)}. Possible: {L(b.possible)}.
          </Body>
        ) : (
          <Body>In today&apos;s rupees.</Body>
        )}
      </Rise>
      <Animated.View sharedTransitionTag={`ring-${id}`} style={[styles.chart, { width: chartW, height: CHART_H }]}>
        {band ? (
          <RangeBand data={band} previewData={previewBand} preview={preview} goal={result.targetToday} width={chartW} height={CHART_H - 24} mode="detail" />
        ) : null}
        <View style={styles.axis}>
          <Caption>Today {L(result.current)}</Caption>
          <Caption>{ymYear(goal.date)}</Caption>
        </View>
      </Animated.View>
      <Rise index={2}>
        <GlassCard style={styles.card}>
          <View>
            <Caption>Each month now</Caption>
            <Amount value={result.actualMonthly} variant="h1" weight="800" />
          </View>
          <View style={styles.right}>
            <Caption>To be on track</Caption>
            <Amount value={result.requiredMonthly ?? 0} variant="h1" weight="800" color={result.onTrack ? colors.text : colors.stretch} />
          </View>
        </GlassCard>
        <Body color={colors.text} style={styles.mix}>
          Mix: {Math.round(mix[0] * 100)}% equity, {Math.round(mix[1] * 100)}% debt, {Math.round(mix[2] * 100)}% gold
        </Body>
        <Caption>Projections use the return assumptions you set. They are not guarantees or investment advice.</Caption>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chart: { marginTop: 28 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  card: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  right: { alignItems: 'flex-end' },
  mix: { marginTop: 16, marginBottom: 8 },
});
