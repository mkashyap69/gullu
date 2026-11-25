/**
 * 7.3 This month's income (ember): the Income tab for retirees. What to take out and from where.
 * The amount counts; the withdraw row pours from the cash jar. In April the yearly refill row
 * appears; tick it once it's moved. "I've withdrawn it" records the month and updates holdings.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, Label } from '@/components/Text';
import { TickCircle } from '@/components/TickCircle';
import { applyWithdrawal } from '@/engine/income';
import { Gullu } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { usePlanInput } from '@/plan/usePlan';
import { useIncomePlan } from '@/plan/useIncomePlan';
import { useHoldingsStore, usePaydayStore, useSettingsStore } from '@/state/stores';
import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The cash jar icon with a drop pouring out of it. */
function Pour({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(duration.slow, withRepeat(withSequence(withTiming(1, { duration: duration.draw }), withTiming(0, { duration: 0 })), 2, false));
  }, [reduce, t]);
  const drop = useAnimatedStyle(() => ({ opacity: t.value > 0 && t.value < 1 ? 1 - t.value : 0, transform: [{ translateY: 4 + 14 * t.value }] }));
  return (
    <View style={styles.pour}>
      <View style={[styles.jarIcon, { backgroundColor: color }]} />
      <Animated.View style={[styles.drop, { backgroundColor: color }, drop]} />
    </View>
  );
}

export function IncomeTab() {
  const input = usePlanInput();
  const p = useIncomePlan();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const skin = useHabitSkin();
  const paydays = usePaydayStore((s) => s.paydays);
  const savePayday = usePaydayStore((s) => s.savePayday);
  const upsertHolding = useHoldingsStore((s) => s.upsertHolding);
  const recordValue = useHoldingsStore((s) => s.recordValue);
  const [refilled, setRefilled] = useState(false);
  if (!input || !p) return null;
  const fullMonth = FULL_MONTHS[input.today % 12];
  const done = paydays.some((x) => x.month === input.today && x.placedAt != null);

  const withdraw = async () => {
    for (const h of applyWithdrawal(input.holdings, p, refilled, input.today)) await upsertHolding(h);
    const total = input.holdings.filter((h) => h.planned).reduce((a, h) => a + h.value, 0) - p.fromSavings;
    await recordValue({ date: input.today, holdingId: null, assetClass: null, value: total });
    await savePayday({ month: input.today, amount: p.fromSavings, kind: 'same', placedAt: input.today });
    haptics.success();
  };

  return (
    <Screen background="ember" footer={done ? <Body center>Done for {fullMonth}. See you next month.</Body> : <PrimaryButton label="I've withdrawn it" onPress={withdraw} testID="income-withdrawn" />}>
      <View style={styles.gullu}>
        <Gullu size={170} skin={skin} expression="happy" />
      </View>
      <Amount value={p.fromSavings} variant="big" style={styles.center} />
      <Body center>{fullMonth} income, from your cash bucket.</Body>
      <View style={styles.rows}>
        <View style={styles.row}>
          <Pour color={colors.cash} />
          <Body color={colors.text} style={styles.fill}>
            Withdraw from {p.cashHolding ? p.cashHolding.name.toLowerCase() : 'your cash'}
          </Body>
          <Label weight="800">{formatINR(p.fromSavings, { hidden })}</Label>
        </View>
        {p.isRefillMonth ? (
          <PressScale style={styles.row} onPress={() => { haptics.selection(); setRefilled(!refilled); }} disabled={done} accessibilityRole="checkbox" accessibilityState={{ checked: refilled }} accessibilityLabel="Move income to cash, yearly refill">
            <View style={styles.dotWrap}>
              {refilled ? <TickCircle done /> : <View style={[styles.dot, { backgroundColor: colors.debt }]} />}
            </View>
            <View style={styles.fill}>
              <Body color={colors.text}>Move income → cash (yearly refill)</Body>
              {!done ? <Caption>Tap once you&apos;ve moved it.</Caption> : null}
            </View>
            <Label weight="800">{formatINR(p.refill, { compact: true, hidden })}</Label>
          </PressScale>
        ) : null}
      </View>
      {p.pension > 0 ? <Body style={styles.pension}>Plus {formatINR(p.pension, { hidden })} pension, already in your bank.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gullu: { alignItems: 'center', marginTop: 8 },
  center: { textAlign: 'center' },
  rows: { marginTop: 32, gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 },
  pour: { width: 22, height: 32, alignItems: 'center' },
  jarIcon: { width: 14, height: 14, borderRadius: 7 },
  drop: { position: 'absolute', top: 10, width: 5, height: 5, borderRadius: 3 },
  dotWrap: { width: 22, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pension: { marginTop: 20 },
});
