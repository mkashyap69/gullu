/**
 * 5.2 Mix check (night). Actual vs target by class, the drift fixed with new money, the
 * concentration nudge. Paired bars animate; the drift gap shades amber; the concentration card
 * slides up after 500ms. Copy is verbatim for equity over target; other cases are drafts.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { concentration, mixCheck } from '@/engine/wealth';
import { CLASS_DOT, CLASS_NAME } from '@/lib/classes';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { useSettingsStore } from '@/state/stores';
import { duration, spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

function Pair({ actual, target, color, index }: { actual: number; target: number; color: string; index: number }) {
  const reduce = useReduceMotion();
  const a = useSharedValue(reduce ? actual : 0);
  useEffect(() => {
    a.value = reduce ? actual : withDelay(index * stagger.list, withSpring(actual, spring.gentle));
  }, [actual, index, reduce, a]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.min(1, a.value) * 100}%` }));
  const lo = Math.min(actual, target);
  const hi = Math.max(actual, target);
  return (
    <View style={styles.track}>
      {Math.abs(actual - target) > 0.02 ? <View style={[styles.gap, { left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }]} /> : null}
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      <View style={[styles.target, { left: `${Math.min(1, target) * 100}%` }]} />
    </View>
  );
}

export default function MixCheck() {
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const reduce = useReduceMotion();
  if (!input) return null;
  const m = mixCheck(input);
  const big = concentration(input);
  const other = input.holdings.filter((h) => !h.planned);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const body =
    m.drift > 2
      ? `Markets did well, so equity grew past target. New money goes to debt first: about ${m.monthsToFix} months to get back without selling.`
      : m.drift < -2
        ? `Equity is under target. New money goes to equity first, so the mix comes back without selling.`
        : 'Your mix is close to what your goals need. New money keeps it there.';
  return (
    <Screen background="night" scroll footer={<PrimaryButton label={m.drift > 2 ? 'OK, fix it with new money' : 'OK'} onPress={() => router.back()} />}>
      <LabTop icon="back" />
      <Rise index={0}>
        <H1>
          {pct(m.equityActual)} in equity. Your goals add up to {pct(m.equityTarget)}.
        </H1>
        <Body>{body}</Body>
      </Rise>
      <View style={styles.rows}>
        {m.rows.map((r, i) => (
          <View key={r.cls} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={[styles.dot, { backgroundColor: CLASS_DOT[r.cls] }]} />
              <Body color={colors.text} style={styles.flex}>
                {CLASS_NAME[r.cls]}
              </Body>
              <Label>{pct(r.actual)}</Label>
              <Caption> target {pct(r.target)}</Caption>
            </View>
            <Pair actual={r.actual} target={r.target} color={CLASS_DOT[r.cls]} index={i} />
          </View>
        ))}
      </View>
      {big.length ? (
        <Animated.View entering={reduce ? undefined : FadeInDown.delay(duration.slow + duration.instant).springify()}>
          <GlassCard style={styles.card}>
            <Body color={colors.text}>
              <Label>One stock is {pct(big[0].share)} of your investing.</Label> More than 10% in a single company is a lot riding on one name.{' '}
              <Caption color={colors.text} style={styles.link} onPress={() => router.push({ pathname: '/wealth/holding/[id]', params: { id: big[0].holdingId } })}>
                See it
              </Caption>
            </Body>
          </GlassCard>
        </Animated.View>
      ) : null}
      {other.map((h) => (
        <Caption key={h.id} style={styles.note}>
          {h.name} ({formatINR(h.value, { compact: true, hidden })}) is tracked but not part of the plan.
        </Caption>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 20 },
  row: { paddingVertical: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, marginTop: 8 },
  fill: { position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3 },
  gap: { position: 'absolute', top: 0, height: 6, backgroundColor: 'rgba(255,200,61,0.35)' },
  target: { position: 'absolute', top: -4, width: 2, height: 14, marginLeft: -1, backgroundColor: colors.white },
  card: { marginTop: 16 },
  link: { textDecorationLine: 'underline' },
  note: { marginTop: 12 },
});
