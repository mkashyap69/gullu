/**
 * 1.7 for retirees (DRAFT until Phase 8 builds 7.1–7.3): how long the monthly income lasts, in the
 * words of 7.1. Same reveal as the answer: Gullu celebrates with a small coin burst, the age counts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PrimaryButton } from '../components/Buttons';
import { useCountUp } from '../components/Count';
import { Rise } from '../components/Rise';
import { Screen } from '../components/Screen';
import { Body, Caption, H1 } from '../components/Text';
import { effectiveRisk } from '../engine/plan';
import { retireeWithdrawalSpec } from '../engine/onboarding';
import { withdrawalLikely, withdrawalRanges, withdrawalRate } from '../engine/withdrawal';
import { Gullu, type GulluHandle } from '../gullu/Gullu';
import type { Expression } from '../gullu/geometry';
import { formatINR } from '../lib/formatINR';
import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { Particles } from '../motion-kit/Particles';
import { usePlanInput } from '../plan/usePlan';
import { useSettingsStore } from '../state/stores';
import { duration } from '../theme/motion';

const NAMES = { safetyFirst: 'Safety-first', cautious: 'Cautious', balanced: 'Balanced', growth: 'Growth', aggressive: 'Aggressive' } as const;

export function RetireeAnswer({ onDone }: { onDone: () => void }) {
  const input = usePlanInput();
  const reduce = useReduceMotion();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const gullu = useRef<GulluHandle>(null);
  const [expr, setExpr] = useState<Expression>('happy');
  const [burst, setBurst] = useState(0);
  const result = useMemo(() => {
    if (!input) return null;
    const spec = retireeWithdrawalSpec(input);
    const total = spec.buckets.cash + spec.buckets.income + spec.buckets.growth;
    return { spec, likely: withdrawalLikely(spec).lastsUntil, ranges: withdrawalRanges(spec, 500), total };
  }, [input]);
  const age = useCountUp(result?.likely ?? 0, 1, reduce ? 0 : duration.slow, duration.draw);
  useEffect(() => {
    const t = setTimeout(() => {
      setExpr('celebrate');
      gullu.current?.celebrate();
      setBurst(1);
      haptics.success();
    }, reduce ? 0 : duration.slow);
    return () => clearTimeout(t);
  }, [reduce]);
  if (!input || !result) return null;
  const fromSavings = Math.max(0, result.spec.spendMonthly - result.spec.pensionMonthly);
  const rate = result.total > 0 ? withdrawalRate(fromSavings, result.total) : 0;
  return (
    <Screen
      background="dusk"
      footer={
        <>
          <PrimaryButton testID="answer-done" label="Go to my plan" onPress={onDone} />
          <Animated.View entering={FadeIn.delay(reduce ? 0 : duration.celebrate).duration(duration.slow)}>
            <Caption center>Profile: {NAMES[effectiveRisk(input.profile)]}. Not a guarantee or investment advice.</Caption>
          </Animated.View>
        </>
      }
    >
      <View style={styles.hero}>
        <Gullu ref={gullu} size={190} expression={expr} />
        <Particles trigger={burst} kinds={['coin']} count={16} width={220} height={200} origin={{ x: 110, y: 60 }} lifeMs={duration.celebrate * 0.7} />
      </View>
      <H1>
        {formatINR(result.spec.spendMonthly, { hidden })} a month, likely until {age}.
      </H1>
      <Rise index={1}>
        <Body>In today&apos;s rupees. Almost sure until {result.ranges.almostSure}, even if markets are weak.</Body>
        {result.total > 0 ? (
          <Caption style={styles.rate}>
            {formatINR(fromSavings, { hidden })} a month is {(rate * 100).toFixed(1)}% of your {formatINR(result.total, { compact: true, hidden })} a year. Under 4% is usually considered steady.
          </Caption>
        ) : null}
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 40, marginBottom: 24 },
  rate: { marginTop: 16 },
});
