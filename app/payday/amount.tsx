/**
 * 4.6 Short month (ember). Less, Same or Bonus: enter the real amount. Must-haves keep their full
 * amount; the rest wait a month. As the amount changes each row's bar animates to its new value,
 * and rows that drop to ₹0 fade to "next month". `?log=1`: variable income logging money in.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/Buttons';
import { SegmentedPills } from '@/components/Pill';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { ScrubValue } from '@/components/ScrubValue';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { paydayPlan, type PaydayLine } from '@/engine/payday';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { lineColor, lineLabel } from '@/screens/payday/lineMeta';
import { requiredMap, startPayday } from '@/state/payday';
import { usePaydayStore, useSettingsStore } from '@/state/stores';
import { duration, spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

type Mode = 'less' | 'same' | 'bonus';
const STATUS: Record<PaydayLine['status'], string> = { full: 'full', partial: 'part', catchUp: 'catches up later', next: 'next month', extra: 'extra' };

function LineRow({ l, max, color }: { l: PaydayLine; max: number; color: string }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(max > 0 ? l.amount / max : 0);
  const o = useSharedValue(1);
  useEffect(() => {
    const f = max > 0 ? l.amount / max : 0;
    w.value = reduce ? f : withSpring(f, spring.gentle);
    o.value = withTiming(l.amount <= 0 ? 0.5 : 1, { duration: duration.base });
  }, [l.amount, max, reduce, w, o]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const row = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.row, row]}>
      <View style={styles.rowTop}>
        <Body color={colors.text} style={styles.flex}>
          {lineLabel(l)} <Caption>{STATUS[l.status]}</Caption>
        </Body>
        <Amount value={l.amount} variant="label" weight="800" animate="odometer" />
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { backgroundColor: color }, bar]} />
      </View>
    </Animated.View>
  );
}

export default function ShortMonth() {
  const { log } = useLocalSearchParams<{ log?: string }>();
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const savePayday = usePaydayStore((s) => s.savePayday);
  const setMoves = usePaydayStore((s) => s.setMoves);
  const usual = input?.profile.monthly ?? 0;
  const [mode, setMode] = useState<Mode>(log ? 'same' : 'less');
  const [amount, setAmount] = useState(log ? usual : Math.round((usual * 0.65) / 500) * 500);
  const plan = useMemo(() => (input ? paydayPlan(input, amount, requiredMap(input)) : null), [input, amount]);
  if (!input || !plan) return null;
  const max = Math.max(1, ...plan.lines.map((l) => Math.max(l.usual, l.amount)));
  const diff = amount - usual;
  const commitment = plan.lines.find((l) => l.kind === 'commitment');

  const pickMode = (m: Mode) => {
    setMode(m);
    if (m === 'same') setAmount(usual);
    if (m === 'less' && amount >= usual) setAmount(Math.round((usual * 0.65) / 500) * 500);
    if (m === 'bonus' && amount <= usual) setAmount(Math.round((usual * 1.5) / 500) * 500);
  };

  const use = async () => {
    // A new amount means a new check-in for this month.
    await setMoves(input.today, []);
    await savePayday({ month: input.today, amount, kind: plan.kind, placedAt: null });
    await startPayday(amount);
    router.replace('/payday/check-in');
  };

  const explain =
    diff < 0
      ? `That's ${formatINR(-diff, { hidden })} less. Must-have goals keep their full amount; the rest wait a month.`
      : diff > 0
        ? `That's ${formatINR(diff, { hidden })} more. The extra goes to the goal furthest behind first.`
        : 'The usual split, every rupee with a job.';

  return (
    <Screen background="ember" scroll footer={<PrimaryButton testID="amount-use" label="Use this split" disabled={amount <= 0} onPress={use} />}>
      <LabTop icon="back" />
      <Rise index={0}>
        <H1>{log ? 'How much came in?' : 'How much do you have this month?'}</H1>
      </Rise>
      <View style={styles.seg}>
        <SegmentedPills<Mode>
          testID="amount-mode"
          value={mode}
          onChange={pickMode}
          options={[
            { value: 'less', label: 'Less' },
            { value: 'same', label: 'Same' },
            { value: 'bonus', label: 'Bonus' },
          ]}
        />
      </View>
      <ScrubValue
        typeable
        testID="amount-value"
        variant="big"
        accessibilityLabel="This month's amount"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setMode(v < usual ? 'less' : v > usual ? 'bonus' : 'same');
        }}
        min={0}
        max={usual * 10 || 1000000}
        step={500}
        pxPerStep={6}
        tickEvery={2}
        format={(v) => formatINR(v, { hidden })}
      />
      <Body>{explain}</Body>
      <View style={styles.list}>
        {plan.lines.map((l) => (
          <LineRow key={l.id} l={l} max={max} color={lineColor(l, input)} />
        ))}
      </View>
      {commitment && commitment.status === 'catchUp' ? (
        <Caption style={styles.note}>{commitment.label} still reaches ₹1.5 L by 31 March: the gap is spread over the coming months.</Caption>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { marginVertical: 20 },
  list: { marginTop: 16 },
  row: { paddingVertical: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.track, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  note: { marginTop: 12 },
});
