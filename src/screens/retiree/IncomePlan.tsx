/**
 * 7.1 Income plan (dusk): the retiree's Home. Monthly income and how long it likely lasts. Calm
 * motion only: the ages count, the pension and savings bars grow. No confetti; Gullu stays gentle.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/Buttons';
import { useCountUp } from '@/components/Count';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { useIncomePlan } from '@/plan/useIncomePlan';
import { useProfileStore, useSettingsStore } from '@/state/stores';
import { duration, easing } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function greeting(h: number) {
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Grows from 0 to `f` (0..1) on the calm timing. */
function Grow({ f, color, delay = 0, style }: { f: number; color: string; delay?: number; style?: object }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(reduce ? f : 0);
  useEffect(() => {
    w.value = reduce ? f : withDelay(delay, withTiming(f, { duration: duration.calm, easing: easing.out }));
  }, [f, reduce, delay, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <Animated.View style={[styles.grow, { backgroundColor: color }, style, a]} />;
}

export function IncomePlan() {
  const p = useIncomePlan();
  const name = useProfileStore((s) => s.profile?.name);
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const likely = useCountUp(p?.likelyAge ?? 0, p ? 1 : 0, duration.base, duration.calm, p?.age ?? 0);
  if (!p) return null;
  const end = p.likelyAge + 5;
  const at = (age: number) => Math.max(0, Math.min(1, (age - p.age) / (end - p.age)));
  const rate = Math.round(p.rate * 1000) / 10;
  return (
    <Screen background="dusk" footer={<PrimaryButton label="This month's income" onPress={() => router.navigate('/payday')} testID="income-month" />}>
      <Caption>
        {greeting(new Date().getHours())}
        {name ? `, ${name}` : ''}
      </Caption>
      <H1 style={styles.headline} testID="income-headline">
        {formatINR(p.spend, { hidden })} a month, likely until {likely}.
      </H1>
      <Body>
        {p.almostSureAge != null ? `In today's rupees. Almost sure until ${p.almostSureAge}, even if markets are weak.` : "In today's rupees."}
      </Body>
      <View style={styles.range}>
        <View style={styles.rangeTop}>
          {p.almostSureAge != null ? (
            <Caption color={colors.text} style={[styles.mark, { left: `${at(p.almostSureAge) * 100}%` }]}>
              {p.almostSureAge} weak
            </Caption>
          ) : null}
        </View>
        <View style={styles.track}>
          <Grow f={at(p.likelyAge)} color="rgba(255,255,255,0.5)" />
          {p.almostSureAge != null ? <Grow f={at(p.almostSureAge)} color={colors.white} style={styles.over} /> : null}
        </View>
        <View style={styles.rangeBottom}>
          <Caption>{p.age} now</Caption>
          <Caption color={colors.text} style={[styles.mark, { left: `${at(p.likelyAge) * 100}%` }]}>
            {p.likelyAge} likely
          </Caption>
        </View>
      </View>
      <View style={styles.rows}>
        <View>
          <View style={styles.row}>
            <Body color={colors.text}>Pension</Body>
            <Amount value={p.pension} variant="label" weight="800" />
          </View>
          <View style={styles.share}>
            <Grow f={p.spend ? p.pension / p.spend : 0} color={colors.white} delay={duration.slow} />
          </View>
        </View>
        <View>
          <View style={styles.row}>
            <Body color={colors.text}>From savings</Body>
            <Amount value={p.fromSavings} variant="label" weight="800" />
          </View>
          <View style={styles.share}>
            <Grow f={p.spend ? p.fromSavings / p.spend : 0} color={colors.white} delay={duration.slow + duration.base} />
          </View>
        </View>
      </View>
      <Body style={styles.note}>
        {`${formatINR(p.fromSavings, { hidden })} a month is ${rate}% of your ${formatINR(p.corpus, { compact: true, hidden })} a year. `}
        {p.rate < 0.04 ? 'Under 4% is usually considered steady.' : 'Over 4% draws savings down faster; the ages above already show it.'}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { marginTop: 32 },
  range: { marginTop: 32 },
  rangeTop: { height: 22 },
  rangeBottom: { height: 22, marginTop: 8 },
  mark: { position: 'absolute', width: 96, textAlign: 'center', transform: [{ translateX: -48 }] },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden', marginTop: 4 },
  grow: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  over: { zIndex: 1 },
  rows: { marginTop: 32, gap: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { marginTop: 24 },
  share: { height: 4, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden', marginTop: 8 },
});
